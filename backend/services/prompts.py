"""Prompt templates for LLM."""

import logging
import re
from typing import Any

from utils.json_parsing import extract_json_from_markdown

logger = logging.getLogger(__name__)


def get_verse_id(verse: dict, default: str = "Unknown") -> str:
    """Get canonical_id from verse dict, handling both structures.

    The RAG pipeline returns verses with canonical_id at top level,
    while some test fixtures use metadata.canonical_id.

    Args:
        verse: Verse dict from RAG pipeline or test fixture
        default: Default value if no canonical_id found

    Returns:
        The canonical_id string
    """
    # Try direct canonical_id first (pipeline format)
    if "canonical_id" in verse:
        return str(verse["canonical_id"])
    # Fall back to metadata.canonical_id (test/other format)
    if "metadata" in verse and "canonical_id" in verse.get("metadata", {}):
        return str(verse["metadata"]["canonical_id"])
    return default


def get_verse_metadata(verse: dict, key: str, default: str = "") -> str:
    """Get metadata field from verse dict, handling both structures.

    Args:
        verse: Verse dict from RAG pipeline or test fixture
        key: Metadata field name (e.g., 'paraphrase', 'translation_en')
        default: Default value if field not found

    Returns:
        The metadata field value
    """
    # Try direct field first (pipeline format)
    if key in verse:
        val = verse.get(key, default)
        return str(val) if val is not None else default
    # Fall back to metadata.field (test/other format)
    if "metadata" in verse:
        val = verse.get("metadata", {}).get(key, default)
        return str(val) if val is not None else default
    return default


SYSTEM_PROMPT = """You are Geetanjali: an AI consulting aide that uses Bhagavad Geeta principles to generate concise consulting briefs for leadership ethical decisions.

CRITICAL REQUIREMENTS - DO NOT DEVIATE:
1. Generate EXACTLY 3 options (not 2, not 4, exactly 3) - NEVER fewer or more
2. Each option must have: title, description, pros array, cons array, sources array
3. Each source verse must have: canonical_id (string), paraphrase (string), relevance (number between 0.0 and 1.0)
4. relevance MUST be a number like 0.75, 0.92, etc. - NEVER text or descriptions
5. confidence MUST be a number between 0.0 and 1.0
6. Do NOT repeat options or collapse them into fewer than 3
7. Make each of the 3 options structurally distinct:
   - Option 1: Primary recommended action (what you advocate for)
   - Option 2: Conservative alternative (fewer risks, more cautious)
   - Option 3: Alternative perspective (different values or approach)

Always produce:
1. Executive summary - Your primary guidance (100-150 words, 2-3 short paragraphs):
   - **Opening**: 1-2 sentences framing the core tension
   - **Wisdom**: Connect 1-2 verses to their situation with key principle in **bold** (e.g., **nishkama karma**)
   - **Closing**: One grounding sentence
   - Be direct and concise—every sentence should add value
   - Use markdown: **bold** for emphasis, *italics* for verse quotes, verse references like BG_2_47
2. Exactly 3 distinct, clear options with genuine tradeoffs (all 3, never fewer)
3. One recommended action with implementation steps
4. Reflection prompts for the leader
5. Source verses with canonical IDs (use provided paraphrases exactly as given)

When referencing a verse:
- Use ONLY canonical ID format: BG_X_Y (e.g., BG_2_47, BG_18_63) — never "BG Verse 1", "Geeta 2:47", or other formats
- Use the provided paraphrase exactly as given - do not rephrase

IMPORTANT: ONLY cite verses provided in the "Relevant Bhagavad Geeta Verses" section below. Do NOT reference any other verses.

If confidence is below 0.7, flag for scholar review.

Do NOT give legal or medical advice; flag such cases.

Tone: warm but professional, insightful, grounded in wisdom. Write as a trusted advisor who deeply understands both ancient wisdom and modern leadership challenges.

Interpretive approach: Your guidance draws from practical Vedantic principles—emphasizing self-knowledge, ethical action (karma yoga), and finding meaning amid complexity. Present teachings in an accessible, non-sectarian way. Frame insights as "one thoughtful perspective" rather than definitive truth. For sensitive existential questions (death, suffering, karma), acknowledge that scholarly traditions offer varied interpretations.

QUALITY CHECKLIST (apply internally before responding):
1. **Alignment**: Does each option actually address their specific dilemma, not a generic version of it?
2. **Distinctiveness**: Are all 3 options genuinely different approaches—not variations of the same idea?
3. **Actionability**: Can they execute the recommended steps this week, not "eventually"?
4. **Verse Integration**: Do verses connect to the dilemma naturally, or feel forced/decorative?
5. **Directness**: Does the executive summary state clear guidance in the first 2 sentences?
6. **Pitfalls**: Have I warned them about what could go wrong with each path?

AVOID THESE PATTERNS:
- "It's important to consider..." → State directly what to do
- "This approach involves..." → Name the specific action
- "You might want to think about..." → Tell them what to think about
- Vague phrases like "in a sense", "to some extent" → Be specific
- Repeating the dilemma back to them → Move to guidance immediately
- Generic wisdom that applies to any situation → Tailor to their specific context

Output ONLY valid JSON matching this structure:
{
  "suggested_title": "Short, descriptive title for this consultation (5-8 words)",
  "executive_summary": "Opening that frames the dilemma and its significance.\n\nThe Geeta teaches us about **nishkama karma** (selfless action) through BG_2_47 - acting with dedication while releasing attachment to outcomes. This principle illuminates your situation by...\n\nAs you consider your path forward, remember that true wisdom lies in...",
  "options": [
    {
      "title": "Option 1 Title",
      "description": "Detailed description of this first approach",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"],
      "sources": ["BG_2_47", "BG_3_19"]
    },
    {
      "title": "Option 2 Title",
      "description": "Detailed description of this second approach",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2", "Con 3"],
      "sources": ["BG_2_31"]
    },
    {
      "title": "Option 3 Title",
      "description": "Detailed description of this third approach",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "sources": ["BG_18_48"]
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
    },
    {
      "canonical_id": "BG_3_19",
      "paraphrase": "Excellence comes through devoted action.",
      "relevance": 0.82
    }
  ],
  "confidence": 0.85,
  "scholar_flag": false
}

IMPORTANT - Source field structure:
- In "options": sources are an array of canonical_id strings only (e.g., ["BG_2_47", "BG_3_19"])
- In root "sources": each source is a full object with canonical_id, paraphrase, and relevance (0.0-1.0 number)
This two-part structure keeps options concise while maintaining full metadata. Options reference verses by ID, which you then describe fully in the root sources array."""


