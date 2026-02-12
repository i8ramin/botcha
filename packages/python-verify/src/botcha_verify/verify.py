"""Core BOTCHA JWT token verification."""

import jwt
from typing import Optional

from .types import BotchaPayload, VerifyOptions, VerifyResult


def verify_botcha_token(
    token: str, secret: str, options: Optional[VerifyOptions] = None
) -> VerifyResult:
    """
    Verify a BOTCHA JWT token.

    Checks:
    - Token signature and expiry (HS256)
    - Token type must be "botcha-verified"
    - Audience claim (if options.audience provided)
    - Client IP binding (if options.client_ip provided)

    Args:
        token: JWT token string
        secret: Secret key for verification
        options: Optional verification options

    Returns:
        VerifyResult with valid flag, payload, or error message

    Example:
        >>> result = verify_botcha_token(token, secret="my-secret")
        >>> if result.valid:
        ...     print(f"Solved in {result.payload.solve_time}ms")
    """
    try:
        # Decode and verify JWT signature, expiry, and audience
        # PyJWT handles audience verification if passed as parameter
        decode_kwargs = {
            "algorithms": ["HS256"],
            "options": {
                "require": ["sub", "iat", "exp", "jti"],
            },
        }

        # Add audience verification if provided
        if options and options.audience:
            decode_kwargs["audience"] = options.audience

        payload = jwt.decode(token, secret, **decode_kwargs)

        # Check token type (must be access token, not refresh token)
        token_type = payload.get("type")
        if token_type != "botcha-verified":
            return VerifyResult(
                valid=False,
                error=f"Invalid token type: expected 'botcha-verified', got '{token_type}'",
            )

        # Validate client IP binding (if required)
        if options and options.client_ip:
            token_ip = payload.get("client_ip")
            if not token_ip or token_ip != options.client_ip:
                return VerifyResult(
                    valid=False,
                    error=f"Client IP mismatch: expected '{options.client_ip}', got '{token_ip}'",
                )

        # Build payload dataclass
        botcha_payload = BotchaPayload(
            sub=payload["sub"],
            iat=payload["iat"],
            exp=payload["exp"],
            jti=payload["jti"],
            type=payload["type"],
            solve_time=payload.get(
                "solveTime", 0
            ),  # Handle both solveTime and solve_time
            aud=payload.get("aud"),
            client_ip=payload.get("client_ip"),
        )

        return VerifyResult(valid=True, payload=botcha_payload)

    except jwt.ExpiredSignatureError:
        return VerifyResult(valid=False, error="Token has expired")
    except jwt.InvalidTokenError as e:
        return VerifyResult(valid=False, error=f"Invalid token: {str(e)}")
    except Exception as e:
        return VerifyResult(valid=False, error=f"Token verification failed: {str(e)}")


def extract_bearer_token(auth_header: Optional[str]) -> Optional[str]:
    """
    Extract Bearer token from Authorization header.

    Args:
        auth_header: Authorization header value (e.g., "Bearer eyJhbG...")

    Returns:
        Token string without "Bearer " prefix, or None if not found
    """
    if not auth_header:
        return None

    if not auth_header.startswith("Bearer "):
        return None

    return auth_header[7:]  # Remove "Bearer " prefix
