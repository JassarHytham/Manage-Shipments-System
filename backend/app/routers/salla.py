"""Salla OAuth callback + webhook receiver."""
from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.config import settings
from app.database import db
from app.middleware.auth import require_admin
from app.services.salla import (
    exchange_code,
    get_auth_url,
    sync_orders_from_salla,
    _map_salla_status,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Salla"])


# --- OAuth ---

@router.get("/salla/auth")
async def salla_auth_redirect():
    """Returns the Salla OAuth URL to begin authorization."""
    return {"auth_url": get_auth_url()}


@router.get("/salla/callback")
async def salla_callback(code: str):
    """Handle Salla OAuth callback — exchange code for tokens."""
    try:
        data = await exchange_code(code)
        return {"status": "authorized", "merchant": data.get("merchant", {})}
    except Exception as e:
        logger.error(f"Salla OAuth error: {e}")
        raise HTTPException(status_code=400, detail=f"OAuth failed: {str(e)}")


# --- Webhook ---

@router.post("/webhooks/salla")
async def salla_webhook(request: Request):
    """
    Receive Salla webhook events:
    - order.created → create order in DB
    - order.status.updated → update order status
    - order.refunded → mark as returned
    """
    body = await request.body()

    # Verify webhook signature if secret is configured
    if settings.SALLA_WEBHOOK_SECRET:
        signature = request.headers.get("x-salla-signature", "")
        expected = hmac.new(
            settings.SALLA_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event", "")
    data = payload.get("data", {})

    logger.info(f"Salla webhook received: {event}")

    if event == "order.created":
        await _handle_order_created(data)
    elif event == "order.status.updated":
        await _handle_order_status_updated(data)
    elif event == "order.refunded":
        await _handle_order_refunded(data)
    else:
        logger.info(f"Unhandled Salla event: {event}")

    return {"received": True}


# --- Manual Sync ---

@router.post("/orders/sync")
async def trigger_sync(_admin=Depends(require_admin)):
    """Manually trigger full order sync from Salla (admin only)."""
    results = []
    page = 1
    while True:
        result = await sync_orders_from_salla(page=page)
        results.append(result)
        if page >= result["total_pages"]:
            break
        page += 1

    total_synced = sum(r["synced"] for r in results)
    return {
        "status": "completed",
        "total_synced": total_synced,
        "pages_processed": len(results),
    }


# --- Internal Handlers ---

async def _handle_order_created(data: dict):
    """Create or update order from webhook payload."""
    salla_id = str(data.get("id", ""))
    if not salla_id:
        return

    customer = data.get("customer", {})
    shipping = data.get("shipping", {})
    shipping_company = (shipping.get("company", {}).get("name", "") or "").lower()

    courier = None
    if "aramex" in shipping_company:
        courier = "aramex"
    elif "smsa" in shipping_company:
        courier = "smsa"

    salla_status = data.get("status", {})
    status_name = salla_status.get("slug", "pending") if isinstance(salla_status, dict) else str(salla_status)

    total = data.get("total", {})
    total_amount = float(total.get("amount", 0)) if isinstance(total, dict) else float(total or 0)

    order = await db.order.upsert(
        where={"salla_order_id": salla_id},
        data={
            "create": {
                "salla_order_id": salla_id,
                "customer_name": customer.get("name", customer.get("first_name", "Unknown")),
                "customer_phone": customer.get("mobile", customer.get("phone", "")),
                "customer_city": customer.get("city", ""),
                "total_amount": total_amount,
                "status": _map_salla_status(status_name),
                "courier": courier,
                "awb_number": shipping.get("tracking_number"),
                "salla_status": status_name,
            },
            "update": {
                "customer_name": customer.get("name", customer.get("first_name", "Unknown")),
                "customer_phone": customer.get("mobile", customer.get("phone", "")),
                "customer_city": customer.get("city", ""),
                "total_amount": total_amount,
                "status": _map_salla_status(status_name),
                "courier": courier,
                "awb_number": shipping.get("tracking_number"),
                "salla_status": status_name,
            },
        },
    )

    # Sync items
    items = data.get("items", [])
    if items:
        await db.orderitem.delete_many(where={"order_id": order.id})
        for item in items:
            price = item.get("price", {})
            await db.orderitem.create(
                data={
                    "order_id": order.id,
                    "product_name": item.get("name", "Unknown"),
                    "sku": item.get("sku", ""),
                    "size": _extract_size_from_item(item),
                    "quantity": item.get("quantity", 1),
                    "unit_price": float(price.get("amount", 0)) if isinstance(price, dict) else float(price or 0),
                }
            )

    logger.info(f"Order created/updated from webhook: {salla_id}")


async def _handle_order_status_updated(data: dict):
    """Update order status from webhook."""
    salla_id = str(data.get("id", ""))
    if not salla_id:
        return

    salla_status = data.get("status", {})
    status_name = salla_status.get("slug", "") if isinstance(salla_status, dict) else str(salla_status)

    order = await db.order.find_unique(where={"salla_order_id": salla_id})
    if not order:
        logger.warning(f"Webhook status update for unknown order: {salla_id}")
        return

    new_status = _map_salla_status(status_name)

    # Update shipping info if provided
    shipping = data.get("shipping", {})
    update_data = {
        "status": new_status,
        "salla_status": status_name,
    }
    if shipping.get("tracking_number"):
        update_data["awb_number"] = shipping["tracking_number"]

    await db.order.update(where={"id": order.id}, data=update_data)
    logger.info(f"Order {salla_id} status updated to {new_status}")


async def _handle_order_refunded(data: dict):
    """Mark order as returned when refunded in Salla."""
    salla_id = str(data.get("id", data.get("order_id", "")))
    if not salla_id:
        return

    order = await db.order.find_unique(where={"salla_order_id": salla_id})
    if not order:
        logger.warning(f"Webhook refund for unknown order: {salla_id}")
        return

    await db.order.update(
        where={"id": order.id},
        data={"status": "returned", "salla_status": "refunded"},
    )
    logger.info(f"Order {salla_id} marked as returned (refunded)")


def _extract_size_from_item(item: dict) -> Optional[str]:
    """Extract size from item options."""
    for opt in item.get("options", []):
        name = (opt.get("name", "") or "").lower()
        if "size" in name or "مقاس" in name or "حجم" in name:
            val = opt.get("value", "")
            return val.get("name") if isinstance(val, dict) else str(val)
    return None
