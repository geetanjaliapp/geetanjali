# Geetanjali - Development Shortcuts

.PHONY: help dev build up down clean logs test lint format

help: ## Show this help message
	@echo "Geetanjali Development Commands"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
dev: ## Start development environment
	docker-compose up -d
	@echo "✅ Development environment started"
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@echo "API Docs: http://localhost:8000/docs"

build: ## Build all Docker images
	docker-compose build

up: ## Start all containers
	docker-compose up -d

down: ## Stop all containers
	docker-compose down

restart: ## Restart all containers
	docker-compose restart

# Production
prod-up: ## Start production environment
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## Stop production environment
	docker-compose -f docker-compose.prod.yml down

# Logs
logs: ## Show logs for all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-ollama: ## Show Ollama logs
	docker-compose logs -f ollama

# Database
db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U geetanjali -d geetanjali

db-migrate: ## Run database migrations
	docker-compose exec backend alembic upgrade head

db-reset: ## Reset database (development only!)
	docker-compose down -v
	docker-compose up -d postgres
	@sleep 5
	docker-compose exec backend alembic upgrade head

# Testing
test: ## Run backend tests
	docker-compose exec backend pytest

test-cov: ## Run tests with coverage
	docker-compose exec backend pytest --cov=. --cov-report=html

# Code Quality
lint: ## Run linters
	docker-compose exec backend flake8 .

format: ## Format code with Black
	docker-compose exec backend black .

typecheck: ## Run MyPy type checker
	docker-compose exec backend mypy .

# Ollama
ollama-pull: ## Pull qwen2.5:3b model
	docker-compose exec ollama ollama pull qwen2.5:3b

ollama-list: ## List available models
	docker-compose exec ollama ollama list

ollama-shell: ## Interactive Ollama shell
	docker-compose exec ollama ollama run qwen2.5:3b

# Cleanup
clean: ## Remove all containers, volumes, and images
	docker-compose down -v --rmi all
	@echo "✅ Cleaned up all Docker resources"

clean-cache: ## Remove Python cache files
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Shell Access
shell-backend: ## Open shell in backend container
	docker-compose exec backend /bin/bash

shell-postgres: ## Open shell in Postgres container
	docker-compose exec postgres /bin/sh

# Deployment
deploy: ## Deploy to production
	./scripts/deploy.sh

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

docker-clean: ## Clean Docker build cache and unused images locally
	docker builder prune -f
	docker image prune -f
	@echo "✅ Docker cleanup complete"

# Secrets Management (SOPS + age)
secrets-edit: ## Edit encrypted secrets (.env.enc)
	@EDITOR=vim sops .env.enc

secrets-view: ## View decrypted secrets (for debugging)
	@sops --decrypt --input-type dotenv --output-type dotenv .env.enc

secrets-encrypt: ## Encrypt a plaintext .env file to .env.enc (usage: make secrets-encrypt SRC=.env.local)
	@if [ -z "$(SRC)" ]; then echo "Error: Specify source file with SRC=<file>"; exit 1; fi
	@sops --encrypt --input-type dotenv --output-type dotenv --output .env.enc $(SRC)
	@echo "✅ Secrets encrypted to .env.enc"

# Quick Start
init: build up db-migrate ## Initialize project (build, start, migrate)
	@echo "✅ Project initialized successfully!"
	@echo "Backend: http://localhost:8000/docs"
