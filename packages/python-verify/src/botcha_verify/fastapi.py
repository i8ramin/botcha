"""FastAPI middleware for BOTCHA token verification."""

from typing import Optional

try:
    from fastapi import HTTPException, Request
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
except ImportError:
    raise ImportError(
        "FastAPI is not installed. Install it with: pip install 'botcha-verify[fastapi]'"
    )

from .verify import verify_botcha_token, extract_bearer_token
from .types import BotchaPayload, VerifyOptions


class BotchaVerify:
    """
    FastAPI dependency for BOTCHA token verification.

    Usage:
        from botcha_verify.fastapi import BotchaVerify

        botcha = BotchaVerify(secret='your-secret-key')

        @app.get('/api/data')
        async def get_data(token: BotchaPayload = Depends(botcha)):
            print(f"Solved in {token.solve_time}ms")
            return {"data": "protected"}
    """

    def __init__(
        self, secret: str, audience: Optional[str] = None, auto_error: bool = True
    ):
        """
        Initialize BOTCHA verification dependency.

        Args:
            secret: Secret key for JWT verification
            audience: Optional required audience claim
            auto_error: If True, raise HTTPException on invalid token.
                       If False, return None for invalid tokens.
        """
        self.secret = secret
        self.audience = audience
        self.auto_error = auto_error
        self.security = HTTPBearer(auto_error=auto_error)

    async def __call__(
        self,
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = None,
    ) -> Optional[BotchaPayload]:
        """
        Verify token from request Authorization header.

        Args:
            request: FastAPI request object
            credentials: HTTP Bearer credentials (auto-extracted by FastAPI)

        Returns:
            BotchaPayload if token is valid, None if invalid (when auto_error=False)

        Raises:
            HTTPException: If token is invalid and auto_error=True
        """
        # Extract token from Authorization header
        if credentials:
            token = credentials.credentials
        else:
            # Manual extraction as fallback
            auth_header = request.headers.get("Authorization")
            token = extract_bearer_token(auth_header)

        if not token:
            if self.auto_error:
                raise HTTPException(
                    status_code=401,
                    detail="Missing or invalid Authorization header",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None

        # Get client IP for optional validation
        client_ip = request.client.host if request.client else None

        # Verify token
        options = VerifyOptions(
            audience=self.audience,
            client_ip=None,  # Don't enforce IP by default in FastAPI
        )
        result = verify_botcha_token(token, self.secret, options)

        if not result.valid:
            if self.auto_error:
                raise HTTPException(
                    status_code=401,
                    detail=result.error or "Invalid token",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None

        return result.payload


# Convenience function for route-level verification
def verify_token_dependency(
    secret: str, audience: Optional[str] = None
) -> BotchaVerify:
    """
    Create a FastAPI dependency for token verification.

    Args:
        secret: Secret key for JWT verification
        audience: Optional required audience claim

    Returns:
        BotchaVerify instance for use with Depends()

    Example:
        verify = verify_token_dependency(secret='my-secret')

        @app.get('/data')
        async def get_data(token: BotchaPayload = Depends(verify)):
            return {"data": "protected"}
    """
    return BotchaVerify(secret=secret, audience=audience)
