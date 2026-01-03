"""Email service exception types."""


class EmailError(Exception):
    """Base exception for email service errors."""

    pass


class EmailConfigurationError(EmailError):
    """
    Email service is not configured properly.

    This is a non-retryable error - configuration must be fixed.
    Examples: Missing API key, missing FROM address.
    """

    pass


class EmailServiceUnavailable(EmailError):
    """
    Email service is unavailable.

    This may be transient (network issue) or permanent (library not installed).
    Caller should check the underlying cause.
    """

    pass


class EmailSendError(EmailError):
    """
    Failed to send email via provider.

    This wraps errors from the email provider (Resend).
    May be transient (rate limit, network) or permanent (invalid recipient).
    """

    def __init__(self, message: str, cause: Exception | None = None):
        super().__init__(message)
        self.cause = cause


class EmailCircuitOpenError(EmailError):
    """
    Circuit breaker is open - email service temporarily disabled.

    This is raised when too many consecutive failures have occurred.
    The circuit will automatically close after the cooldown period.
    """

    pass
