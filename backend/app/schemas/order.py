from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class OrderItemResponse(BaseModel):
    id: str
    product_name: str
    sku: str
    size: Optional[str] = None
    quantity: int
    unit_price: float


class OrderResponse(BaseModel):
    id: str
    salla_order_id: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_city: str
    customer_address: Optional[str] = None
    customer_district: Optional[str] = None
    customer_postal_code: Optional[str] = None
    total_amount: float
    status: str
    courier: Optional[str] = None
    awb_number: Optional[str] = None
    salla_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OrderDetailResponse(OrderResponse):
    items: List[OrderItemResponse] = []


class OrderStatusUpdate(BaseModel):
    status: str  # pending, shipped, delivered, returned, cancelled


class OrderListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    per_page: int
