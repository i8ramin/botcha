"""Type definitions for BOTCHA SDK."""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ChallengeResponse:
    """Response from the /challenge endpoint."""

    id: str
    problems: list[int]
    time_limit: int


@dataclass
class TokenResponse:
    """Response from the /solve endpoint."""

    verified: bool
    token: str
    solve_time_ms: float


@dataclass
class VerifyResponse:
    """Response from the /verify endpoint."""

    verified: bool
    method: Optional[str] = None
    hint: Optional[str] = None


# ============ App Management Types ============


@dataclass
class CreateAppResponse:
    """Response from POST /v1/apps."""

    success: bool
    app_id: str
    app_secret: str
    email: str
    email_verified: bool = False
    verification_required: bool = True
    warning: str = ""
    credential_advice: str = ""
    created_at: str = ""
    rate_limit: int = 100
    next_step: str = ""


@dataclass
class VerifyEmailResponse:
    """Response from POST /v1/apps/:id/verify-email."""

    success: bool
    email_verified: Optional[bool] = None
    error: Optional[str] = None
    message: Optional[str] = None


@dataclass
class ResendVerificationResponse:
    """Response from POST /v1/apps/:id/resend-verification."""

    success: bool
    message: Optional[str] = None
    error: Optional[str] = None


@dataclass
class RecoverAccountResponse:
    """Response from POST /v1/auth/recover."""

    success: bool
    message: str = ""


@dataclass
class RotateSecretResponse:
    """Response from POST /v1/apps/:id/rotate-secret."""

    success: bool
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    warning: Optional[str] = None
    rotated_at: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None
