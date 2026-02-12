"""Tests for core BOTCHA token verification."""

import jwt
import pytest
from datetime import datetime, timedelta, timezone

from botcha_verify import verify_botcha_token, extract_bearer_token
from botcha_verify.types import VerifyOptions


def test_verify_valid_token(valid_token, secret):
    """Test verification of a valid token."""
    result = verify_botcha_token(valid_token, secret)

    assert result.valid is True
    assert result.error is None
    assert result.payload is not None
    assert result.payload.sub == "test-challenge-123"
    assert result.payload.type == "botcha-verified"
    assert result.payload.solve_time == 1234
    assert result.payload.jti == "test-jti-123"


def test_verify_expired_token(expired_token, secret):
    """Test verification of an expired token."""
    result = verify_botcha_token(expired_token, secret)

    assert result.valid is False
    assert result.payload is None
    assert "expired" in result.error.lower()


def test_verify_invalid_signature(valid_token):
    """Test verification with wrong secret."""
    result = verify_botcha_token(valid_token, "wrong-secret")

    assert result.valid is False
    assert result.payload is None
    assert "signature" in result.error.lower()


def test_verify_wrong_type_token(wrong_type_token, secret):
    """Test verification of token with wrong type."""
    result = verify_botcha_token(wrong_type_token, secret)

    assert result.valid is False
    assert result.payload is None
    assert "type" in result.error.lower()


def test_verify_with_audience_match(valid_token_with_audience, secret):
    """Test verification with matching audience claim."""
    options = VerifyOptions(audience="https://api.example.com")
    result = verify_botcha_token(valid_token_with_audience, secret, options)

    assert result.valid is True
    assert result.payload is not None
    assert result.payload.aud == "https://api.example.com"


def test_verify_with_audience_mismatch(valid_token_with_audience, secret):
    """Test verification with mismatched audience claim."""
    options = VerifyOptions(audience="https://different-api.example.com")
    result = verify_botcha_token(valid_token_with_audience, secret, options)

    assert result.valid is False
    assert result.payload is None
    assert "audience" in result.error.lower()


def test_verify_with_client_ip_match(valid_token_with_client_ip, secret):
    """Test verification with matching client IP."""
    options = VerifyOptions(client_ip="192.168.1.1")
    result = verify_botcha_token(valid_token_with_client_ip, secret, options)

    assert result.valid is True
    assert result.payload is not None
    assert result.payload.client_ip == "192.168.1.1"


def test_verify_with_client_ip_mismatch(valid_token_with_client_ip, secret):
    """Test verification with mismatched client IP."""
    options = VerifyOptions(client_ip="10.0.0.1")
    result = verify_botcha_token(valid_token_with_client_ip, secret, options)

    assert result.valid is False
    assert result.payload is None
    assert "IP" in result.error


def test_verify_malformed_token(secret):
    """Test verification of malformed token."""
    result = verify_botcha_token("not-a-valid-jwt", secret)

    assert result.valid is False
    assert result.payload is None
    assert result.error is not None


def test_extract_bearer_token_valid():
    """Test extraction of valid Bearer token."""
    auth_header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    token = extract_bearer_token(auth_header)

    assert token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"


def test_extract_bearer_token_missing():
    """Test extraction with missing header."""
    token = extract_bearer_token(None)
    assert token is None

    token = extract_bearer_token("")
    assert token is None


def test_extract_bearer_token_wrong_scheme():
    """Test extraction with wrong auth scheme."""
    token = extract_bearer_token("Basic dXNlcjpwYXNz")
    assert token is None


def test_verify_token_missing_required_fields(secret):
    """Test verification of token missing required fields."""
    # Token without jti
    payload = {
        "sub": "test-challenge",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "type": "botcha-verified",
        "solveTime": 1234,
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    result = verify_botcha_token(token, secret)

    assert result.valid is False
    assert result.error is not None
