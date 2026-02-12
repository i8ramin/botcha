"""Tests for Django middleware."""

import pytest

pytest.importorskip("django")

import json
from unittest.mock import Mock, patch

from django.conf import settings
from django.test import RequestFactory

# Configure Django settings for testing
if not settings.configured:
    settings.configure(
        SECRET_KEY="test-secret",
        DEBUG=True,
        BOTCHA_SECRET="test-secret-key-for-botcha",
        BOTCHA_PROTECTED_PATHS=["/api/"],
        BOTCHA_EXCLUDED_PATHS=["/api/health"],
    )

from botcha_verify.django import BotchaVerifyMiddleware


@pytest.fixture
def get_response():
    """Mock Django get_response callable."""

    def response_callable(request):
        from django.http import JsonResponse

        return JsonResponse({"message": "success"})

    return response_callable


@pytest.fixture
def middleware(get_response):
    """Create middleware instance."""
    return BotchaVerifyMiddleware(get_response)


@pytest.fixture
def request_factory():
    """Django RequestFactory."""
    return RequestFactory()


def test_django_valid_token(middleware, request_factory, valid_token):
    """Test Django middleware with valid token."""
    request = request_factory.get(
        "/api/data", HTTP_AUTHORIZATION=f"Bearer {valid_token}"
    )

    response = middleware(request)

    assert response.status_code == 200
    assert hasattr(request, "botcha")
    assert request.botcha.sub == "test-challenge-123"
    assert request.botcha.solve_time == 1234


def test_django_missing_token(middleware, request_factory):
    """Test Django middleware without token."""
    request = request_factory.get("/api/data")

    response = middleware(request)

    assert response.status_code == 401
    data = json.loads(response.content)
    assert "error" in data


def test_django_invalid_token(middleware, request_factory):
    """Test Django middleware with invalid token."""
    request = request_factory.get(
        "/api/data", HTTP_AUTHORIZATION="Bearer invalid-token"
    )

    response = middleware(request)

    assert response.status_code == 401
    data = json.loads(response.content)
    assert "error" in data


def test_django_expired_token(middleware, request_factory, expired_token):
    """Test Django middleware with expired token."""
    request = request_factory.get(
        "/api/data", HTTP_AUTHORIZATION=f"Bearer {expired_token}"
    )

    response = middleware(request)

    assert response.status_code == 401


def test_django_unprotected_path(middleware, request_factory):
    """Test Django middleware on unprotected path."""
    request = request_factory.get("/public/page")

    response = middleware(request)

    # Should pass through without verification
    assert response.status_code == 200
    assert not hasattr(request, "botcha")


def test_django_excluded_path(middleware, request_factory):
    """Test Django middleware on excluded path."""
    request = request_factory.get("/api/health")

    response = middleware(request)

    # Should pass through without verification
    assert response.status_code == 200
    assert not hasattr(request, "botcha")


def test_django_protected_path_check(middleware):
    """Test path protection logic."""
    assert middleware._should_verify_path("/api/data") is True
    assert middleware._should_verify_path("/api/v1/users") is True
    assert middleware._should_verify_path("/public/page") is False
    assert middleware._should_verify_path("/api/health") is False


def test_django_client_ip_extraction(middleware, request_factory):
    """Test client IP extraction."""
    # Test with X-Forwarded-For
    request = request_factory.get("/api/data")
    request.META["HTTP_X_FORWARDED_FOR"] = "192.168.1.1, 10.0.0.1"
    ip = middleware._get_client_ip(request)
    assert ip == "192.168.1.1"

    # Test with REMOTE_ADDR
    request = request_factory.get("/api/data")
    request.META["REMOTE_ADDR"] = "10.0.0.1"
    ip = middleware._get_client_ip(request)
    assert ip == "10.0.0.1"


def test_django_missing_secret():
    """Test middleware initialization without BOTCHA_SECRET."""
    with patch.object(settings, "BOTCHA_SECRET", None):
        with pytest.raises(ValueError, match="BOTCHA_SECRET"):
            BotchaVerifyMiddleware(lambda r: None)


def test_django_with_audience(request_factory, get_response, valid_token_with_audience):
    """Test Django middleware with audience verification."""
    with patch.object(
        settings, "BOTCHA_AUDIENCE", "https://api.example.com", create=True
    ):
        middleware = BotchaVerifyMiddleware(get_response)

        request = request_factory.get(
            "/api/data", HTTP_AUTHORIZATION=f"Bearer {valid_token_with_audience}"
        )

        response = middleware(request)

        assert response.status_code == 200
        assert hasattr(request, "botcha")
        assert request.botcha.aud == "https://api.example.com"
