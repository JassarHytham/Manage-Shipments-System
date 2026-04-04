"""Handover batch API — scan AWBs, confirm handover, reconciliation."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import db
from app.middleware.auth import get_current_user, require_admin
from app.schemas.handover import (
    BatchListResponse,
    ConfirmBatchRequest,
    CreateBatchRequest,
    HandoverBatchDetailResponse,
    HandoverBatchResponse,
    HandoverItemResponse,
    ScanAWBRequest,
    ScanResultResponse,
)

router = APIRouter(prefix="/handover", tags=["Handover"])

VALID_COURIERS = {"aramex", "smsa"}


@router.post("/batch", response_model=HandoverBatchResponse, status_code=201)
async def create_batch(body: CreateBatchRequest, user=Depends(get_current_user)):
    """Start a new handover batch for a courier."""
    if body.courier not in VALID_COURIERS:
        raise HTTPException(status_code=400, detail="Courier must be 'aramex' or 'smsa'")

    batch = await db.handoverbatch.create(
        data={
            "courier": body.courier,
            "handed_by": user.id,
            "your_count": 0,
            "status": "pending",
        },
        include={"handed_by_user": True},
    )

    return _batch_response(batch)


@router.post("/batch/{batch_id}/scan", response_model=ScanResultResponse)
async def scan_awb(batch_id: str, body: ScanAWBRequest, user=Depends(get_current_user)):
    """Scan an AWB barcode and add to batch."""
    batch = await db.handoverbatch.find_unique(where={"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status != "pending":
        raise HTTPException(status_code=400, detail="Batch is already confirmed/disputed")

    awb = body.awb_number.strip()
    if not awb:
        raise HTTPException(status_code=400, detail="AWB number is required")

    # Check for duplicate scan in this batch
    existing = await db.handoveritem.find_first(
        where={"batch_id": batch_id, "awb_number": awb}
    )
    if existing:
        return ScanResultResponse(
            success=False,
            message="تم مسح هذا الباركود مسبقاً في هذه الدفعة",
            your_count=batch.your_count,
        )

    # Find order by AWB
    order = await db.order.find_first(where={"awb_number": awb})
    if not order:
        return ScanResultResponse(
            success=False,
            message=f"لم يتم العثور على طلب بهذا الرقم: {awb}",
            your_count=batch.your_count,
        )

    # Check courier matches
    if order.courier and order.courier != batch.courier:
        return ScanResultResponse(
            success=False,
            message=f"هذا الطلب تابع لـ {order.courier} وليس {batch.courier}",
            your_count=batch.your_count,
        )

    # Add item to batch
    item = await db.handoveritem.create(
        data={
            "batch_id": batch_id,
            "order_id": order.id,
            "awb_number": awb,
        }
    )

    # Update count
    new_count = batch.your_count + 1
    await db.handoverbatch.update(
        where={"id": batch_id},
        data={"your_count": new_count},
    )

    return ScanResultResponse(
        success=True,
        message="تم إضافة الشحنة بنجاح",
        item=HandoverItemResponse(
            id=item.id,
            order_id=order.id,
            awb_number=awb,
            scanned_at=item.scanned_at,
            customer_name=order.customer_name,
            customer_city=order.customer_city,
            total_amount=float(order.total_amount),
        ),
        your_count=new_count,
    )


@router.post("/batch/{batch_id}/confirm", response_model=HandoverBatchDetailResponse)
async def confirm_batch(
    batch_id: str, body: ConfirmBatchRequest, user=Depends(get_current_user)
):
    """Confirm handover — enter courier count, flag mismatch if different."""
    batch = await db.handoverbatch.find_unique(where={"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status != "pending":
        raise HTTPException(status_code=400, detail="Batch is already confirmed/disputed")

    new_status = "confirmed" if body.courier_count == batch.your_count else "disputed"

    updated = await db.handoverbatch.update(
        where={"id": batch_id},
        data={
            "courier_count": body.courier_count,
            "status": new_status,
            "notes": body.notes,
        },
        include={
            "handed_by_user": True,
            "items": {"include": {"order": True}},
        },
    )

    # If confirmed and courier is aramex, update order statuses to shipped
    if new_status == "confirmed":
        items = await db.handoveritem.find_many(where={"batch_id": batch_id})
        for item in items:
            await db.order.update(
                where={"id": item.order_id},
                data={"status": "shipped"},
            )

    return _batch_detail_response(updated)


@router.get("/batches", response_model=BatchListResponse)
async def list_batches(
    status_filter: Optional[str] = Query(None, alias="status"),
    courier: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _user=Depends(get_current_user),
):
    """List all handover batches with mismatch flags."""
    where = {}
    if status_filter and status_filter in {"pending", "confirmed", "disputed"}:
        where["status"] = status_filter
    if courier and courier in VALID_COURIERS:
        where["courier"] = courier

    total = await db.handoverbatch.count(where=where)
    batches = await db.handoverbatch.find_many(
        where=where,
        skip=(page - 1) * per_page,
        take=per_page,
        order={"handover_time": "desc"},
        include={"handed_by_user": True},
    )

    return BatchListResponse(
        batches=[_batch_response(b) for b in batches],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/batch/{batch_id}", response_model=HandoverBatchDetailResponse)
async def get_batch(batch_id: str, _user=Depends(get_current_user)):
    """Get full batch detail with all scanned AWBs."""
    batch = await db.handoverbatch.find_unique(
        where={"id": batch_id},
        include={
            "handed_by_user": True,
            "items": {"include": {"order": True}},
        },
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    return _batch_detail_response(batch)


@router.patch("/batch/{batch_id}/resolve")
async def resolve_dispute(
    batch_id: str,
    notes: Optional[str] = None,
    _admin=Depends(require_admin),
):
    """Resolve a disputed batch (admin only)."""
    batch = await db.handoverbatch.find_unique(where={"id": batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    if batch.status != "disputed":
        raise HTTPException(status_code=400, detail="Batch is not disputed")

    updated = await db.handoverbatch.update(
        where={"id": batch_id},
        data={
            "status": "confirmed",
            "notes": (batch.notes or "") + ("\n[تم الحل] " + notes if notes else "\n[تم الحل]"),
        },
    )
    return {"id": updated.id, "status": updated.status}


def _batch_response(batch) -> HandoverBatchResponse:
    mismatch = (
        batch.courier_count is not None
        and batch.courier_count != batch.your_count
    )
    return HandoverBatchResponse(
        id=batch.id,
        courier=batch.courier,
        handed_by=batch.handed_by,
        handed_by_name=batch.handed_by_user.name if hasattr(batch, "handed_by_user") and batch.handed_by_user else None,
        handover_time=batch.handover_time,
        your_count=batch.your_count,
        courier_count=batch.courier_count,
        status=batch.status,
        notes=batch.notes,
        mismatch=mismatch,
    )


def _batch_detail_response(batch) -> HandoverBatchDetailResponse:
    resp = _batch_response(batch)
    items = []
    if hasattr(batch, "items") and batch.items:
        for item in batch.items:
            order = item.order if hasattr(item, "order") else None
            items.append(
                HandoverItemResponse(
                    id=item.id,
                    order_id=item.order_id,
                    awb_number=item.awb_number,
                    scanned_at=item.scanned_at,
                    customer_name=order.customer_name if order else None,
                    customer_city=order.customer_city if order else None,
                    total_amount=float(order.total_amount) if order else None,
                )
            )
    return HandoverBatchDetailResponse(**resp.model_dump(), items=items)
