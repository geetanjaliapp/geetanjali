#!/usr/bin/env python3
"""
Standalone script to test and tune Ollama LLM parameters for RAG pipeline.

Usage:
    cd backend
    source venv/bin/activate
    python ../scripts/test_ollama_rag.py [options]

Options:
    --model MODEL         Ollama model (default: phi3:mini)
    --timeout SECONDS     Request timeout (default: 300)
    --max-tokens TOKENS   Max tokens to generate (default: 4096)
    --temperature TEMP    Temperature (default: 0.7)
    --top-k K             Number of verses to retrieve (default: 3)
    --prompt TYPE         Prompt type: full or simple (default: simple)
    --case TEXT           Custom case description
"""

import argparse
import json
import time
import sys
import os
import warnings

# Suppress SSL warnings
warnings.filterwarnings('ignore')

import requests

# Add backend to path for imports
BACKEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')
sys.path.insert(0, BACKEND_DIR)

# Try to import from backend, fall back to inline definitions
try:
    from services.prompts import (
        SYSTEM_PROMPT,
        OLLAMA_SYSTEM_PROMPT,
        build_user_prompt,
        build_ollama_prompt,
        post_process_ollama_response
    )
    USING_BACKEND = True
except ImportError:
    USING_BACKEND = False
    # Inline fallback definitions
    SYSTEM_PROMPT = """You are an AI consulting aide using Bhagavad Gita principles for ethical leadership guidance.
Output valid JSON with: executive_summary, options (3), recommended_action, reflection_prompts, sources, confidence, scholar_flag."""

    # OPTIMIZED: Reduced from 650 to ~350 chars for faster inference
    OLLAMA_SYSTEM_PROMPT = """You are an ethical leadership consultant using Bhagavad Gita wisdom.

Output JSON with these fields:
- executive_summary: 1-2 sentence summary
- options: array of 2 options, each with title, description, pros[], cons[], sources[]
- recommended_action: {option: number, steps: [], sources: []}
- reflection_prompts: 2 questions
- sources: [{canonical_id, paraphrase, relevance}]
- confidence: 0.0-1.0
- scholar_flag: boolean

Use verse IDs like BG_2_47. Output ONLY valid JSON."""

    def build_user_prompt(case_data, retrieved_verses):
        parts = [
            f"# Case\nTitle: {case_data.get('title', 'N/A')}\n",
            f"Role: {case_data.get('role', 'N/A')}\n",
            f"Description: {case_data.get('description', 'N/A')}\n",
            "\n# Gita Verses\n"
        ]
        for i, v in enumerate(retrieved_verses, 1):
            m = v.get('metadata', {})
            parts.append(f"{i}. {m.get('canonical_id', '?')}: {m.get('paraphrase', 'N/A')}\n")
        parts.append("\n# Task\nProvide JSON consulting brief using Gita principles.\n")
        return "".join(parts)

    build_ollama_prompt = build_user_prompt

    def post_process_ollama_response(raw, verses):
        import re
        try:
            return json.loads(raw)
        except:
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group())
                except:
                    pass
        return {"executive_summary": "Parse failed", "options": [], "confidence": 0.1, "scholar_flag": True}

# Default test case
DEFAULT_CASE = {
    "title": "Ethical Leadership Dilemma",
    "description": "I am a team lead facing a difficult decision. One of my top performers has been taking credit for other team members work. Confronting them might cause them to leave, but ignoring it hurts team morale. How should I approach this situation with wisdom?",
    "role": "Team Lead",
    "stakeholders": ["team members", "top performer", "management"],
    "constraints": ["retention of key talent", "team morale"],
    "horizon": "short-term",
    "sensitivity": "medium"
}

