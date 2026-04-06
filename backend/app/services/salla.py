"""Salla Partner API integration — OAuth + order sync."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.config import settings
from app.database import db

logger = logging.getLogger(__name__)

SALLA_AUTH_URL = "https://accounts.salla.sa/oauth2/auth"
SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token"
SALLA_API_BASE = "https://api.salla.dev/admin/v2"


def get_auth_url() -> str:
    """Build the Salla OAuth authorization URL."""
    params = {
        "client_id": settings.SALLA_CLIENT_ID,
        "redirect_uri": settings.SALLA_REDIRECT_URI,
        "response_type": "code",
        "scope": "offline_access",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{SALLA_AUTH_URL}?{query}"


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            SALLA_TOKEN_URL,
            json={
                "client_id": settings.SALLA_CLIENT_ID,
                "client_secret": settings.SALLA_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.SALLA_REDIRECT_URI,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    expires_at = datetime.now(timezone.utc).replace(
        microsecond=0
    ) + __import__("datetime").timedelta(seconds=data["expires_in"])

    # Store token — upsert by merchant
    merchant_id = str(data.get("merchant", {}).get("id", "default"))
    await db.sallatoken.upsert(
        where={"merchant_id": merchant_id},
        data={
            "create": {
                "merchant_id": merchant_id,
                "access_token": data["access_token"],
                "refresh_token": data["refresh_token"],
                "expires_at": expires_at,
            },
            "update": {
                "access_token": data["access_token"],
                "refresh_token": data["refresh_token"],
                "expires_at": expires_at,
            },
        },
    )
    return data


async def get_valid_token() -> Optional[str]:
    """Get a valid access token, refreshing if expired."""
    token_record = await db.sallatoken.find_first()
    if not token_record:
        return None

    # Refresh if expired or about to expire (5 min buffer)
    now = datetime.now(timezone.utc)
    from datetime import timedelta

    if token_record.expires_at.replace(tzinfo=timezone.utc) < now + timedelta(minutes=5):
        return await _refresh_token(token_record)

    return token_record.access_token


async def _refresh_token(token_record) -> Optional[str]:
    """Refresh an expired Salla token."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                SALLA_TOKEN_URL,
                json={
                    "client_id": settings.SALLA_CLIENT_ID,
                    "client_secret": settings.SALLA_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": token_record.refresh_token,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        logger.error(f"Failed to refresh Salla token: {e}")
        return None

    from datetime import timedelta

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"])

    await db.sallatoken.update(
        where={"id": token_record.id},
        data={
            "access_token": data["access_token"],
            "refresh_token": data.get("refresh_token", token_record.refresh_token),
            "expires_at": expires_at,
        },
    )
    return data["access_token"]


async def salla_api_get(endpoint: str, params: Optional[dict] = None) -> dict:
    """Make authenticated GET request to Salla API."""
    token = await get_valid_token()
    if not token:
        raise ValueError("No valid Salla token. Please authorize via /salla/auth.")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SALLA_API_BASE}{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


async def salla_api_put(endpoint: str, data: dict) -> dict:
    """Make authenticated PUT request to Salla API."""
    token = await get_valid_token()
    if not token:
        raise ValueError("No valid Salla token. Please authorize via /salla/auth.")

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{SALLA_API_BASE}{endpoint}",
            headers={"Authorization": f"Bearer {token}"},
            json=data,
        )
        resp.raise_for_status()
        return resp.json()


