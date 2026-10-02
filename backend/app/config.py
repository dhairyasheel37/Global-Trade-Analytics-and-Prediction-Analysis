import os
from pathlib import Path

# Base Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "trade_data.db"
DEFAULT_CSV_PATH = RAW_DATA_DIR / "TradeData_8_20_2026_11_4_38.csv"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Database Configuration
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

# Authentication & Security Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "global_trade_system_super_secret_jwt_key_2026_secure")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Expected Columns Specification
REQUIRED_COLUMNS = [
    "refYear",
    "reporterISO",
    "reporterDesc",
    "partnerISO",
    "partnerDesc",
    "flowCode",
    "flowDesc",
    "cmdCode",
    "cmdDesc",
    "primaryValue",
    "fobvalue",
    "cifvalue",
    "netWgt",
    "grossWgt",
    "qty",
]

NUMERIC_COLUMNS = [
    "primaryValue",
    "fobvalue",
    "cifvalue",
    "netWgt",
    "grossWgt",
    "qty",
    "tradeValue",
]