# Mock verses for testing (similar to what ChromaDB would return)
MOCK_VERSES = [
    {
        "canonical_id": "BG_2_47",
        "document": "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
        "distance": 0.15,
        "relevance": 0.85,
        "metadata": {
            "canonical_id": "BG_2_47",
            "chapter": 2,
            "verse": 47,
            "paraphrase": "Focus on duty, not results. Act with dedication but release attachment to outcomes.",
            "principles": "nishkama_karma, duty, detachment"
        }
    },
    {
        "canonical_id": "BG_3_21",
        "document": "Whatever action a great man performs, common men follow. Whatever standards he sets by exemplary acts, all the world pursues.",
        "distance": 0.22,
        "relevance": 0.78,
        "metadata": {
            "canonical_id": "BG_3_21",
            "chapter": 3,
            "verse": 21,
            "paraphrase": "Leaders set standards through their actions. People follow what leaders do, not just what they say.",
            "principles": "leadership, example, influence"
        }
    },
    {
        "canonical_id": "BG_18_63",
        "document": "Thus I have explained to you knowledge still more confidential. Deliberate on this fully, and then do what you wish to do.",
        "distance": 0.28,
        "relevance": 0.72,
        "metadata": {
            "canonical_id": "BG_18_63",
            "chapter": 18,
            "verse": 63,
            "paraphrase": "After gaining knowledge and reflecting deeply, make your own choice. True wisdom leads to right action.",
            "principles": "reflection, choice, wisdom"
        }
    },
    {
        "canonical_id": "BG_6_5",
        "document": "One must elevate, not degrade, oneself by one's own mind. The mind alone is the friend of the conditioned soul, and the mind is also its enemy.",
        "distance": 0.32,
        "relevance": 0.68,
        "metadata": {
            "canonical_id": "BG_6_5",
            "chapter": 6,
            "verse": 5,
            "paraphrase": "Elevate yourself through self-discipline. Your mind can be your greatest ally or adversary.",
            "principles": "self-mastery, discipline, mindfulness"
        }
    },
    {
        "canonical_id": "BG_12_15",
        "document": "He by whom no one is put into difficulty and who is not disturbed by anyone, who is equipoised in happiness and distress, fear and anxiety, is very dear to Me.",
        "distance": 0.35,
        "relevance": 0.65,
        "metadata": {
            "canonical_id": "BG_12_15",
            "chapter": 12,
            "verse": 15,
            "paraphrase": "Remain balanced in all situations. Do not cause distress to others or be disturbed by circumstances.",
            "principles": "equanimity, compassion, balance"
        }
    }
]


def call_ollama(
    prompt: str,
    system_prompt: str,
    model: str = "phi3:mini",
    base_url: str = "http://localhost:11434",
    timeout: int = 300,
    max_tokens: int = 4096,
    temperature: float = 0.7
) -> dict:
    """Call Ollama API directly."""

    payload = {
        "model": model,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
        "format": "json",  # OPTIMIZATION: Force JSON output mode
        "options": {
            "temperature": 0.3,  # OPTIMIZATION: Lower temp for deterministic JSON
            "num_predict": max_tokens
        }
    }

    print(f"\n{'='*60}")
    print(f"Calling Ollama: {model}")
    print(f"Timeout: {timeout}s, Max tokens: {max_tokens}, Temp: {temperature}")
    print(f"Prompt length: {len(prompt)} chars")
    print(f"System prompt length: {len(system_prompt)} chars")
    print(f"{'='*60}\n")

    start_time = time.time()

    try:
        response = requests.post(
            f"{base_url}/api/generate",
            json=payload,
            timeout=timeout
        )
        response.raise_for_status()
        result = response.json()

        elapsed = time.time() - start_time

        print(f"Response received in {elapsed:.1f}s")
        print(f"Eval count: {result.get('eval_count', 'N/A')} tokens")
        print(f"Total duration: {result.get('total_duration', 0) / 1e9:.1f}s")

        return {
            "response": result.get("response", ""),
            "elapsed": elapsed,
            "eval_count": result.get("eval_count", 0),
            "total_duration": result.get("total_duration", 0),
            "model": model
        }

    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"TIMEOUT after {elapsed:.1f}s")
        return {"error": "timeout", "elapsed": elapsed}
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"ERROR: {e}")
        return {"error": str(e), "elapsed": elapsed}


def parse_json_response(response_text: str) -> dict:
    """Parse JSON from LLM response."""

    # Try to extract JSON if wrapped in markdown code blocks
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        response_text = response_text[start:end].strip()

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        print(f"\nJSON Parse Error: {e}")
        print(f"Raw response (first 1000 chars):\n{response_text[:1000]}")
        return None


