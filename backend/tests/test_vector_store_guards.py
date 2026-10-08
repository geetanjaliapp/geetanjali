"""Static guards on how we talk to ChromaDB.

The chromadb client builds a SentenceTransformer embedding function from server-returned
collection config -- trust_remote_code included -- whenever the caller does not pass its own.
Passing ours on every collection call is what keeps a compromised Chroma server from becoming
code execution in the backend. See the accepted-risk note above chromadb in requirements.txt.
"""

import ast
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {"venv", ".venv", ".venv-test", "htmlcov", "alembic", "tests"}
COLLECTION_CALLS = {"get_collection", "create_collection", "get_or_create_collection"}


def _collection_calls_without_embedding_function():
    offenders = []
    for path in BACKEND_ROOT.rglob("*.py"):
        if any(part in SKIP_DIRS for part in path.relative_to(BACKEND_ROOT).parts):
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr in COLLECTION_CALLS
                and not any(kw.arg == "embedding_function" for kw in node.keywords)
            ):
                offenders.append(f"{path.relative_to(BACKEND_ROOT)}:{node.lineno}")
    return offenders


def test_every_collection_call_passes_an_embedding_function():
    assert _collection_calls_without_embedding_function() == []


def test_guard_finds_the_calls_it_is_guarding():
    """A guard that matches nothing passes forever; prove it sees vector_store.py."""
    source = (BACKEND_ROOT / "services" / "vector_store.py").read_text()
    calls = [
        n
        for n in ast.walk(ast.parse(source))
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr in COLLECTION_CALLS
    ]
    assert len(calls) >= 1
