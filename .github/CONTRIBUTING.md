# Contributing

## Setup

See [docs/SETUP.md](../docs/SETUP.md) for development environment setup.

## Code Style

**Backend (Python)**
```bash
black .          # Format
flake8 .         # Lint
mypy .           # Type check
```

**Frontend (TypeScript)**
```bash
npm run lint     # ESLint
npm run build    # Type check
```

## Pull Requests

1. Create a feature branch from `main`
2. Make changes with clear commit messages
3. Ensure tests pass: `pytest` (backend), `npm run lint` (frontend)
4. Submit PR with description of changes

## Commit Messages

Follow conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `chore:` Maintenance
- `test:` Tests

## Questions

Open an issue for questions or suggestions.
