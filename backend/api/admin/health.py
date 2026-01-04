"""Admin endpoints for system health and circuit breaker management."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import verify_admin_api_key
from services.email import send_alert_email

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Alert Endpoints
# =============================================================================


class AlertRequest(BaseModel):
    """Request model for sending alerts."""

    subject: str
    message: str


class AlertResponse(BaseModel):
    """Response model for alert status."""

    status: str
    message: str


@router.post("/alert", response_model=AlertResponse)
def send_alert(
    request: AlertRequest,
    _: bool = Depends(verify_admin_api_key),
):
    """
    Send an alert email to the configured admin.

    Used by maintenance scripts and monitoring systems to notify
    about issues like disk space, failed backups, etc.

    Requires X-API-Key header for authentication.

    Args:
        request: Alert subject and message

    Returns:
        Status of the alert delivery
    """
    try:
        success = send_alert_email(request.subject, request.message)

        if success:
            return AlertResponse(
                status="sent",
                message="Alert email sent successfully",
            )
        else:
            return AlertResponse(
                status="failed",
                message="Alert could not be sent - check email configuration",
            )

    except Exception as e:
        logger.error(f"Failed to send alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to send alert")


# =============================================================================
# Circuit Breaker Management
# =============================================================================


class CircuitBreakerResetRequest(BaseModel):
    """Request model for circuit breaker reset."""

    service: str  # email, anthropic, ollama, chromadb


class CircuitBreakerStatusResponse(BaseModel):
    """Response model for circuit breaker status."""

    service: str
    state: str
    failure_count: int
    message: str


@router.post("/circuit-breaker/reset", response_model=CircuitBreakerStatusResponse)
def reset_circuit_breaker(
    request: CircuitBreakerResetRequest,
    _: bool = Depends(verify_admin_api_key),
):
    """
    Manually reset a circuit breaker to closed state.

    Use this endpoint to force-reset a circuit breaker during incident recovery
    when you know the underlying service is healthy but the circuit is stuck open.

    Supported services:
    - email: Email service circuit breaker
    - anthropic: Anthropic LLM circuit breaker
    - ollama: Ollama LLM circuit breaker
    - chromadb: ChromaDB vector store circuit breaker

    Requires X-API-Key header for authentication.
    """
    service = request.service.lower()

    try:
        if service == "email":
            from services.email import _email_circuit_breaker

            if _email_circuit_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Email circuit breaker not initialized",
                )
            _email_circuit_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="email",
                state=_email_circuit_breaker.state,
                failure_count=_email_circuit_breaker.failure_count,
                message="Email circuit breaker reset to closed state",
            )

        elif service == "anthropic":
            from services.llm import get_llm_service

            llm = get_llm_service()
            if not hasattr(llm, "_anthropic_breaker") or llm._anthropic_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Anthropic circuit breaker not initialized (mock mode?)",
                )
            llm._anthropic_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="anthropic",
                state=llm._anthropic_breaker.state,
                failure_count=llm._anthropic_breaker.failure_count,
                message="Anthropic circuit breaker reset to closed state",
            )

        elif service == "ollama":
            from services.llm import get_llm_service

            llm = get_llm_service()
            if not hasattr(llm, "_ollama_breaker") or llm._ollama_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="Ollama circuit breaker not initialized",
                )
            llm._ollama_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="ollama",
                state=llm._ollama_breaker.state,
                failure_count=llm._ollama_breaker.failure_count,
                message="Ollama circuit breaker reset to closed state",
            )

        elif service == "chromadb":
            from services.vector_store import get_vector_store

            vs = get_vector_store()
            if not hasattr(vs, "_circuit_breaker") or vs._circuit_breaker is None:
                raise HTTPException(
                    status_code=404,
                    detail="ChromaDB circuit breaker not initialized",
                )
            vs._circuit_breaker.reset()
            return CircuitBreakerStatusResponse(
                service="chromadb",
                state=vs._circuit_breaker.state,
                failure_count=vs._circuit_breaker.failure_count,
                message="ChromaDB circuit breaker reset to closed state",
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown service: {service}. Valid options: email, anthropic, ollama, chromadb",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to reset circuit breaker for {service}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reset circuit breaker: {str(e)}",
        )


@router.get("/circuit-breaker/status")
def get_circuit_breaker_status(
    _: bool = Depends(verify_admin_api_key),
):
    """
    Get status of all circuit breakers.

    Returns the current state of each circuit breaker:
    - state: closed, open, or half_open
    - failure_count: number of consecutive failures
    - name: circuit breaker identifier

    Requires X-API-Key header for authentication.
    """
    result = {}

    # Email circuit breaker
    try:
        from services.email import _email_circuit_breaker

        if _email_circuit_breaker is not None:
            result["email"] = {
                "state": _email_circuit_breaker.state,
                "failure_count": _email_circuit_breaker.failure_count,
            }
    except Exception as e:
        result["email"] = {"error": str(e)}

    # LLM circuit breakers
    try:
        from services.llm import get_llm_service

        llm = get_llm_service()
        if hasattr(llm, "_anthropic_breaker") and llm._anthropic_breaker is not None:
            result["anthropic"] = {
                "state": llm._anthropic_breaker.state,
                "failure_count": llm._anthropic_breaker.failure_count,
            }
        if hasattr(llm, "_ollama_breaker") and llm._ollama_breaker is not None:
            result["ollama"] = {
                "state": llm._ollama_breaker.state,
                "failure_count": llm._ollama_breaker.failure_count,
            }
    except Exception as e:
        result["llm"] = {"error": str(e)}

    # ChromaDB circuit breaker
    try:
        from services.vector_store import get_vector_store

        vs = get_vector_store()
        if hasattr(vs, "_circuit_breaker") and vs._circuit_breaker is not None:
            result["chromadb"] = {
                "state": vs._circuit_breaker.state,
                "failure_count": vs._circuit_breaker.failure_count,
            }
    except Exception as e:
        result["chromadb"] = {"error": str(e)}

    return {"circuit_breakers": result}
