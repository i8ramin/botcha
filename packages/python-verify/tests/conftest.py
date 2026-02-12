"""Pytest configuration and fixtures for botcha-verify tests."""

import jwt
import pytest
from datetime import datetime, timedelta, timezone


@pytest.fixture
def secret():
    """Test JWT secret."""
    return "test-secret-key-for-botcha"


@pytest.fixture
def challenge_id():
    """Test challenge ID."""
    return "test-challenge-123"


@pytest.fixture
def valid_token(secret, challenge_id):
    """Create a valid BOTCHA JWT token for testing."""
    payload = {
        "sub": challenge_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "jti": "test-jti-123",
        "type": "botcha-verified",
        "solveTime": 1234,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def valid_token_with_audience(secret, challenge_id):
    """Create a valid BOTCHA JWT token with audience claim."""
    payload = {
        "sub": challenge_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "jti": "test-jti-456",
        "type": "botcha-verified",
        "solveTime": 1234,
        "aud": "https://api.example.com",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def valid_token_with_client_ip(secret, challenge_id):
    """Create a valid BOTCHA JWT token with client IP."""
    payload = {
        "sub": challenge_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "jti": "test-jti-789",
        "type": "botcha-verified",
        "solveTime": 1234,
        "client_ip": "192.168.1.1",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def expired_token(secret, challenge_id):
    """Create an expired BOTCHA JWT token."""
    payload = {
        "sub": challenge_id,
        "iat": datetime.now(timezone.utc) - timedelta(minutes=10),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
        "jti": "test-jti-expired",
        "type": "botcha-verified",
        "solveTime": 1234,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def wrong_type_token(secret, challenge_id):
    """Create a token with wrong type (refresh instead of verified)."""
    payload = {
        "sub": challenge_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "jti": "test-jti-wrong",
        "type": "botcha-refresh",  # Wrong type
        "solveTime": 1234,
    }
    return jwt.encode(payload, secret, algorithm="HS256")