def main():
    parser = argparse.ArgumentParser(description="Test Ollama RAG pipeline")
    parser.add_argument("--model", default="phi3:mini", help="Ollama model")
    parser.add_argument("--base-url", default="http://localhost:11434", help="Ollama base URL")
    parser.add_argument("--timeout", type=int, default=300, help="Request timeout in seconds")
    parser.add_argument("--max-tokens", type=int, default=4096, help="Max tokens to generate")
    parser.add_argument("--temperature", type=float, default=0.7, help="Temperature")
    parser.add_argument("--top-k", type=int, default=3, help="Number of verses")
    parser.add_argument("--prompt", choices=["full", "simple"], default="simple", help="Prompt type")
    parser.add_argument("--case", type=str, help="Custom case description")
    parser.add_argument("--show-prompt", action="store_true", help="Show full prompt")
    parser.add_argument("--show-response", action="store_true", help="Show raw response")

    args = parser.parse_args()

    # Prepare case data
    case_data = DEFAULT_CASE.copy()
    if args.case:
        case_data["description"] = args.case
        case_data["title"] = "Custom Case"

    # Select verses
    verses = MOCK_VERSES[:args.top_k]

    # Build prompts
    if args.prompt == "full":
        prompt = build_user_prompt(case_data, verses)
        system_prompt = SYSTEM_PROMPT
    else:
        prompt = build_ollama_prompt(case_data, verses)
        system_prompt = OLLAMA_SYSTEM_PROMPT

    print(f"\n{'#'*60}")
    print(f"# OLLAMA RAG PIPELINE TEST")
    print(f"{'#'*60}")
    print(f"\nCase: {case_data['title']}")
    print(f"Description: {case_data['description'][:100]}...")
    print(f"Verses: {args.top_k}")
    print(f"Prompt type: {args.prompt}")

    if args.show_prompt:
        print(f"\n{'='*60}")
        print("SYSTEM PROMPT:")
        print(f"{'='*60}")
        print(system_prompt)
        print(f"\n{'='*60}")
        print("USER PROMPT:")
        print(f"{'='*60}")
        print(prompt)

    # Call Ollama
    result = call_ollama(
        prompt=prompt,
        system_prompt=system_prompt,
        model=args.model,
        base_url=args.base_url,
        timeout=args.timeout,
        max_tokens=args.max_tokens,
        temperature=args.temperature
    )

    if "error" in result:
        print(f"\n[FAILED] {result['error']}")
        return 1

    response_text = result["response"]

    if args.show_response:
        print(f"\n{'='*60}")
        print("RAW RESPONSE:")
        print(f"{'='*60}")
        print(response_text)

    # Parse JSON
    parsed = parse_json_response(response_text)

    if parsed:
        print(f"\n{'='*60}")
        print("PARSED JSON RESPONSE:")
        print(f"{'='*60}")
        print(json.dumps(parsed, indent=2))

        # Validate structure
        print(f"\n{'='*60}")
        print("VALIDATION:")
        print(f"{'='*60}")

        checks = [
            ("executive_summary", "executive_summary" in parsed),
            ("options (>= 2)", len(parsed.get("options", [])) >= 2),
            ("recommended_action", "recommended_action" in parsed),
            ("reflection_prompts", "reflection_prompts" in parsed),
            ("sources", "sources" in parsed),
            ("confidence", "confidence" in parsed),
        ]

        all_pass = True
        for name, passed in checks:
            status = "[PASS]" if passed else "[FAIL]"
            print(f"  {status} {name}")
            if not passed:
                all_pass = False

        if all_pass:
            print(f"\n[SUCCESS] All validations passed!")

            # Try post-processing for Ollama
            try:
                processed = post_process_ollama_response(response_text, verses)
                print(f"\nPost-processed confidence: {processed.get('confidence', 'N/A')}")
                print(f"Scholar flag: {processed.get('scholar_flag', 'N/A')}")
            except Exception as e:
                print(f"\nPost-processing error: {e}")
        else:
            print(f"\n[PARTIAL] Some validations failed - may need post-processing")
    else:
        print(f"\n[FAILED] Could not parse JSON response")

        # Try post-processing even on failed JSON
        print("\nAttempting post-processing on raw response...")
        try:
            processed = post_process_ollama_response(response_text, verses)
            print(f"\n{'='*60}")
            print("POST-PROCESSED RESPONSE:")
            print(f"{'='*60}")
            print(json.dumps(processed, indent=2))
            print(f"\n[RECOVERED] Post-processing created valid response")
        except Exception as e:
            print(f"Post-processing also failed: {e}")
            return 1

    print(f"\n{'='*60}")
    print("SUMMARY:")
    print(f"{'='*60}")
    print(f"Model: {args.model}")
    print(f"Time: {result['elapsed']:.1f}s")
    print(f"Tokens generated: {result.get('eval_count', 'N/A')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
