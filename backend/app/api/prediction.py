from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, or_

from app.database import get_db
from app.models import TradeRecordV2, Country, Product, User
from app.dependencies import get_current_user
from app.query_helpers import (
    get_trade_v2_base_query,
    ReporterCountry,
    PartnerCountry,
    ProductEntity,
)
from app.schemas import PredictionRequest, PredictionResponse
from app.ml.prediction import train_and_forecast_pipeline

router = APIRouter(prefix="/prediction", tags=["Machine Learning Prediction"])


def run_prediction_logic(
    reporter: str,
    flow: str,
    forecast_years: int,
    start_year: Optional[int],
    end_year: Optional[int],
    db: Session,
) -> PredictionResponse:
    if not reporter or not reporter.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reporter country is required for trade prediction.",
        )

    flow_clean = flow.strip().upper() if flow else "X"
    if flow_clean not in ["X", "M", "TOTAL"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Flow must be 'X' (Exports), 'M' (Imports), or 'TOTAL'.",
        )

    if forecast_years < 1 or forecast_years > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forecast horizon must be between 1 and 5 years.",
        )

    # Check reporter existence
    rep_clean = reporter.strip()
    c_obj = (
        db.query(Country)
        .filter(or_(Country.iso_code == rep_clean, Country.country_name == rep_clean))
        .first()
    )
    if not c_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or unknown reporter country: '{reporter}'",
        )

    reporter_iso = c_obj.iso_code
    reporter_name = c_obj.country_name
    flow_desc = "Exports (X)" if flow_clean == "X" else "Imports (M)" if flow_clean == "M" else "Total Trade"

    # Query annual observations using default World/TOTAL aggregate series
    flow_param = flow_clean if flow_clean in ["X", "M"] else None
    base_query = get_trade_v2_base_query(
        db,
        reporter=rep_clean,
        flow=flow_param,
        start_year=start_year,
        end_year=end_year,
    )

    rows = (
        base_query.with_entities(
            TradeRecordV2.year.label("year"),
            func.coalesce(func.sum(TradeRecordV2.primary_value), 0.0).label("value"),
        )
        .group_by(TradeRecordV2.year)
        .order_by(TradeRecordV2.year.asc())
        .all()
    )

    raw_data = [{"year": int(r.year), "value": float(r.value or 0.0)} for r in rows]

    pipeline_res = train_and_forecast_pipeline(raw_data, forecast_horizon=forecast_years)

    if not pipeline_res["success"]:
        return PredictionResponse(
            reporter=reporter_iso,
            reporter_name=reporter_name,
            flow=flow_clean,
            flow_desc=flow_desc,
            usable_observations=pipeline_res.get("usable_observations", 0),
            required_observations=8,
            training_years=[],
            test_years=[],
            best_model="none",
            baseline_mae=0.0,
            low_confidence_warning=None,
            historical_series=[{"year": d["year"], "actual": d["value"]} for d in raw_data],
            models={},
            reliability_note="Insufficient historical observations were available to train time-series models for this country.",
            success=False,
            error_message=pipeline_res.get("error_message", "Insufficient historical data for reliable prediction."),
        )

    return PredictionResponse(
        reporter=reporter_iso,
        reporter_name=reporter_name,
        flow=flow_clean,
        flow_desc=flow_desc,
        usable_observations=pipeline_res["usable_observations"],
        required_observations=pipeline_res["required_observations"],
        training_years=pipeline_res["training_years"],
        test_years=pipeline_res["test_years"],
        best_model=pipeline_res["best_model"],
        baseline_mae=pipeline_res["baseline_mae"],
        low_confidence_warning=pipeline_res["low_confidence_warning"],
        historical_series=pipeline_res["historical_series"],
        models=pipeline_res["models"],
        reliability_note=pipeline_res["reliability_note"],
        success=True,
        error_message=None,
    )


@router.get("/predict", response_model=PredictionResponse)
def get_prediction(
    reporter: str = Query(..., description="Reporter country ISO or name"),
    flow: str = Query("X", description="Flow code: 'X', 'M', or 'TOTAL'"),
    forecast_years: int = Query(3, ge=1, le=5, description="Forecast horizon (1 to 5 years)"),
    start_year: Optional[int] = Query(None),
    end_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluates ML models and generates multi-step future projections for a country's trade flow.
    """
    return run_prediction_logic(reporter, flow, forecast_years, start_year, end_year, db)


@router.post("/predict", response_model=PredictionResponse)
def post_prediction(
    payload: PredictionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    POST endpoint for trade forecasting with request body payload.
    """
    return run_prediction_logic(
        reporter=payload.reporter,
        flow=payload.flow,
        forecast_years=payload.forecast_years,
        start_year=payload.start_year,
        end_year=payload.end_year,
        db=db,
    )
