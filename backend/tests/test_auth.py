import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, SessionLocal
from app.utils.auth import seed_default_users, create_access_token
from app.models import User

@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    db = SessionLocal()
    seed_default_users(db)
    db.close()

@pytest.fixture
def client():
    return TestClient(app)

# Helper functions to obtain tokens
def get_token(client: TestClient, username: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_admin_success(client):
    """Can log in as ADMIN with seeded credentials."""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Admin@Trade2026!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "ADMIN"


def test_login_user_success(client):
    """Can log in as USER with seeded credentials."""
    response = client.post(
        "/api/auth/login",
        json={"username": "trader", "password": "Trader@Trade2026!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "trader"
    assert data["user"]["role"] == "USER"


def test_login_wrong_password_generic_error(client):
    """Wrong password must return 401 with generic 'Invalid username or password'."""
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "WRONG_PASSWORD"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_login_nonexistent_user_generic_error(client):
    """Non-existent username must return the exact same generic 401 error message."""
    response = client.post(
        "/api/auth/login",
        json={"username": "non_existent_user_xyz", "password": "AnyPassword123!"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_auth_me_with_valid_token(client):
    """GET /api/auth/me returns current user identity with valid token."""
    token = get_token(client, "trader", "Trader@Trade2026!")
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "trader"
    assert data["role"] == "USER"


def test_auth_me_unauthenticated(client):
    """GET /api/auth/me returns 401 when no token is supplied."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "Authentication token required." in response.json()["detail"]


def test_auth_me_expired_token(client):
    """Expired token returns 401 with 'Token has expired' message."""
    # Create token expired 10 minutes ago
    expired_token = create_access_token(
        data={"sub": "admin", "role": "ADMIN"},
        expires_delta=timedelta(minutes=-10),
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_auth_me_malformed_token(client):
    """Malformed token returns 401 with clear message, not a raw stack trace."""
    headers = {"Authorization": "Bearer malformed.invalid.token"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


def test_admin_ping_as_admin_returns_200(client):
    """GET /api/admin/ping returns 200 for ADMIN role."""
    admin_token = get_token(client, "admin", "Admin@Trade2026!")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/admin/ping", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Admin access granted."
    assert data["admin_user"] == "admin"
    assert data["role"] == "ADMIN"


def test_admin_ping_as_user_returns_403(client):
    """
    CRITICAL ACCEPTANCE CRITERIA:
    Directly hitting the admin endpoint as a USER role must return 403 Forbidden
    with detail 'Admin access required.'
    """
    user_token = get_token(client, "trader", "Trader@Trade2026!")
    headers = {"Authorization": f"Bearer {user_token}"}
    response = client.get("/api/admin/ping", headers=headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required."


def test_admin_ping_unauthenticated_returns_401(client):
    """GET /api/admin/ping without token returns 401."""
    response = client.get("/api/admin/ping")
    assert response.status_code == 401


def test_logout_endpoint(client):
    """POST /api/auth/logout returns success message."""
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json()["message"] == "Logged out successfully"


def test_phase1_endpoints_remain_functional(client):
    """Verify Phase 1 endpoints are completely intact and working."""
    # /api/health
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"
    assert res_health.json()["total_records"] == 3925

    # /api/data/summary
    res_summary = client.get("/api/data/summary")
    assert res_summary.status_code == 200
    assert res_summary.json()["total_records"] == 3925
    assert res_summary.json()["unique_counts"]["reporters"] == 190

    # /api/data/sample
    res_sample = client.get("/api/data/sample?limit=5")
    assert res_sample.status_code == 200
    assert len(res_sample.json()["records"]) == 5
