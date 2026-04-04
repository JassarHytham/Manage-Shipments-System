from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ReturnedItem(BaseModel):
    sku: str
    size: Optional[str] = None
    quantity: int


class ReplacementItem(BaseModel):
    sku: str
    new_size: str
    quantity: int


class CreateReturnRequest(BaseModel):
    original_order_id: str
    return_type: str  # replacement_same, replacement_different_size, refund
    return_reason: Optional[str] = None
    returned_items: List[ReturnedItem]
    replacement_items: Optional[List[ReplacementItem]] = None
    refund_amount: Optional[float] = None


class ReturnResponse(BaseModel):
    id: str
    original_order_id: str
    returned_by: str
    returned_by_name: Optional[str] = None
    return_type: str
    return_reason: Optional[str] = None
    returned_items: list
    replacement_items: Optional[list] = None
    refund_amount: Optional[float] = None
    new_order_id: Optional[str] = None
    status: str
    salla_synced: bool
    created_at: datetime
    updated_at: datetime
    # Joined fields
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    salla_order_id: Optional[str] = None


class ReturnDetailResponse(ReturnResponse):
    original_order: Optional[dict] = None


class ReturnListResponse(BaseModel):
    returns: List[ReturnResponse]
    total: int
    page: int
    per_page: int
