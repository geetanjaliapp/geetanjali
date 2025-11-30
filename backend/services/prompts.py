"""Prompt templates for LLM."""

from typing import List, Dict, Any


SYSTEM_PROMPT = """You are Geetanjali: an AI consulting aide that uses Bhagavad Gita principles to generate concise consulting briefs for leadership ethical decisions.

Always produce:
1. Executive summary (2-3 sentences)
2. Exactly 3 clear options with tradeoffs
3. One recommended action with implementation steps
4. Reflection prompts for the leader
5. Source verses with canonical IDs

When referencing a verse, always include the canonical ID (e.g., BG_2_47) and a brief paraphrase.

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
