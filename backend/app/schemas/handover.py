from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CreateBatchRequest(BaseModel):
    courier: str  # aramex or smsa


class ScanAWBRequest(BaseModel):
    awb_number: str


class ConfirmBatchRequest(BaseModel):
    courier_count: int
    notes: Optional[str] = None


class HandoverItemResponse(BaseModel):
    id: str
    order_id: str
    awb_number: str
    scanned_at: datetime
    customer_name: Optional[str] = None
    customer_city: Optional[str] = None
    total_amount: Optional[float] = None


class HandoverBatchResponse(BaseModel):
    id: str
    courier: str
    handed_by: str
    handed_by_name: Optional[str] = None
    handover_time: datetime
    your_count: int
    courier_count: Optional[int] = None
    status: str
    notes: Optional[str] = None
    mismatch: bool = False


class HandoverBatchDetailResponse(HandoverBatchResponse):
    items: List[HandoverItemResponse] = []


class BatchListResponse(BaseModel):
    batches: List[HandoverBatchResponse]
    total: int
    page: int
    per_page: int


class ScanResultResponse(BaseModel):
    success: bool
    message: str
    item: Optional[HandoverItemResponse] = None
    your_count: int
