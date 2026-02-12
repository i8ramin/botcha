"""Tests for FastAPI middleware."""

import pytest

pytest.importorskip("fastapi")

from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from botcha_verify.fastapi import BotchaVerify
from botcha_verify.types import BotchaPayload


def test_fastapi_valid_token(valid_token, secret):
    """Test FastAPI middleware with valid token."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret)

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {
            "message": "success",
            "challenge_id": token.sub,
            "solve_time": token.solve_time,
        }

    client = TestClient(app)
    response = client.get(
        "/protected", headers={"Authorization": f"Bearer {valid_token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "success"
    assert data["challenge_id"] == "test-challenge-123"
    assert data["solve_time"] == 1234


def test_fastapi_missing_token(secret):
    """Test FastAPI middleware without token."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret)

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {"message": "success"}

    client = TestClient(app)
    response = client.get("/protected")

    assert response.status_code == 401
    assert (
        "authorization" in response.json()["detail"].lower()
        or "missing" in response.json()["detail"].lower()
    )


def test_fastapi_invalid_token(secret):
    """Test FastAPI middleware with invalid token."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret)

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {"message": "success"}

    client = TestClient(app)
    response = client.get(
        "/protected", headers={"Authorization": "Bearer invalid-token"}
    )

    assert response.status_code == 401


def test_fastapi_expired_token(expired_token, secret):
    """Test FastAPI middleware with expired token."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret)

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {"message": "success"}

    client = TestClient(app)
    response = client.get(
        "/protected", headers={"Authorization": f"Bearer {expired_token}"}
    )

    assert response.status_code == 401


def test_fastapi_with_audience(valid_token_with_audience, secret):
    """Test FastAPI middleware with audience verification."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret, audience="https://api.example.com")

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {"message": "success", "aud": token.aud}

    client = TestClient(app)
    response = client.get(
        "/protected", headers={"Authorization": f"Bearer {valid_token_with_audience}"}
    )

    assert response.status_code == 200
    assert response.json()["aud"] == "https://api.example.com"


def test_fastapi_wrong_audience(valid_token_with_audience, secret):
    """Test FastAPI middleware with wrong audience."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret, audience="https://different.example.com")

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        return {"message": "success"}

    client = TestClient(app)
    response = client.get(
        "/protected", headers={"Authorization": f"Bearer {valid_token_with_audience}"}
    )

    assert response.status_code == 401


def test_fastapi_auto_error_false(secret):
    """Test FastAPI middleware with auto_error=False."""
    app = FastAPI()
    botcha = BotchaVerify(secret=secret, auto_error=False)

    @app.get("/protected")
    async def protected(token: BotchaPayload = Depends(botcha)):
        if token is None:
            return {"message": "no token"}
        return {"message": "success"}

    client = TestClient(app)
    response = client.get("/protected")

    # Should return 200 with custom response instead of 401
    assert response.status_code == 200
    assert response.json()["message"] == "no token"
