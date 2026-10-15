from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.data import router as data_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.dashboard import router as dashboard_router
from app.api.trade_analysis import router as trade_analysis_router
from app.api.country_analysis import router as country_analysis_router
from app.api.country_comparison import router as country_comparison_router
from app.api.product_analysis import router as product_analysis_router
from app.api.trade_balance import router as trade_balance_router
from app.api.prediction import router as prediction_router
from app.api.data_management import router as data_management_router
from app.api.reports import router as reports_router
from app.api.about import router as about_router
from app.api.map import router as map_router
from app.api.economic_metrics import router as economic_metrics_router
from app.api.simulator import router as simulator_router
from app.api.alerts import router as alerts_router
from app.database import init_db, SessionLocal
from app.services.sync_service import sync_service
from app.utils.auth import seed_default_users
from app.utils.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown procedures."""
    logger.info("Initializing Global Trade Analysis Backend Service...")
    init_db()
    
    # Seed default user accounts
    db = SessionLocal()
    try:
        seed_default_users(db)
    finally:
        db.close()

    # Start automated UN Comtrade background sync scheduler
    sync_service.start_scheduler()

    logger.info("Application startup complete.")
    yield
    # Stop background sync scheduler cleanly
    sync_service.stop_scheduler()
    logger.info("Application shutdown.")

app = FastAPI(
    title="Global Trade Analysis & Prediction API",
    description="Data ingestion, validation, cleaning, storage, authentication, analytical dashboard, trade analysis, country profile, product analysis, trade balance, and machine learning prediction layer for global trade data.",
    version="1.12.0",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(health_router, prefix="/api")
app.include_router(data_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(trade_analysis_router, prefix="/api")
app.include_router(country_analysis_router, prefix="/api")
app.include_router(country_comparison_router, prefix="/api")
app.include_router(product_analysis_router, prefix="/api")
app.include_router(trade_balance_router, prefix="/api")
app.include_router(prediction_router, prefix="/api")
app.include_router(data_management_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(about_router, prefix="/api")
app.include_router(map_router, prefix="/api")
app.include_router(economic_metrics_router, prefix="/api")
app.include_router(simulator_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": "Global Trade Analysis and Prediction System API",
        "phase": "Phase 12 - Final System Audit & Full Integration",
        "documentation": "/docs",
        "health_check": "/api/health",
        "data_summary": "/api/data/summary",
        "dashboard_kpis": "/api/dashboard/kpis",
        "prediction_predict": "/api/prediction/predict?reporter=USA&flow=X",
    }
