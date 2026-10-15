import os
from pathlib import Path
from typing import Dict, Any

# Base Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "trade_data.db"
DEFAULT_CSV_PATH = RAW_DATA_DIR / "TradeData_8_20_2026_11_4_38.csv"

# Ensure data directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_env_file():
    """Auto-load key-value pairs from .env in project root if present."""
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        os.environ[k] = v
        except Exception:
            pass


load_env_file()


def get_smtp_config() -> Dict[str, Any]:
    """Returns current SMTP settings from environment with dynamic reload."""
    load_env_file()
    host = os.getenv("SMTP_HOST", "").strip()
    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError:
        port = 587
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_email = os.getenv("SMTP_FROM", "briefings@globaltrade.analytics").strip()
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")

    return {
        "is_configured": bool(host),
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "from_email": from_email,
        "use_tls": use_tls,
    }


def update_smtp_config(
    host: str,
    port: int,
    user: str,
    password: str,
    from_email: str,
    use_tls: bool = True,
):
    """Updates SMTP environment variables and persists them to .env file."""
    os.environ["SMTP_HOST"] = host.strip()
    os.environ["SMTP_PORT"] = str(port)
    os.environ["SMTP_USER"] = user.strip()
    if password.strip():
        os.environ["SMTP_PASSWORD"] = password.strip()
    os.environ["SMTP_FROM"] = from_email.strip()
    os.environ["SMTP_USE_TLS"] = "true" if use_tls else "false"

    lines = []
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except Exception:
            lines = []

    config_keys = {
        "SMTP_HOST": host.strip(),
        "SMTP_PORT": str(port),
        "SMTP_USER": user.strip(),
        "SMTP_FROM": from_email.strip(),
        "SMTP_USE_TLS": "true" if use_tls else "false",
    }
    if password.strip():
        config_keys["SMTP_PASSWORD"] = password.strip()

    new_lines = []
    seen = set()
    for line in lines:
        matched = False
        for k in config_keys:
            if line.strip().startswith(f"{k}="):
                new_lines.append(f"{k}={config_keys[k]}\n")
                seen.add(k)
                matched = True
                break
        if not matched:
            new_lines.append(line)

    for k, v in config_keys.items():
        if k not in seen:
            new_lines.append(f"{k}={v}\n")

    try:
        with open(ENV_FILE, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception:
        pass


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
