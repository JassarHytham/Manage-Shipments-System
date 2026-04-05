"""Courier API — tracking endpoints + SMSA webhook receiver."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request

from app.database import db
from app.middleware.auth import get_current_user
from app.services import aramex, smsa
from app.services.salla import update_salla_order_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Courier"])


@router.get("/courier/track/{awb_number}")
async def track_shipment(awb_number: str, _user=Depends(get_current_user)):
    """Track a shipment by AWB — auto-detects courier from order."""
    order = await db.order.find_first(where={"awb_number": awb_number})
    courier_name = order.courier if order else None

    if courier_name == "aramex":
        result = await aramex.track_shipment(awb_number)
    elif courier_name == "smsa":
        result = await smsa.track_shipment(awb_number)
    else:
        # Try both
        result = await aramex.track_shipment(awb_number)
        if not result.get("success"):
            result = await smsa.track_shipment(awb_number)

    if not result.get("success"):
        raise HTTPException(
            status_code=404,
            detail=result.get("error", "لم يتم العثور على معلومات التتبع"),
        )

    return result


@router.get("/courier/status/{awb_number}")
async def get_courier_status(awb_number: str, _user=Depends(get_current_user)):
    """Get current courier status for an AWB and sync to local DB if changed."""
    order = await db.order.find_first(where={"awb_number": awb_number})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    if order.courier == "aramex":
        result = await aramex.track_shipment(awb_number)
        if result.get("success") and result.get("tracking"):
            latest = result["tracking"][0]
            new_status = aramex.map_aramex_status(latest.get("code", ""))
            if new_status and new_status != order.status:
                await _update_order_status(order, new_status)
            return {
                "awb_number": awb_number,
                "courier": "aramex",
                "courier_status": result.get("last_status", ""),
                "our_status": new_status or order.status,
            }
    elif order.courier == "smsa":
        result = await smsa.get_shipment_status(awb_number)
        if result.get("success"):
            new_status = result.get("our_status")
            if new_status and new_status != order.status:
                await _update_order_status(order, new_status)
            return {
                "awb_number": awb_number,
                "courier": "smsa",
                "courier_status": result.get("status", ""),
                "our_status": new_status or order.status,
            }

    return {
        "awb_number": awb_number,
        "courier": order.courier,
        "courier_status": "unknown",
        "our_status": order.status,
    }


@router.post("/webhooks/smsa")
async def smsa_webhook(request: Request):
    """
    Receive SMSA delivery events — auto-updates order status.
    SMSA pushes status updates when shipments are delivered/returned.
    """
    payload = await request.json()
    logger.info(f"SMSA webhook received: {payload}")

    event = smsa.parse_webhook_event(payload)
    if not event:
        return {"received": True, "processed": False}

    order = await db.order.find_first(where={"awb_number": event["awb_number"]})
    if not order:
        logger.warning(f"SMSA webhook for unknown AWB: {event['awb_number']}")
        return {"received": True, "processed": False}

    if event["status"] != order.status:
        await _update_order_status(order, event["status"])
        logger.info(
            f"Order {order.id} status updated via SMSA webhook: "
            f"{order.status} → {event['status']}"
        )

    return {"received": True, "processed": True}


async def _update_order_status(order, new_status: str):
    """Update order status locally and push to Salla."""
    await db.order.update(
        where={"id": order.id},
        data={"status": new_status},
    )
    if order.salla_order_id:
        synced = await update_salla_order_status(
            order.salla_order_id, new_status, order.awb_number
        )
        if synced:
            logger.info(f"Salla synced: {order.salla_order_id} → {new_status}")
