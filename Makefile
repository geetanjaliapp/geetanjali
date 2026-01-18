# Geetanjali - Development Shortcuts
# See docs/deployment.md for detailed deployment documentation

.PHONY: help dev build up down clean logs test lint format seo-generate seo-status

# Use modern docker compose (not docker-compose)
COMPOSE := docker compose

help: ## Show this help message
	@echo "Geetanjali Development Commands"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment
	$(COMPOSE) up -d
	@echo "Development environment started"
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost"
	@echo "API Docs: http://localhost:8000/docs"

build: ## Build all Docker images
	$(COMPOSE) build

up: ## Start all containers
	$(COMPOSE) up -d

down: ## Stop all containers
	$(COMPOSE) down

restart: ## Restart all containers
	$(COMPOSE) restart

# =============================================================================
# Observability (Prometheus + Grafana)
# =============================================================================

obs-up: ## Start with observability stack (Prometheus + Grafana)
	$(COMPOSE) -f docker-compose.yml -f docker-compose.observability.yml up -d

obs-down: ## Stop observability stack
	$(COMPOSE) -f docker-compose.yml -f docker-compose.observability.yml down

obs-logs: ## Show observability logs
	$(COMPOSE) -f docker-compose.observability.yml logs -f

# =============================================================================
# Testing
# =============================================================================

test-up: ## Start test environment (no Ollama, ephemeral DB)
	$(COMPOSE) -f docker-compose.test.yml up -d

test-down: ## Stop test environment
	$(COMPOSE) -f docker-compose.test.yml down

minimal-up: ## Start minimal environment (backend + postgres only)
	$(COMPOSE) -f docker-compose.minimal.yml up -d

minimal-down: ## Stop minimal environment
	$(COMPOSE) -f docker-compose.minimal.yml down

# =============================================================================
# Logs
# =============================================================================

logs: ## Show logs for all services
	$(COMPOSE) logs -f

logs-backend: ## Show backend logs
	$(COMPOSE) logs -f backend

logs-worker: ## Show worker logs
	$(COMPOSE) logs -f worker

logs-ollama: ## Show Ollama logs
	$(COMPOSE) logs -f ollama

# =============================================================================
# Database
# =============================================================================

db-shell: ## Open PostgreSQL shell
	$(COMPOSE) exec postgres psql -U geetanjali -d geetanjali

db-migrate: ## Run database migrations
	$(COMPOSE) exec backend alembic upgrade head

db-reset: ## Reset database (development only!)
	$(COMPOSE) down -v
	$(COMPOSE) up -d postgres
	@sleep 5
	$(COMPOSE) exec backend alembic upgrade head

# =============================================================================
# Testing & Code Quality
# =============================================================================

test: ## Run backend tests
	$(COMPOSE) exec backend pytest

test-cov: ## Run tests with coverage
	$(COMPOSE) exec backend pytest --cov=. --cov-report=html

test-gemini: ## Test Gemini LLM conformance locally
	@echo "Testing Gemini LLM conformance..."
	cd backend && source venv/bin/activate && python ../scripts/test_gemini.py

test-gemini-compare: ## Compare Gemini vs Anthropic responses
	@echo "Comparing Gemini vs Anthropic..."
	cd backend && source venv/bin/activate && python ../scripts/test_gemini.py --provider compare --verbose

lint: ## Run linters
	$(COMPOSE) exec backend flake8 .

format: ## Format code with Black
	$(COMPOSE) exec backend black .

typecheck: ## Run MyPy type checker
	$(COMPOSE) exec backend mypy .

# =============================================================================
# Ollama
# =============================================================================

ollama-pull: ## Pull qwen2.5:3b model
	$(COMPOSE) exec ollama ollama pull qwen2.5:3b

ollama-list: ## List available models
	$(COMPOSE) exec ollama ollama list

ollama-shell: ## Interactive Ollama shell
	$(COMPOSE) exec ollama ollama run qwen2.5:3b

# =============================================================================
# Cleanup
# =============================================================================

clean: ## Remove all containers, volumes, and images
	$(COMPOSE) down -v --rmi all
	@echo "Cleaned up all Docker resources"

clean-cache: ## Remove Python cache files
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

docker-clean: ## Clean Docker build cache and unused images locally
	docker builder prune -f
	docker image prune -f
	@echo "Docker cleanup complete"

