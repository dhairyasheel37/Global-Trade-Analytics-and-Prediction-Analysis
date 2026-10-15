"""
Scenario Simulator & Tariff Impact Engine API Router.
Provides endpoints for executing what-if trade policy simulations,
retrieving policy presets, and fetching sector price elasticity reference data.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.schemas import (
    SimulationRequest,
    SimulationResult,
    PresetScenario,
    SectorElasticityItem,
)
from app.services.simulation_engine import simulation_engine
from app.utils.logger import logger

router = APIRouter(prefix="/simulator", tags=["Scenario Simulator & Tariff Impact Engine"])


@router.get("/presets", response_model=List[PresetScenario])
def get_preset_scenarios(
    current_user: User = Depends(get_current_user),
) -> List[PresetScenario]:
    """
    Returns curated, high-impact geopolitical and economic shock presets
    (e.g., US-China Section 301, Global Tech contraction, EU CBAM, Indo-US trade deal).
    """
    return simulation_engine.get_presets()


@router.get("/elasticities", response_model=List[SectorElasticityItem])
def get_sector_elasticities(
    current_user: User = Depends(get_current_user),
) -> List[SectorElasticityItem]:
    """
    Returns standard sector-specific price and substitution elasticities
    derived from empirical trade economics literature.
    """
    return simulation_engine.get_sector_elasticities()


@router.post("/run", response_model=SimulationResult)
def run_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SimulationResult:
    """
    Executes an econometric what-if simulation evaluating the impact of
    tariffs, demand shocks, and elasticity parameters on trade flows,
    tariff revenue, trade balance, and partner flow diversions.
    """
    try:
        logger.info(
            f"User '{current_user.username}' running simulation: reporter={request.reporter_iso}, "
            f"partner={request.partner_iso}, tariff={request.tariff_pct}%, demand={request.demand_shock_pct}%"
        )
        result = simulation_engine.run_simulation(db=db, req=request)
        return result
    except Exception as e:
        logger.error(f"Error executing trade simulation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation computation failed: {str(e)}",
        )
