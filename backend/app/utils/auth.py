import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from app.models import User
from app.utils.logger import logger

def hash_password(password: str) -> str:
    """Hashes a plaintext password using bcrypt with automatic salt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Creates and signs a JWT access token with an expiration timestamp."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a JWT token.
    Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError if invalid.
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

# Seeded Demo User Credentials
DEMO_USERS = [
    {
        "username": "admin",
        "password": "Admin@Trade2026!",
        "role": "ADMIN",
    },
    {
        "username": "trader",
        "password": "Trader@Trade2026!",
        "role": "USER",
    },
]

def seed_default_users(db: Session) -> None:
    """
    Seeds default test/demo accounts if they do not already exist in the database.
    Prints credentials to console on creation.
    """
    created_any = False
    for user_info in DEMO_USERS:
        existing = db.query(User).filter(User.username == user_info["username"]).first()
        if not existing:
            user = User(
                username=user_info["username"],
                hashed_password=hash_password(user_info["password"]),
                role=user_info["role"],
            )
            db.add(user)
            db.commit()
            created_any = True
            logger.info(
                f"[SEED] Created default {user_info['role']} account -> Username: '{user_info['username']}' | Password: '{user_info['password']}'"
            )

    if created_any:
        print("\n=======================================================")
        print("  DEMO USER ACCOUNTS SEEDED IN DATABASE:")
        for u in DEMO_USERS:
            print(f"  - Role: {u['role']:<5} | Username: {u['username']:<8} | Password: {u['password']}")
        print("=======================================================\n")
    else:
        logger.info("Demo user accounts already present in database.")
