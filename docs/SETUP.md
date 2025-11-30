# Geetanjali - Local Development Setup

Step-by-step guide to set up Geetanjali development environment.

## Prerequisites

- **Python 3.10+** - Backend runtime
- **Node.js 18+** - Frontend runtime
- **Ollama** - Local LLM inference
- **Git** - Version control

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd geetanjali
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local settings (optional for defaults)
```

## Backend Setup

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
```

### 2. Activate Virtual Environment

```bash
# macOS/Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Initialize Database

```bash
# Run database migrations
alembic upgrade head

# (Or run initialization script when available)
python scripts/init_db.py
```

### 5. Verify Installation

```bash
# Run tests
pytest

# Check code quality
black --check .
flake8 .
mypy .
```

## Ollama Setup

### 1. Install Ollama

Visit https://ollama.ai and download for your platform, or:

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama Service

```bash
ollama serve
```

### 3. Pull Llama 3.1 Model

```bash
ollama pull llama3.1:8b
```

### 4. Verify Ollama

```bash
# Test API
curl http://localhost:11434/api/tags

# Should return list of installed models
```

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

```bash
# Copy frontend environment file
cp .env.example .env.local

# Ensure VITE_API_URL points to backend (default: http://localhost:8000)
```

### 3. Start Development Server

```bash
npm run dev
```

Frontend will be available at: http://localhost:5173

## Running the Application

### Terminal 1: Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Backend API: http://localhost:8000
API Docs: http://localhost:8000/docs

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173

### Terminal 3: Ollama (if not running as service)

```bash
ollama serve
```

## Verification Checklist

- [ ] Python 3.10+ installed (`python3 --version`)
- [ ] Virtual environment activated (prompt shows `(venv)`)
- [ ] All Python dependencies installed (`pip list`)
- [ ] Database initialized (check for `geetanjali.db`)
- [ ] Ollama running (`curl http://localhost:11434/api/tags`)
- [ ] Llama 3.1 model available (`ollama list`)
- [ ] Backend tests passing (`pytest`)
- [ ] Backend running at http://localhost:8000
- [ ] Frontend dependencies installed
- [ ] Frontend running at http://localhost:5173

## Troubleshooting

### Virtual Environment Issues

```bash
# Deactivate and recreate
deactivate
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Ollama Connection Issues

```bash
# Check if Ollama is running
ps aux | grep ollama

# Check port
lsof -i :11434

# Restart Ollama
pkill ollama
ollama serve
```

### Database Issues

```bash
# Reset database (development only!)
rm geetanjali.db
alembic upgrade head
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

## Next Steps

- Read [Project Guidelines](../todos/project-guidelines.md)
- Review [Architecture Decisions](ADR/)
- Check [API Documentation](API.md)
- See [Data Documentation](DATA.md)

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes with frequent commits
3. Run pre-commit checks: `./scripts/pre-commit-check.sh`
4. Run tests: `pytest`
5. Commit with conventional format: `git commit -m "feat: description"`
6. Push and create PR

## Additional Tools (Optional)

- **httpie** - API testing: `pip install httpie`
- **pgAdmin** - PostgreSQL GUI (if using Postgres)
- **Postman** - API testing and documentation
