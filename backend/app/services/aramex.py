"""Aramex Shipping API integration — shipment creation + tracking."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _client_info() -> dict:
    """Build Aramex ClientInfo block used in all API calls."""
    return {
        "UserName": settings.ARAMEX_USERNAME,
        "Password": settings.ARAMEX_PASSWORD,
        "AccountNumber": settings.ARAMEX_ACCOUNT_NUMBER,
        "AccountPin": settings.ARAMEX_ACCOUNT_PIN,
        "AccountEntity": settings.ARAMEX_ACCOUNT_ENTITY,
        "AccountCountryCode": settings.ARAMEX_ACCOUNT_COUNTRY_CODE,
        "Version": "v1",
    }


def is_configured() -> bool:
    """Check if Aramex credentials are set."""
    return bool(
        settings.ARAMEX_USERNAME
        and settings.ARAMEX_PASSWORD
        and settings.ARAMEX_ACCOUNT_NUMBER
    )


async def create_shipment(
    *,
    shipper_name: str,
    shipper_phone: str,
    shipper_city: str,
    shipper_address: str,
    shipper_country: str = "SA",
    consignee_name: str,
    consignee_phone: str,
    consignee_city: str,
    consignee_address: str,
    consignee_country: str = "SA",
    weight: float = 0.5,
    num_pieces: int = 1,
    product_type: str = "DOM",
    description: str = "Shipment",
    cod_amount: float = 0,
    reference: Optional[str] = None,
) -> dict:
    """
    Create a shipment in Aramex and return the AWB number.

    Returns dict with:
      - success: bool
      - awb_number: str (if success)
      - error: str (if failed)
    """
    if not is_configured():
        return {"success": False, "error": "Aramex credentials not configured"}

    payload = {
        "ClientInfo": _client_info(),
        "LabelInfo": {"ReportID": 9201, "ReportType": "URL"},
        "Shipments": [
            {
                "Reference1": reference or "",
                "Shipper": {
                    "Reference1": reference or "",
                    "AccountNumber": settings.ARAMEX_ACCOUNT_NUMBER,
                    "PartyAddress": {
                        "Line1": shipper_address,
                        "City": shipper_city,
                        "CountryCode": shipper_country,
                    },
                    "Contact": {
                        "PersonName": shipper_name,
                        "PhoneNumber1": shipper_phone,
                        "CellPhone": shipper_phone,
                    },
                },
                "Consignee": {
                    "Reference1": reference or "",
                    "PartyAddress": {
                        "Line1": consignee_address,
                        "City": consignee_city,
                        "CountryCode": consignee_country,
                    },
                    "Contact": {
                        "PersonName": consignee_name,
                        "PhoneNumber1": consignee_phone,
                        "CellPhone": consignee_phone,
                    },
                },
                "ShippingDateTime": f"/Date({int(__import__('time').time() * 1000)})/",
                "DueDate": f"/Date({int(__import__('time').time() * 1000) + 86400000})/",
                "Details": {
                    "Dimensions": None,
                    "ActualWeight": {"Unit": "KG", "Value": weight},
                    "ProductGroup": "EXP" if consignee_country != "SA" else "DOM",
                    "ProductType": product_type,
                    "PaymentType": "P",
                    "PaymentOptions": "",
                    "Services": "",
                    "NumberOfPieces": num_pieces,
                    "DescriptionOfGoods": description,
                    "GoodsOriginCountry": "SA",
                    "CashOnDeliveryAmount": {
                        "CurrencyCode": "SAR",
                        "Value": cod_amount,
                    } if cod_amount > 0 else None,
                },
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ARAMEX_API_URL}/Shipping/Service_1_0.svc/json/CreateShipments",
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("HasErrors"):
            notifications = data.get("Notifications", [])
            error_msg = "; ".join(n.get("Message", "") for n in notifications)
            logger.error(f"Aramex create shipment error: {error_msg}")
            return {"success": False, "error": error_msg}

        shipments = data.get("Shipments", [])
        if shipments:
            awb = shipments[0].get("ID", "")
            label_url = shipments[0].get("ShipmentLabel", {}).get("LabelURL", "")
            return {
                "success": True,
                "awb_number": awb,
                "label_url": label_url,
            }

        return {"success": False, "error": "No shipment returned from Aramex"}

    except httpx.HTTPError as e:
        logger.error(f"Aramex API HTTP error: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Aramex API error: {e}")
        return {"success": False, "error": str(e)}


async def track_shipment(awb_number: str) -> dict:
    """
    Track a shipment by AWB number.

    Returns dict with:
      - success: bool
      - tracking: list of events (if success)
      - last_status: str
      - error: str (if failed)
    """
    if not is_configured():
        return {"success": False, "error": "Aramex credentials not configured"}

    payload = {
        "ClientInfo": _client_info(),
        "GetLastTrackingUpdateOnly": False,
        "Shipments": [awb_number],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.ARAMEX_API_URL}/Tracking/Service_1_0.svc/json/TrackShipments",
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        if data.get("HasErrors"):
            notifications = data.get("Notifications", [])
            error_msg = "; ".join(n.get("Message", "") for n in notifications)
            return {"success": False, "error": error_msg}

        results = data.get("TrackingResults", [])
        if not results:
            return {"success": False, "error": "No tracking data found"}

        tracking_result = results[0]
        events = []
        last_status = ""

        for event in tracking_result.get("Value", []):
            update_code = event.get("UpdateCode", "")
            update_desc = event.get("UpdateDescription", "")
            update_location = event.get("UpdateLocation", "")
            update_date = event.get("UpdateDateTime", "")

            events.append({
                "code": update_code,
                "description": update_desc,
                "location": update_location,
                "datetime": update_date,
            })
            if not last_status:
                last_status = update_desc

        return {
            "success": True,
            "awb_number": awb_number,
            "tracking": events,
            "last_status": last_status,
        }

    except httpx.HTTPError as e:
        logger.error(f"Aramex tracking HTTP error: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Aramex tracking error: {e}")
        return {"success": False, "error": str(e)}


def map_aramex_status(update_code: str) -> Optional[str]:
    """Map Aramex tracking update codes to our OrderStatus."""
    delivered_codes = {"SH005", "SH006", "SH069", "SH227"}
    shipped_codes = {"SH003", "SH004", "SH014", "SH028", "SH044"}
    returned_codes = {"SH062", "SH160", "SH161", "SH162"}

    if update_code in delivered_codes:
        return "delivered"
    elif update_code in shipped_codes:
        return "shipped"
    elif update_code in returned_codes:
        return "returned"
    return None
