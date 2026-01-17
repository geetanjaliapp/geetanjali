#!/usr/bin/env python3
"""
Gemini LLM Conformance Test Script.

Tests that Gemini returns properly structured JSON responses that conform
to application expectations. Run before deploying Gemini-related changes.

Usage:
    cd backend
    source venv/bin/activate
    python ../scripts/test_gemini.py [options]

    # Or via make:
    make test-gemini

Options:
    --provider PROVIDER   LLM provider: gemini, anthropic, or compare (default: gemini)
    --case TEXT           Custom case description
    --verbose             Show full prompts and responses
    --strict              Fail on any validation warning (not just errors)
"""

import argparse
import json
import os
import re
import sys
import time

# Add backend to path for imports
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, BACKEND_DIR)

# Colors for terminal output
RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color


def log_pass(msg: str) -> None:
    print(f"  {GREEN}[PASS]{NC} {msg}")


def log_fail(msg: str) -> None:
    print(f"  {RED}[FAIL]{NC} {msg}")


def log_warn(msg: str) -> None:
    print(f"  {YELLOW}[WARN]{NC} {msg}")


def log_info(msg: str) -> None:
    print(f"  {BLUE}[INFO]{NC} {msg}")


# Default test case - designed to exercise verse retrieval and ethical reasoning
DEFAULT_CASE = {
    "title": "Professional Ethics Dilemma",
    "description": (
        "I am a senior engineer and my manager asked me to present work done by "
        "a junior colleague as if it were my own contribution to impress stakeholders. "
        "The junior developer needs visibility for their career growth, but refusing "
        "might affect my relationship with my manager."
    ),
    "role": "Senior Engineer",
    "stakeholders": ["Self", "Junior Developer", "Manager", "Stakeholders"],
    "constraints": ["maintain integrity", "career considerations"],
    "horizon": "short-term",
    "sensitivity": "medium",
}

# Mock verses for testing (simulates RAG retrieval)
# These have canonical_id at top level (pipeline format)
MOCK_VERSES = [
    {
        "canonical_id": "BG_2_47",
        "document": "You have a right to perform your prescribed duties...",
        "distance": 0.15,
        "relevance": 0.85,
        "paraphrase": "Focus on duty, not results. Act with dedication but release attachment to outcomes.",
        "translation_en": "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
        "principles": "nishkama_karma, duty, detachment",
        "metadata": {
            "canonical_id": "BG_2_47",
            "chapter": 2,
            "verse": 47,
            "paraphrase": "Focus on duty, not results.",
        },
    },
    {
        "canonical_id": "BG_3_21",
        "document": "Whatever action a great man performs, common men follow...",
        "distance": 0.22,
        "relevance": 0.78,
        "paraphrase": "Leaders set standards through their actions. People follow what leaders do.",
        "translation_en": "Whatever action a great man performs, common men follow.",
        "principles": "leadership, example, influence",
        "metadata": {
            "canonical_id": "BG_3_21",
            "chapter": 3,
            "verse": 21,
            "paraphrase": "Leaders set standards through their actions.",
        },
    },
    {
        "canonical_id": "BG_18_63",
        "document": "Thus I have explained to you knowledge still more confidential...",
        "distance": 0.28,
        "relevance": 0.72,
        "paraphrase": "After gaining knowledge and reflecting deeply, make your own choice.",
        "translation_en": "Deliberate on this fully, and then do what you wish to do.",
        "principles": "reflection, choice, wisdom",
        "metadata": {
            "canonical_id": "BG_18_63",
            "chapter": 18,
            "verse": 63,
            "paraphrase": "After reflecting deeply, make your own choice.",
        },
    },
    {
        "canonical_id": "BG_6_5",
        "document": "One must elevate, not degrade, oneself by one's own mind...",
        "distance": 0.32,
        "relevance": 0.68,
        "paraphrase": "Elevate yourself through self-discipline. Your mind can be ally or adversary.",
        "translation_en": "One must elevate oneself by one's own mind.",
        "principles": "self-mastery, discipline, mindfulness",
        "metadata": {
            "canonical_id": "BG_6_5",
            "chapter": 6,
            "verse": 5,
            "paraphrase": "Elevate yourself through self-discipline.",
        },
    },
    {
        "canonical_id": "BG_12_15",
        "document": "He by whom no one is put into difficulty...",
        "distance": 0.35,
        "relevance": 0.65,
        "paraphrase": "Remain balanced in all situations. Do not cause distress to others.",
        "translation_en": "He who does not disturb anyone is very dear to Me.",
        "principles": "equanimity, compassion, balance",
        "metadata": {
            "canonical_id": "BG_12_15",
            "chapter": 12,
            "verse": 15,
            "paraphrase": "Remain balanced in all situations.",
        },
    },
]

