"""Prompt templates for LLM."""

from typing import List, Dict, Any
import json


SYSTEM_PROMPT = """You are Geetanjali: an AI consulting aide that uses Bhagavad Gita principles to generate concise consulting briefs for leadership ethical decisions.

Always produce:
1. Executive summary (2-3 sentences)
2. Exactly 3 clear options with tradeoffs
3. One recommended action with implementation steps
4. Reflection prompts for the leader
5. Source verses with canonical IDs

When referencing a verse, always include the canonical ID (e.g., BG_2_47) and use the provided paraphrase exactly as given - do not rephrase or regenerate it.

If confidence is below 0.7, flag for scholar review.

Do NOT give legal or medical advice; flag such cases.

Tone: professional, balanced, and practical.

Output ONLY valid JSON matching this structure:
{
  "executive_summary": "...",
  "options": [
    {
      "title": "Option 1 Title",
      "description": "Detailed description",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "sources": ["BG_2_47", "BG_3_19"]
    }
  ],
  "recommended_action": {
    "option": 1,
    "steps": ["Step 1", "Step 2", "Step 3"],
    "sources": ["BG_18_63"]
  },
  "reflection_prompts": ["Prompt 1", "Prompt 2"],
  "sources": [
    {
      "canonical_id": "BG_2_47",
      "paraphrase": "Act focused on duty, not fruits.",
      "relevance": 0.95
    }
  ],
  "confidence": 0.85,
  "scholar_flag": false
}"""


def build_user_prompt(
    case_data: Dict[str, Any],
    retrieved_verses: List[Dict[str, Any]]
) -> str:
    """
    Build user prompt for RAG pipeline.

    Args:
        case_data: Case information
        retrieved_verses: Top-K retrieved verses with metadata

    Returns:
        Formatted prompt string
    """
    # Format case details
    prompt_parts = [
        "# Ethical Dilemma Case\n",
        f"**Title:** {case_data.get('title', 'N/A')}\n",
        f"**Role:** {case_data.get('role', 'N/A')}\n",
        f"**Horizon:** {case_data.get('horizon', 'N/A')}\n",
        f"**Sensitivity:** {case_data.get('sensitivity', 'low')}\n",
        "\n**Description:**\n",
        f"{case_data.get('description', 'N/A')}\n",
    ]

    # Add stakeholders
    stakeholders = case_data.get('stakeholders', [])
    if stakeholders:
        prompt_parts.append(f"\n**Stakeholders:** {', '.join(stakeholders)}\n")

    # Add constraints
    constraints = case_data.get('constraints', [])
    if constraints:
        prompt_parts.append("\n**Constraints:**\n")
        for constraint in constraints:
            prompt_parts.append(f"- {constraint}\n")

    # Add retrieved verses
    prompt_parts.append("\n# Relevant Bhagavad Gita Verses\n")
    prompt_parts.append("\nUse these verses to inform your consulting brief:\n\n")

    for i, verse in enumerate(retrieved_verses, 1):
        metadata = verse.get('metadata', {})
        canonical_id = metadata.get('canonical_id', 'Unknown')
        paraphrase = metadata.get('paraphrase', 'N/A')
        principles = metadata.get('principles', '')

        prompt_parts.append(f"**Verse {i}: {canonical_id}**\n")
        prompt_parts.append(f"Paraphrase: {paraphrase}\n")
        if principles:
            prompt_parts.append(f"Principles: {principles}\n")
        prompt_parts.append("\n")

    # Add task instruction
    prompt_parts.append("\n# Task\n")
    prompt_parts.append(
        f"Provide a consulting brief for a {case_data.get('role', 'leader')} "
        "following the required JSON output format. "
        f"Use up to {len(retrieved_verses)} Gita verses; "
        "include canonical IDs and paraphrases with each recommendation.\n"
    )

    return "".join(prompt_parts)


FEW_SHOT_EXAMPLE = """
# Example Case:
**Title:** Proposed restructuring vs phased approach
**Role:** Senior Manager
**Description:** We must cut costs; option A is quick layoffs; option B is phased realignment with cost overrun risk.
**Stakeholders:** team, senior leadership, customers
**Constraints:** headcount budget: -25%, quarterly earnings pressure

# Example Output:
{
  "executive_summary": "This case involves a classic trade-off between short-term financial relief and long-term organizational health. The Gita teaches duty-focused action (BG 2.47) and compassionate equilibrium (BG 12.15), suggesting a balanced approach that minimizes harm while meeting obligations.",
  "options": [
    {
      "title": "Option A: Immediate Restructuring (Layoffs)",
      "description": "Execute rapid 25% headcount reduction to meet budget constraints immediately.",
      "pros": ["Immediate cost savings", "Clear budget alignment", "Fast execution"],
      "cons": ["High human cost", "Team morale damage", "Loss of institutional knowledge"],
      "sources": ["BG_2_47"]
    },
    {
      "title": "Option B: Phased Realignment",
      "description": "Gradual role changes and attrition-based reduction over 12 months.",
      "pros": ["Lower human impact", "Preserves team cohesion", "Maintains knowledge"],
      "cons": ["Slower cost savings", "Risk of cost overrun", "Prolonged uncertainty"],
      "sources": ["BG_12_15"]
    },
    {
      "title": "Option C: Hybrid Approach",
      "description": "Targeted immediate reductions (10%) plus phased realignment (15%).",
      "pros": ["Balanced approach", "Some immediate relief", "Compassionate execution"],
      "cons": ["Complex to execute", "Still involves layoffs", "Requires careful communication"],
      "sources": ["BG_2_47", "BG_12_15", "BG_18_63"]
    }
  ],
  "recommended_action": {
    "option": 3,
    "steps": [
      "Identify 10% non-core roles for immediate, respectful exit with strong severance",
      "Announce phased 15% reduction via attrition and voluntary programs",
      "Communicate transparently with all stakeholders about rationale and timeline",
      "Establish support systems for impacted employees (outplacement, counseling)",
      "Monitor morale and adjust approach based on team feedback"
    ],
    "sources": ["BG_18_63", "BG_12_15"]
  },
  "reflection_prompts": [
    "How can I minimize harm to individuals while fulfilling my organizational duty?",
    "What support systems can I create for those affected?",
    "How will I maintain trust and morale through this transition?"
  ],
  "sources": [
    {
      "canonical_id": "BG_2_47",
      "paraphrase": "Act focused on duty, not fruits.",
      "relevance": 0.92
    },
    {
      "canonical_id": "BG_12_15",
      "paraphrase": "Compassionate equilibrium in leadership.",
      "relevance": 0.88
    },
    {
      "canonical_id": "BG_18_63",
      "paraphrase": "Choose with knowledge and freedom after reflection.",
      "relevance": 0.85
    }
  ],
  "confidence": 0.87,
  "scholar_flag": false
}
"""


