# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do not** create a public GitHub issue
2. Email security concerns to the project maintainers
3. Include description, reproduction steps, and potential impact

We aim to respond within 48 hours.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Security Measures

- JWT authentication with HTTP-only refresh tokens
- Password hashing with bcrypt
- Rate limiting on auth endpoints
- CORS configured for specific origins
- Input validation on all endpoints
- SQL injection prevention via SQLAlchemy ORM
- XSS prevention through React's default escaping

## Environment Variables

Never commit secrets. See `.env.example` for required variables:
- `JWT_SECRET_KEY` - JWT signing key
- `DATABASE_URL` - Database connection
- `API_KEY` - Admin API key