async def sync_orders_from_salla(page: int = 1) -> dict:
    """Pull orders from Salla and upsert into local DB."""
    data = await salla_api_get("/orders", params={"page": page, "per_page": 50})

    orders = data.get("data", [])
    synced = 0

    for salla_order in orders:
        salla_id = str(salla_order["id"])
        customer = salla_order.get("customer", {})

        # Extract customer fields — Salla uses full_name/mobile (int)
        customer_name = str(customer.get("full_name") or customer.get("name") or customer.get("first_name") or "Unknown")
        customer_phone = str(customer.get("mobile") or customer.get("phone") or "")
        customer_city = str(customer.get("city") or "")

        # Extract address from receiver or shipping address
        receiver = salla_order.get("receiver") or {}
        customer_address = str(receiver.get("street", "") or receiver.get("address", "") or "")
        customer_district = str(receiver.get("district", "") or "")
        customer_postal_code = str(receiver.get("postal_code", "") or receiver.get("zip", "") or "")
        # Use receiver city if customer city is empty
        if not customer_city and receiver.get("city"):
            customer_city = str(receiver["city"])

        # Determine courier from shipping company
        shipping = salla_order.get("shipping", {})
        shipping_company = (shipping.get("company", {}).get("name", "") or "").lower()
        courier = None
        if "aramex" in shipping_company:
            courier = "aramex"
        elif "smsa" in shipping_company:
            courier = "smsa"

        # Map Salla status to our status
        salla_status = salla_order.get("status", {})
        status_name = salla_status.get("slug", "pending") if isinstance(salla_status, dict) else str(salla_status)
        status = _map_salla_status(status_name)

        # Get AWB
        awb = shipping.get("tracking_number") or shipping.get("awb")

        # Parse total amount
        total_raw = salla_order.get("total", {})
        total_amount = float(total_raw.get("amount", 0)) if isinstance(total_raw, dict) else float(total_raw or 0)

        # Upsert order
        order = await db.order.upsert(
            where={"salla_order_id": salla_id},
            data={
                "create": {
                    "salla_order_id": salla_id,
                    "customer_name": customer_name,
                    "customer_phone": customer_phone,
                    "customer_city": customer_city,
                    "customer_address": customer_address or None,
                    "customer_district": customer_district or None,
                    "customer_postal_code": customer_postal_code or None,
                    "total_amount": total_amount,
                    "status": status,
                    "courier": courier,
                    "awb_number": awb,
                    "salla_status": status_name,
                },
                "update": {
                    "customer_name": customer_name,
                    "customer_phone": customer_phone,
                    "customer_city": customer_city,
                    "customer_address": customer_address or None,
                    "customer_district": customer_district or None,
                    "customer_postal_code": customer_postal_code or None,
                    "total_amount": total_amount,
                    "status": status,
                    "courier": courier,
                    "awb_number": awb,
                    "salla_status": status_name,
                },
            },
        )

        # Sync order items
        items = salla_order.get("items", [])
        if items:
            # Delete existing items and recreate
            await db.orderitem.delete_many(where={"order_id": order.id})
            for item in items:
                await db.orderitem.create(
                    data={
                        "order_id": order.id,
                        "product_name": item.get("name", "Unknown"),
                        "sku": item.get("sku", ""),
                        "size": _extract_size(item.get("options", [])),
                        "quantity": item.get("quantity", 1),
                        "unit_price": float(item.get("price", {}).get("amount", 0)) if isinstance(item.get("price"), dict) else float(item.get("price", 0)),
                    }
                )
        synced += 1

    pagination = data.get("pagination", {})
    return {
        "synced": synced,
        "page": page,
        "total_pages": pagination.get("totalPages", 1),
        "total_orders": pagination.get("total", synced),
    }


async def update_salla_order_status(salla_order_id: str, status: str, awb: Optional[str] = None) -> bool:
    """Push order status update back to Salla."""
    try:
        payload = {"status_id": _get_salla_status_id(status)}
        if awb:
            payload["shipment"] = {"tracking_number": awb}
        await salla_api_put(f"/orders/{salla_order_id}/status", payload)
        return True
    except Exception as e:
        logger.error(f"Failed to update Salla order {salla_order_id}: {e}")
        return False


def _map_salla_status(salla_slug: str) -> str:
    """Map Salla status slugs to our OrderStatus enum."""
    mapping = {
        "under_review": "pending",
        "in_progress": "pending",
        "created": "pending",
        "pending": "pending",
        "shipped": "shipped",
        "in_transit": "shipped",
        "delivering": "shipped",
        "delivered": "delivered",
        "completed": "delivered",
        "returned": "returned",
        "cancelled": "cancelled",
        "refunded": "returned",
        "restored": "pending",
    }
    return mapping.get(salla_slug, "pending")


def _get_salla_status_id(our_status: str) -> int:
    """Map our status back to Salla status IDs."""
    mapping = {
        "pending": 1,
        "shipped": 8,
        "delivered": 10,
        "returned": 13,
        "cancelled": 6,
    }
    return mapping.get(our_status, 1)


def _extract_size(options: list) -> Optional[str]:
    """Extract size from Salla product options."""
    for opt in options:
        name = (opt.get("name", "") or "").lower()
        if "size" in name or "مقاس" in name or "حجم" in name:
            return opt.get("value", {}).get("name") if isinstance(opt.get("value"), dict) else str(opt.get("value", ""))
    return None
