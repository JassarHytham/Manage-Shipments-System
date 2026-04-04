"""Returns API — create, list, detail, ship replacement, sync to Salla."""
from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from prisma import Json

from app.database import db
from app.middleware.auth import get_current_user, require_admin
from app.schemas.returns import (
    CreateReturnRequest,
    ReturnDetailResponse,
    ReturnListResponse,
    ReturnResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/returns", tags=["Returns"])

VALID_RETURN_TYPES = {"replacement_same", "replacement_different_size", "refund"}
VALID_STATUSES = {"pending", "replacement_shipped", "refunded", "completed"}


@router.post("", response_model=ReturnResponse, status_code=201)
async def create_return(body: CreateReturnRequest, user=Depends(get_current_user)):
    """Create a return — accepts return_type, items, refund_amount."""
    if body.return_type not in VALID_RETURN_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"return_type must be one of: {', '.join(VALID_RETURN_TYPES)}",
        )

    # Verify order exists
    order = await db.order.find_unique(
        where={"id": body.original_order_id},
        include={"items": True},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Validate refund amount for refund type
    if body.return_type == "refund":
        if body.refund_amount is None or body.refund_amount <= 0:
            raise HTTPException(status_code=400, detail="Refund amount is required for refund returns")
        # Operators cannot process refunds
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can process refunds")

    # Validate replacement items for different size
    if body.return_type == "replacement_different_size":
        if not body.replacement_items or len(body.replacement_items) == 0:
            raise HTTPException(
                status_code=400,
                detail="Replacement items with new sizes are required for size exchanges",
            )

    returned_items_list = [item.model_dump() for item in body.returned_items]
    replacement_items_list = (
        [item.model_dump() for item in body.replacement_items]
        if body.replacement_items
        else None
    )

    create_data: dict = {
        "original_order": {"connect": {"id": body.original_order_id}},
        "returned_by_user": {"connect": {"id": user.id}},
        "return_type": body.return_type,
        "return_reason": body.return_reason,
        "returned_items": Json(returned_items_list),
        "refund_amount": body.refund_amount,
        "status": "pending",
        "salla_synced": False,
    }
    if replacement_items_list is not None:
        create_data["replacement_items"] = Json(replacement_items_list)

    return_record = await db.returnrecord.create(
        data=create_data,
        include={
            "returned_by_user": True,
            "original_order": True,
        },
    )

    # Update order status to returned
    await db.order.update(
        where={"id": body.original_order_id},
        data={"status": "returned"},
    )

    return _return_response(return_record)


@router.get("", response_model=ReturnListResponse)
async def list_returns(
    status_filter: Optional[str] = Query(None, alias="status"),
    return_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
):
    """List all returns with original order info."""
    where = {}

    if status_filter and status_filter in VALID_STATUSES:
        where["status"] = status_filter
    if return_type and return_type in VALID_RETURN_TYPES:
        where["return_type"] = return_type
    if search:
        where["original_order"] = {
            "OR": [
                {"customer_name": {"contains": search, "mode": "insensitive"}},
                {"customer_phone": {"contains": search}},
                {"salla_order_id": {"contains": search}},
            ]
        }

    # Hide refund amounts from operators
    total = await db.returnrecord.count(where=where)
    returns = await db.returnrecord.find_many(
        where=where,
        skip=(page - 1) * per_page,
        take=per_page,
        order={"created_at": "desc"},
        include={
            "returned_by_user": True,
            "original_order": True,
        },
    )

    return ReturnListResponse(
        returns=[_return_response(r, hide_refund=(user.role != "admin")) for r in returns],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{return_id}", response_model=ReturnDetailResponse)
async def get_return(return_id: str, user=Depends(get_current_user)):
    """Get full return detail."""
    return_record = await db.returnrecord.find_unique(
        where={"id": return_id},
        include={
            "returned_by_user": True,
            "original_order": {"include": {"items": True}},
        },
    )
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")

    resp = _return_response(return_record, hide_refund=(user.role != "admin"))

    order = return_record.original_order
    original_order_data = None
    if order:
        original_order_data = {
            "id": order.id,
            "salla_order_id": order.salla_order_id,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "customer_city": order.customer_city,
            "total_amount": float(order.total_amount),
            "status": order.status,
            "courier": order.courier,
            "awb_number": order.awb_number,
            "items": [
                {
                    "id": item.id,
                    "product_name": item.product_name,
                    "sku": item.sku,
                    "size": item.size,
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price),
                }
                for item in (order.items or [])
            ],
        }

    return ReturnDetailResponse(
        **resp.model_dump(),
        original_order=original_order_data,
    )


@router.post("/{return_id}/ship-replacement")
async def ship_replacement(return_id: str, _user=Depends(get_current_user)):
    """Mark replacement as shipped. In production, this would create a new Salla order + courier shipment."""
    return_record = await db.returnrecord.find_unique(where={"id": return_id})
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")

    if return_record.return_type == "refund":
        raise HTTPException(status_code=400, detail="Cannot ship replacement for a refund return")

    if return_record.status != "pending":
        raise HTTPException(status_code=400, detail="Return is not in pending status")

    updated = await db.returnrecord.update(
        where={"id": return_id},
        data={"status": "replacement_shipped"},
    )

    logger.info(f"Replacement shipped for return {return_id}")

    return {
        "id": updated.id,
        "status": updated.status,
        "message": "تم تحديث حالة المرتجع إلى: تم شحن البديل",
    }


@router.post("/{return_id}/refund")
async def process_refund(return_id: str, _admin=Depends(require_admin)):
    """Process refund — admin only."""
    return_record = await db.returnrecord.find_unique(where={"id": return_id})
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")

    if return_record.return_type != "refund":
        raise HTTPException(status_code=400, detail="This return is not a refund type")

    if return_record.status != "pending":
        raise HTTPException(status_code=400, detail="Return is not in pending status")

    updated = await db.returnrecord.update(
        where={"id": return_id},
        data={"status": "refunded"},
    )

    return {
        "id": updated.id,
        "status": updated.status,
        "refund_amount": float(updated.refund_amount) if updated.refund_amount else None,
        "message": "تم تأكيد الاسترجاع",
    }


@router.post("/{return_id}/complete")
async def complete_return(return_id: str, _user=Depends(get_current_user)):
    """Mark return as completed."""
    return_record = await db.returnrecord.find_unique(where={"id": return_id})
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")

    if return_record.status not in ("replacement_shipped", "refunded"):
        raise HTTPException(
            status_code=400,
            detail="Return must be shipped or refunded before completing",
        )

    updated = await db.returnrecord.update(
        where={"id": return_id},
        data={"status": "completed"},
    )

    return {"id": updated.id, "status": updated.status}


@router.post("/{return_id}/sync-salla")
async def sync_return_to_salla(return_id: str, _admin=Depends(require_admin)):
    """Push return/refund status to Salla (admin only)."""
    return_record = await db.returnrecord.find_unique(
        where={"id": return_id},
        include={"original_order": True},
    )
    if not return_record:
        raise HTTPException(status_code=404, detail="Return not found")

    if not return_record.original_order or not return_record.original_order.salla_order_id:
        raise HTTPException(status_code=400, detail="Original order has no Salla ID")

    # In production: call Salla API to update order status
    try:
        from app.services.salla import update_salla_order_status

        success = await update_salla_order_status(
            return_record.original_order.salla_order_id,
            "returned",
        )

        if success:
            await db.returnrecord.update(
                where={"id": return_id},
                data={"salla_synced": True},
            )
            return {"synced": True, "message": "تم المزامنة مع سلة بنجاح"}
        else:
            return {"synced": False, "message": "فشل في المزامنة مع سلة"}
    except Exception as e:
        logger.error(f"Salla sync failed for return {return_id}: {e}")
        return {"synced": False, "message": f"خطأ: {str(e)}"}


def _return_response(record, hide_refund: bool = False) -> ReturnResponse:
    order = record.original_order if hasattr(record, "original_order") and record.original_order else None
    user = record.returned_by_user if hasattr(record, "returned_by_user") and record.returned_by_user else None

    refund_amount = None
    if not hide_refund and record.refund_amount is not None:
        refund_amount = float(record.refund_amount)

    return ReturnResponse(
        id=record.id,
        original_order_id=record.original_order_id,
        returned_by=record.returned_by,
        returned_by_name=user.name if user else None,
        return_type=record.return_type,
        return_reason=record.return_reason,
        returned_items=record.returned_items if isinstance(record.returned_items, list) else [],
        replacement_items=record.replacement_items if isinstance(record.replacement_items, list) else None,
        refund_amount=refund_amount,
        new_order_id=record.new_order_id,
        status=record.status,
        salla_synced=record.salla_synced,
        created_at=record.created_at,
        updated_at=record.updated_at,
        customer_name=order.customer_name if order else None,
        customer_phone=order.customer_phone if order else None,
        salla_order_id=order.salla_order_id if order else None,
    )