# Valid canonical_id pattern
CANONICAL_ID_PATTERN = re.compile(r"^BG_\d+_\d+$")


def validate_canonical_id(verse_id: str) -> bool:
    """Check if verse ID matches BG_X_Y format."""
    return bool(CANONICAL_ID_PATTERN.match(verse_id))


def get_valid_verse_ids() -> set[str]:
    """Get set of valid verse IDs from mock verses."""
    return {v["canonical_id"] for v in MOCK_VERSES}


def run_gemini_consultation(
    case_data: dict, verses: list, verbose: bool = False
) -> tuple[dict | None, float, str]:
    """
    Run a consultation through Gemini and return the result.

    Returns:
        Tuple of (parsed_result, elapsed_time, raw_response)
    """
    from config import settings
    from services.llm import LLMService
    from services.prompts import SYSTEM_PROMPT, build_user_prompt

    # Build prompts
    user_prompt = build_user_prompt(case_data, verses)
    system_prompt = SYSTEM_PROMPT

    if verbose:
        print(f"\n{'='*60}")
        print("SYSTEM PROMPT (first 500 chars):")
        print(f"{'='*60}")
        print(system_prompt[:500] + "...")
        print(f"\n{'='*60}")
        print("USER PROMPT:")
        print(f"{'='*60}")
        print(user_prompt)

    # Initialize LLM service
    llm = LLMService()

    print(f"\nCalling Gemini (model: {settings.GEMINI_MODEL})...")
    print(f"Timeout: {settings.GEMINI_TIMEOUT}ms")

    start_time = time.time()

    try:
        result = llm._generate_gemini(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=settings.GEMINI_MAX_TOKENS,
            json_mode=True,
        )
        elapsed = time.time() - start_time

        # LLM service returns {"response": text, "model": ..., "provider": ...}
        raw_response = result.get("response", "")

        # Parse JSON from response
        parsed = None
        if raw_response:
            try:
                parsed = json.loads(raw_response)
            except json.JSONDecodeError as e:
                print(f"\n{RED}[ERROR]{NC} Failed to parse JSON: {e}")
                print(f"Raw response (first 500 chars): {raw_response[:500]}")

        if verbose and raw_response:
            print(f"\n{'='*60}")
            print("RAW RESPONSE:")
            print(f"{'='*60}")
            print(raw_response[:2000] + ("..." if len(raw_response) > 2000 else ""))

        return parsed, elapsed, raw_response

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n{RED}[ERROR]{NC} Gemini call failed: {e}")
        return None, elapsed, str(e)


def run_anthropic_consultation(
    case_data: dict, verses: list, verbose: bool = False
) -> tuple[dict | None, float, str]:
    """
    Run a consultation through Anthropic for comparison.

    Returns:
        Tuple of (parsed_result, elapsed_time, raw_response)
    """
    from config import settings
    from services.llm import LLMService
    from services.prompts import SYSTEM_PROMPT, build_user_prompt

    user_prompt = build_user_prompt(case_data, verses)
    system_prompt = SYSTEM_PROMPT

    llm = LLMService()

    print(f"\nCalling Anthropic (model: {settings.ANTHROPIC_MODEL})...")
    print(f"Timeout: {settings.ANTHROPIC_TIMEOUT}s")

    start_time = time.time()

    try:
        result = llm._generate_anthropic(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=settings.ANTHROPIC_MAX_TOKENS,
        )
        elapsed = time.time() - start_time

        # LLM service returns {"response": text, "model": ..., "provider": ...}
        raw_response = result.get("response", "")

        # Parse JSON from response
        parsed = None
        if raw_response:
            try:
                parsed = json.loads(raw_response)
            except json.JSONDecodeError as e:
                print(f"\n{RED}[ERROR]{NC} Failed to parse JSON: {e}")
                print(f"Raw response (first 500 chars): {raw_response[:500]}")

        if verbose and raw_response:
            print(f"\n{'='*60}")
            print("RAW RESPONSE:")
            print(f"{'='*60}")
            print(raw_response[:2000] + ("..." if len(raw_response) > 2000 else ""))

        return parsed, elapsed, raw_response

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n{RED}[ERROR]{NC} Anthropic call failed: {e}")
        return None, elapsed, str(e)