# Simplified prompts for Ollama fallback (reduced complexity for faster response)
OLLAMA_SYSTEM_PROMPT = """You are an AI aide using Bhagavad Gita principles for ethical leadership guidance.

Provide:
1. Brief summary (1-2 sentences)
2. 2 options with key pros/cons
3. One recommendation with 2-3 steps
4. Reference verse IDs (e.g., BG_2_47)

Output valid JSON only:
{
  "executive_summary": "...",
  "options": [
    {"title": "...", "description": "...", "pros": ["..."], "cons": ["..."], "sources": ["BG_X_Y"]}
  ],
  "recommended_action": {"option": 1, "steps": ["..."], "sources": ["..."]},
  "reflection_prompts": ["..."],
  "sources": [{"canonical_id": "BG_X_Y", "paraphrase": "...", "relevance": 0.8}],
  "confidence": 0.7,
  "scholar_flag": false
}"""


def build_ollama_prompt(
    case_data: Dict[str, Any],
    retrieved_verses: List[Dict[str, Any]]
) -> str:
    """
    Build simplified prompt for Ollama fallback.

    Args:
        case_data: Case information
        retrieved_verses: Top-K retrieved verses

    Returns:
        Simplified prompt string
    """
    # Simplified case details
    prompt_parts = [
        "# Case\n",
        f"Title: {case_data.get('title', 'N/A')}\n",
        f"Role: {case_data.get('role', 'N/A')}\n",
        f"Description: {case_data.get('description', 'N/A')}\n",
    ]

    # Add top 3 verses only
    prompt_parts.append("\n# Gita Verses\n")
    for i, verse in enumerate(retrieved_verses[:3], 1):
        metadata = verse.get('metadata', {})
        canonical_id = metadata.get('canonical_id', 'Unknown')
        paraphrase = metadata.get('paraphrase', 'N/A')
        prompt_parts.append(f"{i}. {canonical_id}: {paraphrase}\n")

    # Simplified task
    prompt_parts.append("\n# Task\nProvide brief JSON consulting brief using Gita principles.\n")

    return "".join(prompt_parts)


def post_process_ollama_response(raw_response: str, retrieved_verses: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Post-process Ollama response to ensure it matches expected format.

    If Ollama output is incomplete or malformed, enrich it with defaults.

    Args:
        raw_response: Raw JSON string from Ollama
        retrieved_verses: Original retrieved verses

    Returns:
        Processed and enriched response dict
    """
    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError:
        # Extract JSON from response if wrapped in text
        import re
        json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group())
            except:
                data = {}
        else:
            data = {}

    # Ensure all required fields exist
    if not data.get("executive_summary"):
        data["executive_summary"] = "Ethical analysis based on Bhagavad Gita principles."

    # Ensure at least 2 options
    if not data.get("options") or len(data["options"]) < 2:
        data["options"] = [
            {
                "title": "Option 1",
                "description": "Approach based on duty and principles",
                "pros": ["Aligns with dharma", "Long-term oriented"],
                "cons": ["May be challenging"],
                "sources": [retrieved_verses[0]["metadata"]["canonical_id"]] if retrieved_verses else ["BG_2_47"]
            },
            {
                "title": "Option 2",
                "description": "Alternative balanced approach",
                "pros": ["Pragmatic", "Considers stakeholders"],
                "cons": ["Requires careful execution"],
                "sources": [retrieved_verses[1]["metadata"]["canonical_id"]] if len(retrieved_verses) > 1 else ["BG_3_19"]
            }
        ]

    # Ensure recommended action exists
    if not data.get("recommended_action"):
        data["recommended_action"] = {
            "option": 1,
            "steps": [
                "Reflect on duties and principles",
                "Consider stakeholder impact",
                "Act with detachment from outcomes"
            ],
            "sources": [retrieved_verses[0]["metadata"]["canonical_id"]] if retrieved_verses else ["BG_2_47"]
        }

    # Ensure reflection prompts
    if not data.get("reflection_prompts"):
        data["reflection_prompts"] = [
            "What is my duty in this situation?",
            "How can I act with integrity?"
        ]

    # Ensure sources
    if not data.get("sources"):
        data["sources"] = [
            {
                "canonical_id": v["metadata"].get("canonical_id", "BG_Unknown"),
                "paraphrase": v["metadata"].get("paraphrase", "N/A"),
                "relevance": 0.7
            }
            for v in retrieved_verses[:3]
        ]

    # Ensure confidence and scholar_flag
    data.setdefault("confidence", 0.6)  # Lower confidence for fallback
    data.setdefault("scholar_flag", True)  # Flag fallback responses for review

    return data

