from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class CreateShipmentRequest(BaseModel):
    order_id: str
    courier: str  # "aramex" or "smsa"
    shipment_type: str = "send"  # "send" or "return"
    # Consignee overrides (auto-filled from order, editable)
    consignee_name: Optional[str] = None
    consignee_phone: Optional[str] = None
    consignee_city: Optional[str] = None
    consignee_address: Optional[str] = None
    consignee_district: Optional[str] = None
    consignee_postal_code: Optional[str] = None
    # Shipment details
    weight: float = 0.5
    num_pieces: int = 1
    description: str = "Shipment"
    cod_amount: float = 0


class CreateShipmentResponse(BaseModel):
    success: bool
    awb_number: Optional[str] = None
    label_url: Optional[str] = None
    error: Optional[str] = None
