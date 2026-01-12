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
from services.rag.multipass.fallback import (
    ReconstructionResult,
    reconstruct_from_prose,
)
from services.rag.multipass.orchestrator import (
    MultiPassOrchestrator,
    MultiPassResult,
    run_multipass_consultation,
)
from services.rag.multipass.passes import (
    PassResult,
    PassStatus,
    run_critique_pass,
    run_draft_pass,
    run_refine_pass,
    run_structure_pass,
)
from services.rag.multipass.prompts import (
    build_critique_prompt,
    build_draft_prompt,
    build_refine_prompt,
    build_structure_prompt,
    format_verses_for_prompt,
)
from services.rag.multipass.rejection_response import (
    create_rejection_output,
    generate_rejection_message,
    get_fallback_message,
)

__all__ = [
    # Orchestrator
    "MultiPassOrchestrator",
    "MultiPassResult",
    "run_multipass_consultation",
    # Pass 0: Acceptance
    "AcceptanceResult",
    "RejectionCategory",
    "run_acceptance_pass",
    # Fallback reconstruction
    "ReconstructionResult",
    "reconstruct_from_prose",
    # Passes 1-4
    "PassResult",
    "PassStatus",
    "run_draft_pass",
    "run_critique_pass",
    "run_refine_pass",
    "run_structure_pass",
    # Prompt builders
    "build_draft_prompt",
    "build_critique_prompt",
    "build_refine_prompt",
    "build_structure_prompt",
    "format_verses_for_prompt",
    # Rejection response
    "generate_rejection_message",
    "get_fallback_message",
    "create_rejection_output",
]
