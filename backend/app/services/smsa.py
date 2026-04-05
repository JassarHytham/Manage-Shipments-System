"""SMSA Express API integration — shipment creation, tracking + status mapping."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    """Check if SMSA credentials are set."""
    return bool(settings.SMSA_API_KEY)


def _headers(with_content_type: bool = False) -> dict:
    """Build SMSA API request headers."""
    h = {"ApiKey": settings.SMSA_API_KEY}
    if with_content_type:
        h["Content-Type"] = "application/json"
    return h


async def create_shipment(
    *,
    consignee_name: str,
    consignee_phone: str,
    consignee_city: str,
    consignee_address: str,
    consignee_country: str = "SA",
    shipper_name: str,
    shipper_phone: str,
    shipper_city: str,
    shipper_address: str,
    shipper_country: str = "SA",
    weight: float = 0.5,
    num_pieces: int = 1,
    description: str = "Shipment",
    cod_amount: float = 0,
    declared_value: float = 1,
    reference: Optional[str] = None,
    service_code: str = "EDDL",
) -> dict:
    """
    Create a B2C shipment in SMSA and return the AWB number.

    Returns dict with:
      - success: bool
      - awb_number: str (if success)
      - label_url: str (if success)
      - error: str (if failed)
    """
    if not is_configured():
        return {"success": False, "error": "SMSA credentials not configured"}

    payload = {
        "CODAmount": cod_amount,
        "DeclaredValue": declared_value,
        "OrderNumber": reference or "",
        "Parcels": num_pieces,
        "Weight": weight,
        "WeightUnit": "KG",
        "ShipDate": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        "ShipmentCurrency": "SAR",
        "ServiceCode": service_code,
        "WaybillType": "PDF",
        "Description": description,
        "ConsigneeAddress": {
            "ContactName": consignee_name,
            "ContactPhoneNumber": consignee_phone,
            "City": consignee_city,
            "AddressLine1": consignee_address,
            "Country": consignee_country,
        },
        "ShipperAddress": {
            "ContactName": shipper_name,
            "ContactPhoneNumber": shipper_phone,
            "City": shipper_city,
            "AddressLine1": shipper_address,
            "Country": shipper_country,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.SMSA_API_URL}/api/shipment/b2c/new",
                json=payload,
                headers=_headers(with_content_type=True),
            )
            resp.raise_for_status()
            data = resp.json()

        if isinstance(data, dict) and data.get("error"):
            return {"success": False, "error": data["error"]}

        awb = data.get("sawb", data.get("AWB", ""))
        label = data.get("label", data.get("LabelURL", ""))

        if awb:
            return {
                "success": True,
                "awb_number": str(awb),
                "label_url": label,
            }

        return {"success": False, "error": f"Unexpected response: {data}"}

    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:300] if e.response else str(e)
        logger.error(f"SMSA create shipment HTTP error: {error_body}")
        return {"success": False, "error": error_body}
    except Exception as e:
        logger.error(f"SMSA create shipment error: {e}")
        return {"success": False, "error": str(e)}


async def track_shipment(awb_number: str) -> dict:
    """
    Track a shipment by AWB number via SMSA API.

    Returns dict with:
      - success: bool
      - tracking: list of events (if success)
      - last_status: str
      - error: str (if failed)
    """
    if not is_configured():
        return {"success": False, "error": "SMSA credentials not configured"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.SMSA_API_URL}/api/track/{awb_number}",
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        # SMSA returns tracking as a list of events
        if isinstance(data, dict) and data.get("error"):
            return {"success": False, "error": data["error"]}

        events_raw = data if isinstance(data, list) else data.get("Tracking", data.get("data", []))
        events = []
        last_status = ""

        for event in events_raw:
            activity = event.get("Activity", event.get("activity", ""))
            location = event.get("Location", event.get("location", ""))
            event_date = event.get("Date", event.get("date", ""))

            events.append({
                "description": activity,
                "location": location,
                "datetime": event_date,
            })
            if not last_status:
                last_status = activity

        return {
            "success": True,
            "awb_number": awb_number,
            "tracking": events,
            "last_status": last_status,
        }

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"success": False, "error": f"AWB {awb_number} not found"}
        logger.error(f"SMSA tracking HTTP error: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"SMSA tracking error: {e}")
        return {"success": False, "error": str(e)}


async def get_shipment_status(awb_number: str) -> dict:
    """Get shipment details by querying B2C shipment."""
    if not is_configured():
        return {"success": False, "error": "SMSA credentials not configured"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{settings.SMSA_API_URL}/api/shipment/b2c/query/{awb_number}",
                headers=_headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        status_value = ""
        if isinstance(data, dict):
            status_value = data.get("Status", data.get("status", ""))

        return {
            "success": True,
            "awb_number": awb_number,
            "status": status_value,
            "our_status": map_smsa_status(status_value),
        }

    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:300] if e.response else str(e)
        logger.error(f"SMSA status HTTP error: {error_body}")
        return {"success": False, "error": error_body}
    except Exception as e:
        logger.error(f"SMSA status error: {e}")
        return {"success": False, "error": str(e)}


async def track_bulk(awb_numbers: list) -> dict:
    """Track multiple shipments at once."""
    if not is_configured():
        return {"success": False, "error": "SMSA credentials not configured"}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.SMSA_API_URL}/api/track/bulk/",
                json=awb_numbers,
                headers=_headers(with_content_type=True),
            )
            resp.raise_for_status()
            return {"success": True, "data": resp.json()}

    except Exception as e:
        logger.error(f"SMSA bulk tracking error: {e}")
        return {"success": False, "error": str(e)}


def map_smsa_status(smsa_status: str) -> Optional[str]:
    """Map SMSA status strings/codes to our OrderStatus."""
    status_upper = (smsa_status or "").upper()
    status_lower = (smsa_status or "").lower()

    # Map by SMSA status codes
    code_map = {
        "DL": "delivered",
        "OD": "shipped",
        "OP": "shipped",
        "AF": "shipped",
        "SH": "shipped",
        "CR": "shipped",
        "RT": "returned",
        "RR": "returned",
    }
    if status_upper in code_map:
        return code_map[status_upper]

    # Fallback: map by keyword
    delivered_keywords = ["delivered", "تم التسليم"]
    shipped_keywords = ["out for delivery", "in transit", "shipped", "picked up", "dispatched"]
    returned_keywords = ["returned", "return", "مرتجع"]

    for kw in delivered_keywords:
        if kw in status_lower:
            return "delivered"
    for kw in shipped_keywords:
        if kw in status_lower:
            return "shipped"
    for kw in returned_keywords:
        if kw in status_lower:
            return "returned"

    return None


def parse_webhook_event(payload: dict) -> Optional[dict]:
    """
    Parse SMSA webhook payload and return normalized event.

    Returns dict with:
      - awb_number: str
      - status: str (our OrderStatus)
      - raw_status: str
      - description: str
    Or None if event is not relevant.
    """
    awb = payload.get("awbNo", payload.get("AWBNo", payload.get("trackingNumber", "")))
    raw_status = payload.get("Status", payload.get("status", payload.get("activity", "")))

    if not awb or not raw_status:
        return None

    our_status = map_smsa_status(raw_status)
    if not our_status:
        return None

    return {
        "awb_number": str(awb),
        "status": our_status,
        "raw_status": raw_status,
        "description": payload.get("Activity", payload.get("activity", raw_status)),
    }