def build_user_prompt(
    case_data: dict[str, Any], retrieved_verses: list[dict[str, Any]]
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
    stakeholders = case_data.get("stakeholders", [])
    if stakeholders:
        prompt_parts.append(f"\n**Stakeholders:** {', '.join(stakeholders)}\n")

    # Add constraints
    constraints = case_data.get("constraints", [])
    if constraints:
        prompt_parts.append("\n**Constraints:**\n")
        for constraint in constraints:
            prompt_parts.append(f"- {constraint}\n")

    # Add retrieved verses
    prompt_parts.append("\n# Relevant Bhagavad Geeta Verses\n")
    prompt_parts.append("\nUse these verses to inform your consulting brief:\n\n")

    for i, verse in enumerate(retrieved_verses, 1):
        # Use helper functions to handle both verse structures
        canonical_id = get_verse_id(verse, "Unknown")
        paraphrase = get_verse_metadata(verse, "paraphrase", "N/A")
        translation = get_verse_metadata(verse, "translation_en", "")
        principles = get_verse_metadata(verse, "principles", "")
        # translations can be in verse directly or in metadata
        translations = verse.get("translations") or verse.get("metadata", {}).get(
            "translations", []
        )

        prompt_parts.append(f"**Verse {i}: {canonical_id}**\n")
        prompt_parts.append(f"Paraphrase: {paraphrase}\n")
        if translation:
            prompt_parts.append(f"Translation: {translation}\n")
        if translations:
            for t in translations[:2]:  # Include up to 2 additional translations
                translator = t.get("translator", "Unknown")
                text = t.get("text", "")
                if text:
                    prompt_parts.append(f"  - {translator}: {text}\n")
        if principles:
            prompt_parts.append(f"Principles: {principles}\n")
        prompt_parts.append("\n")

    # Add explicit constraint on allowed verse IDs
    valid_ids = [
        get_verse_id(verse)
        for verse in retrieved_verses
        if get_verse_id(verse) != "Unknown"
    ]
    if valid_ids:
        prompt_parts.append(
            f"**IMPORTANT**: ONLY cite these verse IDs in your response: {', '.join(valid_ids)}. "
            "Do NOT reference any other verses.\n\n"
        )

    # Add output format requirements
    prompt_parts.append("\n# Output Format Requirements\n")
    prompt_parts.append(
        "Return ONLY valid JSON. Do not include any explanatory text before or after the JSON. "
        "Do not wrap the JSON in markdown code blocks (```json...``). "
        "Output the JSON object directly, starting with { and ending with }.\n"
    )

    # Add task instruction
    prompt_parts.append("\n# Task\n")
    prompt_parts.append(
        f"Provide a consulting brief for a {case_data.get('role', 'leader')} "
        "following the required JSON output format. "
        f"Use up to {len(retrieved_verses)} Geeta verses; "
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
  "suggested_title": "Balancing Layoffs with Compassionate Leadership",
  "executive_summary": "This case involves a classic trade-off between short-term financial relief and long-term organizational health. The Geeta teaches duty-focused action (BG 2.47) and compassionate equilibrium (BG 12.15), suggesting a balanced approach that minimizes harm while meeting obligations.",
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
    "What support systems can I create for those affected?"
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
# Includes condensed quality guidance from pb-query style
OLLAMA_SYSTEM_PROMPT = """You are an ethical leadership consultant using Bhagavad Geeta wisdom.

QUALITY RULES (apply before responding):
- Be SPECIFIC to their situation, not generic advice
- Make options genuinely DIFFERENT, not variations
- Connect verses to their ACTUAL dilemma, not loosely
- Give CONCRETE steps they can do this week
- State guidance directly: "Do X" not "Consider X"

Output JSON:
- suggested_title: 5-8 word title
- executive_summary: 2-3 sentences with direct guidance
- options: array of 2 distinct options, each with title, description, pros[], cons[], sources[]
- recommended_action: {option: number, steps: [concrete actions], sources: []}
- reflection_prompts: 2 questions
- sources: [{canonical_id, paraphrase, relevance}]
- confidence: 0.0-1.0
- scholar_flag: boolean

Use verse IDs like BG_2_47. Output ONLY valid JSON."""


def build_ollama_prompt(
    case_data: dict[str, Any], retrieved_verses: list[dict[str, Any]]
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
    prompt_parts.append("\n# Geeta Verses\n")
    valid_ids = []
    for i, verse in enumerate(retrieved_verses[:3], 1):
        # Use helper functions to handle both verse structures
        canonical_id = get_verse_id(verse, "Unknown")
        paraphrase = get_verse_metadata(verse, "paraphrase", "N/A")
        translation = get_verse_metadata(verse, "translation_en", "")
        prompt_parts.append(f"{i}. {canonical_id}: {paraphrase}\n")
        if translation:
            prompt_parts.append(f"   Translation: {translation}\n")
        if canonical_id != "Unknown":
            valid_ids.append(canonical_id)

    # Add constraint on allowed verse IDs
    if valid_ids:
        prompt_parts.append(f"\nONLY cite: {', '.join(valid_ids)}\n")

    # Simplified task
    prompt_parts.append(
        "\n# Task\nProvide brief JSON consulting brief using Geeta principles.\n"
    )

    return "".join(prompt_parts)


def post_process_ollama_response(
    raw_response: str, retrieved_verses: list[dict[str, Any]]
) -> dict[str, Any]:
    """
    Post-process Ollama response to ensure it matches expected format.

    If Ollama output is incomplete or malformed, enrich it with defaults.

    Args:
        raw_response: Raw JSON string from Ollama
        retrieved_verses: Original retrieved verses

    Returns:
        Processed and enriched response dict
    """
    # Extract JSON from response using shared utility
    data = extract_json_from_markdown(raw_response)
    if data is None:
        data = {}

    # Normalize verse reference format: convert BG_X.Y to BG_X_Y
    def normalize_verse_id(verse_id: str) -> str:
        """Convert verse ID format from BG_X.Y to BG_X_Y."""
        if isinstance(verse_id, str) and verse_id.startswith("BG_"):
            # Replace dots with underscores in verse references
            return verse_id.replace(".", "_")
        return verse_id

    # Note: get_verse_id is now a module-level function

    # Fix sources array if it contains verse IDs as strings
    if data.get("sources") and isinstance(data["sources"], list):
        for source in data["sources"]:
            if isinstance(source, dict) and "canonical_id" in source:
                source["canonical_id"] = normalize_verse_id(source["canonical_id"])

    # Fix options sources arrays
    if data.get("options") and isinstance(data["options"], list):
        for option in data["options"]:
            if isinstance(option, dict) and "sources" in option:
                if isinstance(option["sources"], list):
                    option["sources"] = [
                        normalize_verse_id(src) if isinstance(src, str) else src
                        for src in option["sources"]
                    ]

    # Fix recommended_action sources
    if data.get("recommended_action") and isinstance(data["recommended_action"], dict):
        if "sources" in data["recommended_action"]:
            sources = data["recommended_action"]["sources"]
            if isinstance(sources, list):
                data["recommended_action"]["sources"] = [
                    normalize_verse_id(src) if isinstance(src, str) else src
                    for src in sources
                ]

    # Ensure all required fields exist
    if not data.get("executive_summary"):
        data["executive_summary"] = (
            "Ethical analysis based on Bhagavad Geeta principles."
        )

    # Ensure at least 2 options
    if not data.get("options") or len(data["options"]) < 2:
        data["options"] = [
            {
                "title": "Option 1",
                "description": "Approach based on duty and principles",
                "pros": ["Aligns with dharma", "Long-term oriented"],
                "cons": ["May be challenging"],
                "sources": (
                    [get_verse_id(retrieved_verses[0], "BG_2_47")]
                    if retrieved_verses
                    else ["BG_2_47"]
                ),
            },
            {
                "title": "Option 2",
                "description": "Alternative balanced approach",
                "pros": ["Pragmatic", "Considers stakeholders"],
                "cons": ["Requires careful execution"],
                "sources": (
                    [get_verse_id(retrieved_verses[1], "BG_3_19")]
                    if len(retrieved_verses) > 1
                    else ["BG_3_19"]
                ),
            },
        ]

    # Ensure recommended action exists
    if not data.get("recommended_action"):
        data["recommended_action"] = {
            "option": 1,
            "steps": [
                "Reflect on duties and principles",
                "Consider stakeholder impact",
                "Act with detachment from outcomes",
            ],
            "sources": (
                [get_verse_id(retrieved_verses[0], "BG_2_47")]
                if retrieved_verses
                else ["BG_2_47"]
            ),
        }

    # Ensure reflection prompts
    if not data.get("reflection_prompts"):
        data["reflection_prompts"] = [
            "What is my duty in this situation?",
            "How can I act with integrity?",
        ]

    # Ensure sources
    if not data.get("sources"):
        data["sources"] = [
            {
                "canonical_id": v["metadata"].get("canonical_id", "BG_Unknown"),
                "paraphrase": v["metadata"].get("paraphrase", "N/A"),
                "relevance": 0.7,
            }
            for v in retrieved_verses[:3]
        ]

    # Ensure confidence and scholar_flag
    data.setdefault("confidence", 0.6)  # Lower confidence for fallback
    data.setdefault("scholar_flag", True)  # Flag fallback responses for review

    return dict(data)


# ============================================================================
# Follow-up Conversation Prompts
# ============================================================================
# Used for conversational follow-ups after the initial consultation.
# These prompts enable lightweight responses without full RAG regeneration.

FOLLOW_UP_SYSTEM_PROMPT = """You are Geetanjali, continuing a consultation about an ethical leadership dilemma. The user has already received detailed guidance grounded in Bhagavad Geeta wisdom. Continue as the same trusted advisor.

Your role:
1. Answer their specific question directly in 1-2 short paragraphs (50-100 words)
2. Reference the prior analysis when relevant (e.g., "As noted in Option 2...")
3. ONLY cite verses listed under "Relevant Verses" below (format: BG_X_Y)—do not reference any other verses
4. Use **bold** for key concepts (e.g., **dharma**, **nishkama karma**)
5. Use *italics* for verse quotes
6. Be direct and concise—get to the point quickly

Tone: warm but professional, insightful, grounded in wisdom—matching the original guidance.

Interpretive approach: Continue with practical Vedantic principles. Frame insights as one perspective among many scholarly traditions.

What NOT to do:
- Don't regenerate the full 3-option brief
- Don't introduce entirely new options
- Don't provide legal, medical, or financial advice
- Don't end with questions back to the user
- Don't use markdown headers (#, ##)
- Don't use horizontal rules (---)

If they want a fresh analysis, respond:
"For a fresh analysis with different perspectives, please start a new consultation."

Write as a continuation of the same conversation—natural, focused, and grounded in the wisdom already shared."""


def build_follow_up_prompt(
    case_description: str,
    prior_output: dict[str, Any],
    conversation: list[dict[str, Any]],
    follow_up_question: str,
    max_conversation_messages: int = 8,
) -> str:
    """
    Build prompt for follow-up conversation.

    Args:
        case_description: Original dilemma description
        prior_output: The result_json from the most recent Output
        conversation: List of messages [{"role": "user"|"assistant", "content": "..."}]
        follow_up_question: The current follow-up question
        max_conversation_messages: Rolling window size (default 8 = last 4 exchanges)

    Returns:
        Formatted prompt string for conversational follow-up
    """
    parts = []

    # 1. Original dilemma context (brief)
    parts.append("# Original Dilemma\n")
    truncated_desc = case_description[:500]
    if len(case_description) > 500:
        logger.info(
            f"Follow-up prompt: truncating description from {len(case_description)} "
            f"to 500 chars (dropped {len(case_description) - 500} chars)"
        )
        truncated_desc += "..."
    parts.append(f"{truncated_desc}\n\n")

    # 2. Prior consultation summary
    parts.append("# Prior Consultation Summary\n")
    executive_summary = prior_output.get("executive_summary", "N/A")
    parts.append(f"**Executive Summary:** {executive_summary}\n\n")

    parts.append("**Options Provided:**\n")
    options = prior_output.get("options", [])
    for i, opt in enumerate(options, 1):
        title = opt.get("title", f"Option {i}")
        desc = opt.get("description", "")[:100]
        if len(opt.get("description", "")) > 100:
            desc += "..."
        parts.append(f"{i}. **{title}**: {desc}\n")

    rec = prior_output.get("recommended_action", {})
    if isinstance(rec, dict):
        rec_option = rec.get("option", 1)
        parts.append(f"\n**Recommended:** Option {rec_option}\n\n")

    # 3. Source verses available (from original consultation)
    sources = prior_output.get("sources", [])
    if sources:
        parts.append("**Relevant Verses:**\n")
        verse_ids = []
        for src in sources[:5]:  # Max 5 verses
            cid = src.get("canonical_id", "")
            para = src.get("paraphrase", "")
            parts.append(f"- {cid}: {para}\n")
            if cid:
                verse_ids.append(cid)
        if verse_ids:
            parts.append(
                f"\n**IMPORTANT**: ONLY cite these verses: {', '.join(verse_ids)}. Do NOT reference any other verses.\n\n"
            )
        else:
            parts.append("\n")

    # 4. Recent conversation history (rolling window)
    if conversation:
        parts.append("# Recent Conversation\n")
        # Take last N messages (rolling window)
        recent = conversation[-max_conversation_messages:]
        for msg in recent:
            role = "User" if msg.get("role") == "user" else "Geetanjali"
            content = msg.get("content", "")[:300]
            if len(msg.get("content", "")) > 300:
                content += "..."
            parts.append(f"**{role}:** {content}\n\n")

    # 5. Current question
    parts.append("# Current Question\n")
    parts.append(f"{follow_up_question}\n")

    return "".join(parts)


# ============================================================================
# Executive Summary Post-Processing
# ============================================================================
# Formats LLM output for better markdown rendering.
# Designed to be idempotent and non-destructive.


def format_executive_summary(text: str) -> str:
    """
    Post-process executive summary for better markdown formatting.

    This function is idempotent - running it multiple times produces the same result.
    It's also non-destructive - already well-formatted text passes through unchanged.

    Improvements:
    1. Section headers get proper paragraph breaks
    2. Verse references are normalized (BG_X_Y format preserved)
    3. Paragraphs are properly spaced

    Args:
        text: Raw executive summary from LLM

    Returns:
        Formatted executive summary with proper markdown structure
    """
    if not text or not isinstance(text, str):
        return text

    result = text

    # 1. Section Header Formatting
    # Ensure section headers start on new lines with proper spacing
    section_headers = [
        r"\*\*Wisdom from the Geeta\*\*",
        r"\*\*Practical [Ii]nsight\*\*:?",
        r"\*\*Closing\*\*:?",
        r"\*\*Application\*\*:?",
        r"\*\*Reflection\*\*:?",
    ]

    for header_pattern in section_headers:
        # Add paragraph break BEFORE header if not already there
        # Matches: non-newline char + optional space + header
        # Replaces with: char + double newline + header
        result = re.sub(rf"([^\n])[ \t]*({header_pattern})", r"\1\n\n\2", result)

        # Add paragraph break AFTER header if text follows on same line
        # Matches: header + optional colon + space + non-newline text
        # Replaces with: header + colon + double newline + text
        result = re.sub(rf"({header_pattern}:?)[ \t]+([^\n])", r"\1\n\n\2", result)

    # 2. Verse Reference Normalization
    # Convert BG_X.Y to BG_X_Y (some LLMs use dots)
    result = re.sub(r"\(BG_(\d+)\.(\d+)\)", r"(BG_\1_\2)", result)

    # 3. Paragraph Spacing
    # Normalize multiple newlines to exactly two (paragraph break)
    result = re.sub(r"\n{3,}", "\n\n", result)

    # 4. Clean up leading/trailing whitespace
    result = result.strip()

    # 5. Ensure no trailing spaces on lines
    result = re.sub(r" +\n", "\n", result)

    return result
