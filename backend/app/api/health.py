from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..database import get_db
from ..models import TradeRecord
from ..schemas import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["System"])
def get_health(db: Session = Depends(get_db)):
    """
    Health check endpoint returning system status and database connectivity.
    """
    db_status = "connected"
    record_count = 0
    try:
        db.execute(text("SELECT 1"))
        record_count = db.query(TradeRecord).count()
    except Exception as e:
        db_status = f"error: {str(e)}"

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        timestamp=datetime.now(timezone.utc),
        database=db_status,
        total_records=record_count,
    )
