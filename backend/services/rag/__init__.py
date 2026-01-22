"""
RAG (Retrieval-Augmented Generation) service package.

Provides the RAG pipeline for generating consulting briefs from case descriptions
using vector similarity search and LLM generation.

Usage:
    from services.rag import get_rag_pipeline

    pipeline = get_rag_pipeline()
    result, is_policy_violation = pipeline.run(case_data)
"""

# Escalation functions
from .escalation import (
    describe_escalation_reason,
    get_escalation_threshold,
    should_escalate_to_fallback,
)
from .pipeline import RAGPipeline, get_rag_pipeline

# Validation functions (re-exported for test compatibility)
from .validation import (
    _filter_source_references,
    _validate_option_structure,
    _validate_relevance,
    _validate_source_object_structure,
    _validate_source_reference,
)

__all__ = [
    "RAGPipeline",
    "get_rag_pipeline",
    # Validation (for testing)
    "_validate_relevance",
    "_validate_source_reference",
    "_validate_option_structure",
    "_validate_source_object_structure",
    "_filter_source_references",
    # Escalation
    "should_escalate_to_fallback",
    "get_escalation_threshold",
    "describe_escalation_reason",
]
