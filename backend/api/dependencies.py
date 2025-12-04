"""FastAPI dependencies for common patterns across endpoints."""

from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.connection import get_db
from db.repositories.case_repository import CaseRepository
from api.middleware.auth import (
    get_optional_user,
    get_session_id,
    user_can_access_resource,
)
from models.case import Case
from models.user import User


class CaseAccessDep:
    """
    Dependency that retrieves a case and validates access.

    Use as a dependency to get a case with access control:

        @router.get("/cases/{case_id}")
        def get_case(case: Case = Depends(get_case_with_access)):
            return case
    """

    def __init__(self, require_auth: bool = False):
        """
        Args:
            require_auth: If True, requires authenticated user (not anonymous)
        """
        self.require_auth = require_auth

    def __call__(
        self,
        case_id: str,
        db: Session = Depends(get_db),
        current_user: Optional[User] = Depends(get_optional_user),
        session_id: Optional[str] = Depends(get_session_id),
    ) -> Case:
        """
        Retrieve case and validate access.

        Args:
            case_id: Case ID from path parameter
            db: Database session
            current_user: Authenticated user (optional)
            session_id: Session ID from X-Session-ID header

        Returns:
            Case object if found and accessible

        Raises:
            HTTPException 404: Case not found
            HTTPException 403: Access denied
            HTTPException 401: Auth required but not provided
        """
        if self.require_auth and current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        repo = CaseRepository(db)
        case = repo.get(case_id)

        if not case:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Case {case_id} not found",
            )

        if not user_can_access_resource(
            resource_user_id=case.user_id,
            resource_session_id=case.session_id,
            current_user=current_user,
            session_id=session_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this case",
            )

        return case


# Pre-configured dependency instances
get_case_with_access = CaseAccessDep(require_auth=False)
get_case_with_auth = CaseAccessDep(require_auth=True)
