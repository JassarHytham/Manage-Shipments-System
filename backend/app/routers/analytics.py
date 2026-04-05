"""Analytics API — shipment counts, return rate, courier breakdown."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from app.database import db
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def _period_start(period: str) -> datetime:
    """Get the start datetime for a period filter."""
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        return now - timedelta(days=7)
    elif period == "month":
        return now - timedelta(days=30)
    # "all" — return epoch
    return datetime(2020, 1, 1, tzinfo=timezone.utc)


@router.get("")
async def get_analytics(
    period: str = Query("month", regex="^(today|week|month|all)$"),
    _user=Depends(get_current_user),
):
    """
    Get analytics summary:
    - Total orders, shipments, deliveries
    - Return count + rate
    - Courier breakdown (Aramex vs SMSA)
    - Handover stats (confirmed, disputed, pending)
    """
    start = _period_start(period)
    date_filter = {"created_at": {"gte": start}}

    # Order counts by status
    total_orders = await db.order.count(where=date_filter)
    shipped = await db.order.count(where={**date_filter, "status": "shipped"})
    delivered = await db.order.count(where={**date_filter, "status": "delivered"})
    pending = await db.order.count(where={**date_filter, "status": "pending"})
    returned = await db.order.count(where={**date_filter, "status": "returned"})
    cancelled = await db.order.count(where={**date_filter, "status": "cancelled"})

    # Return rate
    return_rate = round((returned / total_orders * 100), 1) if total_orders > 0 else 0

    # Courier breakdown
    aramex_count = await db.order.count(where={**date_filter, "courier": "aramex"})
    smsa_count = await db.order.count(where={**date_filter, "courier": "smsa"})
    no_courier = total_orders - aramex_count - smsa_count

    # Handover batch stats
    batch_date_filter = {"handover_time": {"gte": start}}
    total_batches = await db.handoverbatch.count(where=batch_date_filter)
    confirmed_batches = await db.handoverbatch.count(
        where={**batch_date_filter, "status": "confirmed"}
    )
    disputed_batches = await db.handoverbatch.count(
        where={**batch_date_filter, "status": "disputed"}
    )
    pending_batches = await db.handoverbatch.count(
        where={**batch_date_filter, "status": "pending"}
    )

    # Return records count
    return_date_filter = {"created_at": {"gte": start}}
    total_returns = await db.returnrecord.count(where=return_date_filter)
    pending_returns = await db.returnrecord.count(
        where={**return_date_filter, "status": "pending"}
    )
    completed_returns = await db.returnrecord.count(
        where={**return_date_filter, "status": "completed"}
    )

    return {
        "period": period,
        "orders": {
            "total": total_orders,
            "pending": pending,
            "shipped": shipped,
            "delivered": delivered,
            "returned": returned,
            "cancelled": cancelled,
        },
        "return_rate": return_rate,
        "couriers": {
            "aramex": aramex_count,
            "smsa": smsa_count,
            "unassigned": no_courier,
        },
        "handover": {
            "total": total_batches,
            "confirmed": confirmed_batches,
            "disputed": disputed_batches,
            "pending": pending_batches,
        },
        "returns": {
            "total": total_returns,
            "pending": pending_returns,
            "completed": completed_returns,
        },
    }