def validate_response(
    parsed: dict, valid_verse_ids: set[str], strict: bool = False
) -> tuple[bool, list[str], list[str]]:
    """
    Validate the parsed response against expected structure.

    Returns:
        Tuple of (passed, errors, warnings)
    """
    errors = []
    warnings = []

    if parsed is None:
        errors.append("Response is None - failed to parse JSON")
        return False, errors, warnings

    # Required fields
    required_fields = [
        "executive_summary",
        "options",
        "recommended_action",
        "sources",
        "confidence",
    ]

    for field in required_fields:
        if field not in parsed:
            errors.append(f"Missing required field: {field}")

    # Validate options
    options = parsed.get("options", [])
    if not isinstance(options, list):
        errors.append("options must be a list")
    elif len(options) != 3:
        if len(options) < 3:
            errors.append(f"Expected exactly 3 options, got {len(options)}")
        else:
            warnings.append(f"Expected 3 options, got {len(options)} (extra options)")

    # Validate each option
    for i, opt in enumerate(options):
        if not isinstance(opt, dict):
            errors.append(f"Option {i+1} is not a dict")
            continue

        opt_required = ["title", "description", "pros", "cons"]
        for field in opt_required:
            if field not in opt:
                warnings.append(f"Option {i+1} missing field: {field}")

        # Validate option sources
        opt_sources = opt.get("sources", [])
        for src in opt_sources:
            if isinstance(src, str):
                if not validate_canonical_id(src):
                    errors.append(f"Option {i+1} has invalid source format: {src}")
                elif src not in valid_verse_ids:
                    warnings.append(
                        f"Option {i+1} references verse not in context: {src}"
                    )

    # Validate sources array
    sources = parsed.get("sources", [])
    if not isinstance(sources, list):
        errors.append("sources must be a list")
    else:
        for i, src in enumerate(sources):
            if not isinstance(src, dict):
                warnings.append(f"Source {i+1} is not a dict")
                continue

            canonical_id = src.get("canonical_id", "")
            if not validate_canonical_id(canonical_id):
                errors.append(f"Source {i+1} has invalid canonical_id: {canonical_id}")
            elif canonical_id not in valid_verse_ids:
                warnings.append(f"Source {i+1} references verse not in context: {canonical_id}")

            if "relevance" in src:
                rel = src["relevance"]
                if not isinstance(rel, (int, float)):
                    warnings.append(f"Source {i+1} relevance is not a number: {rel}")
                elif not (0.0 <= rel <= 1.0):
                    warnings.append(f"Source {i+1} relevance out of range: {rel}")

    # Validate confidence
    confidence = parsed.get("confidence")
    if confidence is not None:
        if not isinstance(confidence, (int, float)):
            errors.append(f"confidence is not a number: {confidence}")
        elif not (0.0 <= confidence <= 1.0):
            warnings.append(f"confidence out of range: {confidence}")

    # Validate recommended_action
    rec = parsed.get("recommended_action")
    if rec is not None and isinstance(rec, dict):
        rec_sources = rec.get("sources", [])
        for src in rec_sources:
            if isinstance(src, str):
                if not validate_canonical_id(src):
                    errors.append(f"recommended_action has invalid source: {src}")
                elif src not in valid_verse_ids:
                    warnings.append(
                        f"recommended_action references verse not in context: {src}"
                    )

    # Determine pass/fail
    passed = len(errors) == 0
    if strict and len(warnings) > 0:
        passed = False

    return passed, errors, warnings


