"""Type definitions for BOTCHA verification."""

from dataclasses import dataclass
from typing import Optional


@dataclass
class BotchaPayload:
    """JWT payload structure for BOTCHA verified tokens."""

    sub: str  # challenge ID that was solved
    iat: int  # issued at (seconds)
    exp: int  # expires at (seconds)
    jti: str  # JWT ID for revocation
    type: str  # "botcha-verified"
    solve_time: int  # how fast they solved it (ms)
    aud: Optional[str] = None  # optional audience claim
    client_ip: Optional[str] = None  # optional client IP binding


@dataclass
class VerifyOptions:
    """Options for token verification."""

    audience: Optional[str] = None  # required audience
    client_ip: Optional[str] = None  # client IP to validate against


@dataclass
class VerifyResult:
    """Result of token verification."""

    valid: bool
    payload: Optional[BotchaPayload] = None
    error: Optional[str] = None
