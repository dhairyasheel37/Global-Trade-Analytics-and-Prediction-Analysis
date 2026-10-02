from fastapi import APIRouter, Depends
from app.models import User
from app.schemas import AdminPingResponse
from app.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/ping", response_model=AdminPingResponse)
def admin_ping(admin: User = Depends(require_admin)):
    """
    Protected admin-only verification endpoint.
    Returns 200 for ADMIN role.
    Returns 403 Forbidden with 'Admin access required.' for non-admin users.
    Returns 401 Unauthorized for unauthenticated requests.
    """
    return AdminPingResponse(
        message="Admin access granted.",
        admin_user=admin.username,
        role=admin.role,
    )