def main():
    parser = argparse.ArgumentParser(description="Test Gemini LLM conformance")
    parser.add_argument(
        "--provider",
        choices=["gemini", "anthropic", "compare"],
        default="gemini",
        help="LLM provider to test",
    )
    parser.add_argument("--case", type=str, help="Custom case description")
    parser.add_argument(
        "--verbose", action="store_true", help="Show full prompts and responses"
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on warnings (not just errors)",
    )

    args = parser.parse_args()

    print(f"\n{'#'*60}")
    print(f"# GEMINI CONFORMANCE TEST")
    print(f"{'#'*60}")

    # Prepare case data
    case_data = DEFAULT_CASE.copy()
    if args.case:
        case_data["description"] = args.case
        case_data["title"] = "Custom Case"

    print(f"\nCase: {case_data['title']}")
    print(f"Description: {case_data['description'][:100]}...")
    print(f"Provider: {args.provider}")
    print(f"Strict mode: {args.strict}")

    # Get valid verse IDs
    valid_ids = get_valid_verse_ids()
    print(f"Valid verse IDs: {', '.join(sorted(valid_ids))}")

    results = {}

    # Run tests based on provider
    if args.provider in ["gemini", "compare"]:
        print(f"\n{'='*60}")
        print("GEMINI TEST")
        print(f"{'='*60}")

        parsed, elapsed, raw = run_gemini_consultation(
            case_data, MOCK_VERSES, args.verbose
        )

        print(f"\nElapsed: {elapsed:.1f}s")

        passed, errors, warnings = validate_response(parsed, valid_ids, args.strict)

        print(f"\n{'='*60}")
        print("GEMINI VALIDATION")
        print(f"{'='*60}")

        for err in errors:
            log_fail(err)
        for warn in warnings:
            log_warn(warn)

        if passed:
            log_pass("All validations passed")
            if parsed:
                log_info(f"Options: {len(parsed.get('options', []))}")
                log_info(f"Sources: {len(parsed.get('sources', []))}")
                log_info(f"Confidence: {parsed.get('confidence', 'N/A')}")

        results["gemini"] = {
            "passed": passed,
            "errors": errors,
            "warnings": warnings,
            "elapsed": elapsed,
            "parsed": parsed,
        }

    if args.provider in ["anthropic", "compare"]:
        print(f"\n{'='*60}")
        print("ANTHROPIC TEST")
        print(f"{'='*60}")

        parsed, elapsed, raw = run_anthropic_consultation(
            case_data, MOCK_VERSES, args.verbose
        )

        print(f"\nElapsed: {elapsed:.1f}s")

        passed, errors, warnings = validate_response(parsed, valid_ids, args.strict)

        print(f"\n{'='*60}")
        print("ANTHROPIC VALIDATION")
        print(f"{'='*60}")

        for err in errors:
            log_fail(err)
        for warn in warnings:
            log_warn(warn)

        if passed:
            log_pass("All validations passed")
            if parsed:
                log_info(f"Options: {len(parsed.get('options', []))}")
                log_info(f"Sources: {len(parsed.get('sources', []))}")
                log_info(f"Confidence: {parsed.get('confidence', 'N/A')}")

        results["anthropic"] = {
            "passed": passed,
            "errors": errors,
            "warnings": warnings,
            "elapsed": elapsed,
            "parsed": parsed,
        }

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    all_passed = True
    for provider, result in results.items():
        status = f"{GREEN}PASS{NC}" if result["passed"] else f"{RED}FAIL{NC}"
        print(
            f"  {provider}: {status} "
            f"({len(result['errors'])} errors, {len(result['warnings'])} warnings, "
            f"{result['elapsed']:.1f}s)"
        )
        if not result["passed"]:
            all_passed = False

    if args.provider == "compare" and len(results) == 2:
        print(f"\n{'='*60}")
        print("COMPARISON")
        print(f"{'='*60}")

        g = results.get("gemini", {}).get("parsed", {})
        a = results.get("anthropic", {}).get("parsed", {})

        if g and a:
            g_opts = len(g.get("options", []))
            a_opts = len(a.get("options", []))
            g_srcs = len(g.get("sources", []))
            a_srcs = len(a.get("sources", []))
            g_conf = g.get("confidence", 0)
            a_conf = a.get("confidence", 0)

            print(f"  Options:    Gemini={g_opts}, Anthropic={a_opts}")
            print(f"  Sources:    Gemini={g_srcs}, Anthropic={a_srcs}")
            print(f"  Confidence: Gemini={g_conf:.2f}, Anthropic={a_conf:.2f}")

    print()
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
