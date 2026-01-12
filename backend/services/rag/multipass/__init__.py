"""Multi-pass consultation pipeline for Ollama 5-pass refinement workflow.

This module implements the multi-pass pipeline:
- Pass 0: Acceptance (validation gate)
- Pass 1: Draft (creative reasoning)
- Pass 2: Critique (analytical review)
- Pass 3: Refine (disciplined rewrite)
- Pass 4: Structure (JSON formatting)

See: todos/ollama-consultations-refined.md for full specification.
"""

from services.rag.multipass.acceptance import (
    AcceptanceResult,
    RejectionCategory,
    run_acceptance_pass,
)

__all__ = [
    "AcceptanceResult",
    "RejectionCategory",
    "run_acceptance_pass",
]
