"""Orders API — list, detail, status update."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db
from app.middleware.auth import get_current_user, require_admin
from app.schemas.order import (
    OrderDetailResponse,
    OrderItemResponse,
    OrderListResponse,
    OrderResponse,
    OrderStatusUpdate,
)
from app.services.salla import salla_api_get, update_salla_order_status

router = APIRouter(prefix="/orders", tags=["Orders"])

VALID_STATUSES = {"pending", "shipped", "delivered", "returned", "cancelled"}
VALID_COURIERS = {"aramex", "smsa"}


@router.get("", response_model=OrderListResponse)
async def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    courier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _user=Depends(get_current_user),
):
    """List all orders with optional filters."""
    where = {}

    if status_filter and status_filter in VALID_STATUSES:
        where["status"] = status_filter
    if courier and courier in VALID_COURIERS:
        where["courier"] = courier
    if search:
        where["OR"] = [
            {"customer_name": {"contains": search, "mode": "insensitive"}},
            {"customer_phone": {"contains": search}},
            {"salla_order_id": {"contains": search}},
            {"awb_number": {"contains": search}},
        ]

    total = await db.order.count(where=where)
    orders = await db.order.find_many(
        where=where,
        skip=(page - 1) * per_page,
        take=per_page,
        order={"created_at": "desc"},
    )

    return OrderListResponse(
        orders=[
            OrderResponse(
                id=o.id,
                salla_order_id=o.salla_order_id,
                customer_name=o.customer_name,
                customer_phone=o.customer_phone,
                customer_city=o.customer_city,
                customer_address=o.customer_address,
                customer_district=o.customer_district,
                customer_postal_code=o.customer_postal_code,
                total_amount=float(o.total_amount),
                status=o.status,
                courier=o.courier,
                awb_number=o.awb_number,
                salla_status=o.salla_status,
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in orders
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_order(order_id: str, _user=Depends(get_current_user)):
    """Get full order detail with items."""
    order = await db.order.find_unique(
        where={"id": order_id},
        include={"items": True},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderDetailResponse(
        id=order.id,
        salla_order_id=order.salla_order_id,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_city=order.customer_city,
        customer_address=order.customer_address,
        customer_district=order.customer_district,
        customer_postal_code=order.customer_postal_code,
        total_amount=float(order.total_amount),
        status=order.status,
        courier=order.courier,
        awb_number=order.awb_number,
        salla_status=order.salla_status,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[
            OrderItemResponse(
                id=item.id,
                product_name=item.product_name,
                sku=item.sku,
                size=item.size,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
            )
            for item in (order.items or [])
        ],
    )


@router.post("/{order_id}/refresh-address", response_model=OrderDetailResponse)
async def refresh_address_from_salla(order_id: str, _user=Depends(get_current_user)):
    """
    Fetch the latest receiver address from Salla and update the local order.
    Called when opening the shipment creation form for an order.
    """
    order = await db.order.find_unique(where={"id": order_id}, include={"items": True})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Try to pull fresh address from Salla if we have a salla_order_id
    if order.salla_order_id:
        try:
            data = await salla_api_get(f"/orders/{order.salla_order_id}")
            salla_order = data.get("data", {})

            receiver = salla_order.get("receiver") or {}
            # Also check shipping address fields
            shipping = salla_order.get("shipping") or {}
            ship_addr = shipping.get("address") or {}

            customer = salla_order.get("customer") or {}
            mobile_code = str(customer.get("mobile_code") or "+966").strip()
            mobile = str(customer.get("mobile") or "").strip()

            # Build phone with country code if not already prefixed
            if mobile and not mobile.startswith("+") and not mobile.startswith("00"):
                full_phone = f"{mobile_code}{mobile}"
            else:
                full_phone = mobile or order.customer_phone

            city = (
                str(receiver.get("city") or "")
                or str(ship_addr.get("city") or "")
                or str(customer.get("city") or "")
                or order.customer_city
            )
            address = (
                str(receiver.get("street") or "")
                or str(receiver.get("address") or "")
                or str(ship_addr.get("street") or "")
                or order.customer_address
                or ""
            )
            district = (
                str(receiver.get("district") or "")
                or str(ship_addr.get("block") or "")
                or order.customer_district
                or ""
            )
            postal_code = (
                str(receiver.get("postal_code") or "")
                or str(ship_addr.get("zip_code") or "")
                or order.customer_postal_code
                or ""
            )
            customer_name = (
                str(receiver.get("name") or "")
                or str(customer.get("full_name") or "")
                or order.customer_name
            )

            update_data: dict = {}
            if city and city != order.customer_city:
                update_data["customer_city"] = city
            if address and address != order.customer_address:
                update_data["customer_address"] = address
            if district and district != order.customer_district:
                update_data["customer_district"] = district
            if postal_code and postal_code != order.customer_postal_code:
                update_data["customer_postal_code"] = postal_code
            if full_phone and full_phone != order.customer_phone:
                update_data["customer_phone"] = full_phone
            if customer_name and customer_name != order.customer_name:
                update_data["customer_name"] = customer_name

            if update_data:
                order = await db.order.update(
                    where={"id": order_id},
                    data=update_data,
                    include={"items": True},
                )
        except Exception:
            pass  # Fall through with whatever we have locally

    return OrderDetailResponse(
        id=order.id,
        salla_order_id=order.salla_order_id,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        customer_city=order.customer_city,
        customer_address=order.customer_address,
        customer_district=order.customer_district,
        customer_postal_code=order.customer_postal_code,
        total_amount=float(order.total_amount),
        status=order.status,
        courier=order.courier,
        awb_number=order.awb_number,
        salla_status=order.salla_status,
        created_at=order.created_at,
        updated_at=order.updated_at,
        items=[
            OrderItemResponse(
                id=item.id,
                product_name=item.product_name,
                sku=item.sku,
                size=item.size,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
            )
            for item in (order.items or [])
        ],
    )


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    _admin=Depends(require_admin),
):
    """Update order status and push to Salla (admin only)."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
        )

    order = await db.order.find_unique(where={"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update locally
    updated = await db.order.update(
        where={"id": order_id},
        data={"status": body.status},
    )

    # Push to Salla if connected
    salla_synced = False
    if order.salla_order_id:
        salla_synced = await update_salla_order_status(
            order.salla_order_id, body.status, order.awb_number
        )

    return {
        "id": updated.id,
        "status": updated.status,
        "salla_synced": salla_synced,
    }
