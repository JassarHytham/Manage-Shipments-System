"""Shipment creation — create AWBs via SMSA or Aramex."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.database import db
from app.middleware.auth import get_current_user
from app.schemas.shipment import CreateShipmentRequest, CreateShipmentResponse
from app.services import aramex, smsa

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/shipments", tags=["Shipments"])


@router.post("/create", response_model=CreateShipmentResponse)
async def create_shipment(body: CreateShipmentRequest, _user=Depends(get_current_user)):
    """
    Create a shipment (waybill) for an order via SMSA or Aramex.

    - Auto-fills consignee from order data; fields can be overridden.
    - For 'return' type, shipper/consignee are swapped (customer ships back).
    - Saves the AWB number to the order record.
    """
    if body.courier not in ("aramex", "smsa"):
        raise HTTPException(status_code=400, detail="شركة الشحن يجب أن تكون aramex أو smsa")

    # Load order
    order = await db.order.find_unique(where={"id": body.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")

    # Build consignee from order, allow overrides
    consignee_name = body.consignee_name or order.customer_name
    consignee_phone = body.consignee_phone or order.customer_phone
    consignee_city = body.consignee_city or order.customer_city
    consignee_address = body.consignee_address or order.customer_address or ""
    if not consignee_address:
        # Build from district if available
        parts = []
        if body.consignee_district or order.customer_district:
            parts.append(body.consignee_district or order.customer_district or "")
        if body.consignee_postal_code or order.customer_postal_code:
            parts.append(body.consignee_postal_code or order.customer_postal_code or "")
        consignee_address = ", ".join(p for p in parts if p) or consignee_city

    # Shipper = store
    shipper_name = settings.SHIPPER_NAME
    shipper_phone = settings.SHIPPER_PHONE
    shipper_city = settings.SHIPPER_CITY
    shipper_address = settings.SHIPPER_ADDRESS or settings.SHIPPER_CITY

    # For return shipments, swap shipper and consignee
    if body.shipment_type == "return":
        shipper_name, consignee_name = consignee_name, shipper_name
        shipper_phone, consignee_phone = consignee_phone, shipper_phone
        shipper_city, consignee_city = consignee_city, shipper_city
        shipper_address, consignee_address = consignee_address, shipper_address

    reference = order.salla_order_id or order.id

    if body.courier == "smsa":
        if not smsa.is_configured():
            raise HTTPException(status_code=400, detail="بيانات SMSA غير مكتملة")
        result = await smsa.create_shipment(
            consignee_name=consignee_name,
            consignee_phone=consignee_phone,
            consignee_city=consignee_city,
            consignee_address=consignee_address,
            shipper_name=shipper_name,
            shipper_phone=shipper_phone,
            shipper_city=shipper_city,
            shipper_address=shipper_address,
            weight=body.weight,
            num_pieces=body.num_pieces,
            description=body.description,
            cod_amount=body.cod_amount,
            reference=reference,
        )
    else:
        if not aramex.is_configured():
            raise HTTPException(status_code=400, detail="بيانات Aramex غير مكتملة")
        result = await aramex.create_shipment(
            consignee_name=consignee_name,
            consignee_phone=consignee_phone,
            consignee_city=consignee_city,
            consignee_address=consignee_address,
            shipper_name=shipper_name,
            shipper_phone=shipper_phone,
            shipper_city=shipper_city,
            shipper_address=shipper_address,
            weight=body.weight,
            num_pieces=body.num_pieces,
            description=body.description,
            cod_amount=body.cod_amount,
            reference=reference,
        )

    if result.get("success"):
        # Save AWB and courier to order
        await db.order.update(
            where={"id": order.id},
            data={
                "awb_number": result["awb_number"],
                "courier": body.courier,
                "status": "shipped" if body.shipment_type == "send" else order.status,
            },
        )
        logger.info(f"Shipment created: AWB {result['awb_number']} for order {order.id}")

    return CreateShipmentResponse(
        success=result.get("success", False),
        awb_number=result.get("awb_number"),
        label_url=result.get("label_url"),
        error=result.get("error"),
    )


@router.get("/config")
async def get_shipment_config(_user=Depends(get_current_user)):
    """Return available couriers and shipper info for the frontend."""
    return {
        "couriers": {
            "smsa": {"configured": smsa.is_configured(), "label": "SMSA Express"},
            "aramex": {"configured": aramex.is_configured(), "label": "أرامكس"},
        },
        "shipper": {
            "name": settings.SHIPPER_NAME,
            "phone": settings.SHIPPER_PHONE,
            "city": settings.SHIPPER_CITY,
            "address": settings.SHIPPER_ADDRESS,
        },
    }