# =============================================================================
# Shell Access
# =============================================================================

shell-backend: ## Open shell in backend container
	$(COMPOSE) exec backend /bin/bash

shell-postgres: ## Open shell in Postgres container
	$(COMPOSE) exec postgres /bin/sh

shell-worker: ## Open shell in worker container
	$(COMPOSE) exec worker /bin/bash

# =============================================================================
# Deployment
# =============================================================================

setup-server: ## First-time server setup (run on production server)
	./scripts/setup-server.sh

deploy: ## Deploy to production
	./scripts/deploy.sh

seo-generate: ## Trigger SEO page generation via admin API
	@docker exec geetanjali-backend sh -c 'curl -s -f -X POST -H "X-API-Key: $$API_KEY" http://localhost:8000/api/v1/admin/seo/generate' | python3 -m json.tool

seo-status: ## Check SEO generation status
	@docker exec geetanjali-backend sh -c 'curl -s -H "X-API-Key: $$API_KEY" http://localhost:8000/api/v1/admin/seo/status' | python3 -m json.tool

rollback: ## Rollback to previous deployment (uses .env.local or env vars)
	@if [ -f .env.local ]; then . .env.local; fi; \
	if [ -z "$$DEPLOY_HOST" ] || [ -z "$$DEPLOY_DIR" ]; then \
		echo "Error: DEPLOY_HOST and DEPLOY_DIR must be set (in .env.local or environment)"; \
		exit 1; \
	fi; \
	echo "Rolling back to previous images..."; \
	ssh $$DEPLOY_HOST "cd $$DEPLOY_DIR && \
		docker tag geetanjali-backend:rollback geetanjali-backend:latest && \
		docker tag geetanjali-frontend:rollback geetanjali-frontend:latest && \
		docker compose up -d backend frontend"; \
	echo "Rollback complete."

# =============================================================================
# Secrets Management (SOPS + age)
# =============================================================================

secrets-edit: ## Edit encrypted secrets (.env.enc)
	@EDITOR=vim sops .env.enc

secrets-view: ## View decrypted secrets (for debugging)
	@sops --decrypt --input-type dotenv --output-type dotenv .env.enc

secrets-encrypt: ## Encrypt a plaintext .env file to .env.enc (usage: make secrets-encrypt SRC=.env.local)
	@if [ -z "$(SRC)" ]; then echo "Error: Specify source file with SRC=<file>"; exit 1; fi
	@sops --encrypt --input-type dotenv --output-type dotenv --output .env.enc $(SRC)
	@echo "Secrets encrypted to .env.enc"

secrets-add: ## Add/update a key-value in .env.enc (usage: make secrets-add KEY=FOO VAL=bar)
	@if [ -z "$(KEY)" ] || [ -z "$(VAL)" ]; then echo "Error: Specify KEY and VAL"; exit 1; fi
	@sops --decrypt --input-type dotenv --output-type dotenv .env.enc > .env.tmp && \
	if grep -q "^$(KEY)=" .env.tmp; then \
		sed -i '' "s|^$(KEY)=.*|$(KEY)=$(VAL)|" .env.tmp; \
		echo "Updated existing $(KEY)"; \
	else \
		echo "$(KEY)=$(VAL)" >> .env.tmp; \
		echo "Added new $(KEY)"; \
	fi && \
	sops --encrypt --input-type dotenv --output-type dotenv --output .env.enc .env.tmp && \
	rm -f .env.tmp && \
	echo "$(KEY) saved to .env.enc"

# =============================================================================
# Performance Analysis
# =============================================================================

perf: ## Run Lighthouse audit on production (opens dashboard)
	npx unlighthouse --site https://geetanjaliapp.com

perf-local: ## Run Lighthouse audit on local dev
	npx unlighthouse --site http://localhost

perf-ci: ## Run Lighthouse audit (CI mode, no dashboard)
	npx unlighthouse-ci --site https://geetanjaliapp.com --budget ./lighthouse-budget.json

perf-report: ## Generate performance report to .unlighthouse/
	npx unlighthouse --site https://geetanjaliapp.com --output-path .unlighthouse --no-open

# =============================================================================
# Quick Start
# =============================================================================

init: build up db-migrate ## Initialize project (build, start, migrate)
	@echo "Project initialized successfully!"
	@echo "Backend: http://localhost:8000/docs"
