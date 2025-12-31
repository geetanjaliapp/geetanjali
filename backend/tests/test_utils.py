"""Tests for utility functions."""

import pytest

# Mark all tests in this module as unit tests (fast, no DB required)
pytestmark = pytest.mark.unit

from utils.auth import (
    hash_password,
    validate_email,
    validate_password_strength,
    verify_password,
)
from utils.jwt import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    hash_token,
)


class TestPasswordHashing:
    """Tests for password hashing utilities."""

    def test_hash_password_returns_hash(self):
        """Test that hash_password returns a hash different from input."""
        password = "SecurePassword123!"
        hashed = hash_password(password)

        assert hashed != password
        assert len(hashed) > 0

    def test_verify_password_correct(self):
        """Test password verification with correct password."""
        password = "SecurePassword123!"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Test password verification with incorrect password."""
        password = "SecurePassword123!"
        wrong_password = "WrongPassword123!"
        hashed = hash_password(password)

        assert verify_password(wrong_password, hashed) is False

    def test_different_passwords_different_hashes(self):
        """Test that different passwords produce different hashes."""
        hash1 = hash_password("Password1!")
        hash2 = hash_password("Password2!")

        assert hash1 != hash2

    def test_same_password_different_hashes(self):
        """Test that same password produces different hashes (salt)."""
        password = "SamePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Hashes should be different due to salt
        assert hash1 != hash2
        # But both should verify
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)


class TestPasswordValidation:
    """Tests for password strength validation."""

    def test_valid_password(self):
        """Test validation of a strong password."""
        is_valid, error = validate_password_strength("SecurePass123!")
        assert is_valid is True
        assert error == ""

    def test_password_too_short(self):
        """Test validation of too short password."""
        is_valid, error = validate_password_strength("Abc1!")
        assert is_valid is False
        assert "8 characters" in error.lower()

    def test_password_with_lowercase_only(self):
        """Test validation of password with only lowercase letters."""
        # Current validation only requires letters + numbers, not case mix
        is_valid, error = validate_password_strength("securepass123")
        assert is_valid is True  # Valid as it has letters and numbers

    def test_password_with_uppercase_only(self):
        """Test validation of password with only uppercase letters."""
        # Current validation only requires letters + numbers, not case mix
        is_valid, error = validate_password_strength("SECUREPASS123")
        assert is_valid is True  # Valid as it has letters and numbers

    def test_password_no_digit(self):
        """Test validation of password without digit."""
        is_valid, error = validate_password_strength("SecurePassword!")
        assert is_valid is False
        assert "digit" in error.lower() or "number" in error.lower()


class TestEmailValidation:
    """Tests for email validation."""

    def test_valid_email(self):
        """Test validation of valid email."""
        assert validate_email("test@example.com") is True
        assert validate_email("user.name@domain.org") is True
        assert validate_email("user+tag@example.co.uk") is True

    def test_invalid_email(self):
        """Test validation of invalid email."""
        assert validate_email("not-an-email") is False
        assert validate_email("@nodomain.com") is False
        assert validate_email("no@domain") is False
        assert validate_email("") is False


class TestJWT:
    """Tests for JWT utilities."""

    def test_create_access_token(self):
        """Test access token creation."""
        user_id = "test-user-id"
        role = "user"

        token = create_access_token(user_id, role)

        assert token is not None
        assert len(token) > 0
        assert isinstance(token, str)

    def test_decode_access_token_valid(self):
        """Test decoding a valid access token."""
        user_id = "test-user-id"
        role = "user"

        token = create_access_token(user_id, role)
        payload = decode_access_token(token)

        assert payload is not None
        assert payload.get("user_id") == user_id
        assert payload.get("role") == role

    def test_decode_access_token_invalid(self):
        """Test decoding an invalid token."""
        payload = decode_access_token("invalid-token")
        assert payload is None

    def test_decode_access_token_tampered(self):
        """Test decoding a tampered token."""
        user_id = "test-user-id"
        role = "user"

        token = create_access_token(user_id, role)
        # Tamper with the token
        tampered_token = token[:-5] + "XXXXX"

        payload = decode_access_token(tampered_token)
        assert payload is None

    def test_create_refresh_token(self):
        """Test refresh token creation."""
        token = create_refresh_token()

        assert token is not None
        assert len(token) > 20
        assert isinstance(token, str)

    def test_refresh_tokens_unique(self):
        """Test that refresh tokens are unique."""
        token1 = create_refresh_token()
        token2 = create_refresh_token()

        assert token1 != token2

    def test_hash_token(self):
        """Test token hashing."""
        token = "test-token-value-for-hashing"  # nosec - test value only
        hashed = hash_token(token)

        assert hashed != token
        assert len(hashed) == 64  # SHA256 hex digest
