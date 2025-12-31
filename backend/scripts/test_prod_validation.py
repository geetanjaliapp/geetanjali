#!/usr/bin/env python3
# flake8: noqa: E501
"""
Test production data against our new validation and extraction fixes.

This script pulls actual production outputs with validation issues
and confirms they are now handled correctly by our improvements.
"""

import logging
import sys

# Set up logging
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Add backend to path
sys.path.insert(0, "/Users/vmx/workspace/github/geetanjaliapp/geetanjali/backend")

from services.rag import RAGPipeline
from utils.json_parsing import extract_json_from_text

# Real production output from database (case with 2 options instead of 3)
PROD_OUTPUT_2_OPTIONS = """{
  "suggested_title": "Dharma and Duty: Balancing Ambition with Family Care",
  "executive_summary": "This dilemma reflects the eternal tension between personal advancement (artha) and familial duty (dharma). The Geeta teaches that true success comes from fulfilling your rightful duties without attachment to outcomes, while maintaining clarity of purpose.",
  "options": [
    {
      "title": "Accept Promotion with Relocation",
      "description": "Pursue career advancement by accepting the promotion and relocating, potentially arranging alternative care solutions for parents.",
      "pros": ["Fulfills svadharma", "Demonstrates non-attachment", "Creates financial capacity", "Honors nishkama karma"],
      "cons": ["May compromise filial duty", "Risk of guilt", "Potential deterioration", "Tamasic influences"],
      "sources": ["BG_2_47", "BG_3_35", "BG_18_48"]
    },
    {
      "title": "Remain in Current Role to Care for Parents",
      "description": "Decline promotion and maintain current position to provide direct care.",
      "pros": ["Honors pitr-dharma", "Demonstrates sattvic alignment", "Maintains emotional stability", "Creates opportunity for growth"],
      "cons": ["May suppress development", "Risk of resentment", "Limited financial resources", "Tamasic resistance"],
      "sources": ["BG_2_31", "BG_18_41", "BG_3_35"]
    }
  ],
  "recommended_action": {
    "option": 1,
    "steps": ["Assess parents' needs", "Explore hybrid solutions", "Make decision based on dharma", "Commit with nishkama karma"],
    "sources": ["BG_2_47", "BG_3_30", "BG_18_45"]
  },
  "reflection_prompts": ["Am I choosing based on dharma or attachment?", "What would a wise observer recognize?"],
  "sources": [
    {
      "canonical_id": "BG_2_47",
      "paraphrase": "You have the right to work only, but never to its fruits.",
      "relevance": 0.95
    },
    {
      "canonical_id": "BG_3_35",
      "paraphrase": "Better to follow one's own dharma imperfectly than another's perfectly.",
      "relevance": 0.88
    },
    {
      "canonical_id": "BG_18_45",
      "paraphrase": "By performing one's own work, a person attains perfection.",
      "relevance": 0.82
    }
  ],
  "confidence": 0.72,
  "scholar_flag": true
}"""


def test_production_output():
    """Test that production output with 2 options is handled correctly."""
    print("\n" + "=" * 80)
    print("PRODUCTION DATA VALIDATION TEST")
    print("=" * 80)

    print("\n[1] Testing JSON Extraction on Production Output")
    print("-" * 80)

    try:
        parsed = extract_json_from_text(PROD_OUTPUT_2_OPTIONS)
        print("✅ JSON extraction successful")
        print(f"   - Title: {parsed.get('suggested_title')}")
        print(
            f"   - Options count (before validation): {len(parsed.get('options', []))}"
        )
        print(f"   - Confidence: {parsed.get('confidence')}")
        print(f"   - Scholar flag: {parsed.get('scholar_flag')}")
    except Exception as e:
        print(f"❌ JSON extraction failed: {e}")
        return False

    print("\n[2] Testing Validation on Production Output")
    print("-" * 80)

    try:
        # Create RAGPipeline instance to access validate_output method
        pipeline = RAGPipeline()
        validated_output = pipeline.validate_output(parsed)
        print("✅ Validation passed")

        # The validate_output method modifies the output in place
        # Check if constraint was enforced
        options_count = len(validated_output.get("options", []))
        print("\nConstraint Check:")
        print(f"  - Options count (after validation): {options_count}")

        if options_count < 3:
            print(
                f"  ❌ Still has only {options_count} options (constraint NOT satisfied)"
            )
            return False
        else:
            print("  ✅ Now has 3 options (constraint satisfied)")

    except Exception as e:
        print(f"❌ Validation failed with exception: {e}")
        import traceback

        traceback.print_exc()
        return False

    print("\n[3] Verifying Output Structure After Validation")
    print("-" * 80)

    # Check critical fields
    checks = {
        "executive_summary": (
            "non-empty string",
            lambda x: isinstance(x, str) and len(x) > 0,
        ),
        "options": (
            "list with 3+ items",
            lambda x: isinstance(x, list) and len(x) >= 3,
        ),
        "recommended_action": (
            "dict with option and steps",
            lambda x: isinstance(x, dict) and "option" in x and "steps" in x,
        ),
        "reflection_prompts": (
            "non-empty list",
            lambda x: isinstance(x, list) and len(x) > 0,
        ),
        "sources": (
            "list of source objects",
            lambda x: isinstance(x, list) and len(x) > 0,
        ),
        "confidence": (
            "number between 0 and 1",
            lambda x: isinstance(x, int | float) and 0 <= x <= 1,
        ),
        "scholar_flag": ("boolean", lambda x: isinstance(x, bool)),
    }

    all_passed = True
    for field, (description, validator) in checks.items():
        value = validated_output.get(field)
        is_valid = validator(value)
        status = "✅" if is_valid else "❌"
        print(f"{status} {field}: {description}")
        if not is_valid:
            print(f"   Actual: {type(value).__name__} = {value}")
            all_passed = False

    print("\n[4] Detailed Options Check")
    print("-" * 80)

    for i, option in enumerate(validated_output.get("options", []), 1):
        print(f"Option {i}: {option.get('title', 'MISSING TITLE')}")
        required = {
            "title": "string",
            "description": "string",
            "pros": "list",
            "cons": "list",
            "sources": "list of strings",
        }
        for field, expected_type in required.items():
            value = option.get(field)
            is_valid = value is not None and (
                (expected_type == "string" and isinstance(value, str))
                or (expected_type == "list" and isinstance(value, list))
                or (
                    expected_type == "list of strings"
                    and isinstance(value, list)
                    and all(isinstance(s, str) for s in value)
                )
            )
            status = "  ✅" if is_valid else "  ❌"
            print(f"{status} {field}: {type(value).__name__}")

    print("\n" + "=" * 80)
    print("RESULT")
    print("=" * 80)

    if all_passed and is_valid:
        print("✅ PRODUCTION OUTPUT VALIDATION PASSED")
        print("\nConclusion:")
        print("- Our three-layer defense successfully handled the constraint violation")
        print("- Output that originally had only 2 options was validated and fixed")
        print("- All required fields are present and properly formatted")
        return True
    else:
        print("❌ PRODUCTION OUTPUT VALIDATION FAILED")
        return False


if __name__ == "__main__":
    success = test_production_output()
    sys.exit(0 if success else 1)
