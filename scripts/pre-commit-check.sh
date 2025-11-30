#!/bin/bash
# Pre-commit checks for code quality

set -e

echo "🔍 Running pre-commit checks..."

# Navigate to backend directory
cd backend

# Check if virtual environment is activated
if [ -z "$VIRTUAL_ENV" ]; then
    echo "⚠️  Warning: Virtual environment not activated"
    echo "   Activate with: source venv/bin/activate"
fi

# Run Black formatter check
echo "📝 Checking code formatting with Black..."
python -m black --check . || {
    echo "❌ Black formatting check failed. Run: black ."
    exit 1
}

# Run Flake8 linter
echo "🔎 Running Flake8 linter..."
python -m flake8 . || {
    echo "❌ Flake8 linting failed. Fix issues before committing."
    exit 1
}

# Run MyPy type checker
echo "🔬 Running MyPy type checker..."
python -m mypy . --no-error-summary 2>/dev/null || {
    echo "⚠️  MyPy found type issues (non-blocking for now)"
}

echo "✅ All pre-commit checks passed!"
