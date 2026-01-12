"""Fallback reconstruction logic for multi-pass consultation pipeline.

When Pass 4 (Structure) fails to generate valid JSON, this module attempts
to extract structured data heuristically from Pass 3 (Refine) prose.

See: todos/ollama-consultations-refined.md for full specification.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ReconstructionResult:
    """Result of fallback reconstruction attempt."""

    success: bool
    result_json: dict[str, Any] | None = None
    confidence: float = 0.4
    reconstruction_method: str | None = None
    errors: list[str] = field(default_factory=list)


def reconstruct_from_prose(
    refined_prose: str | None,
    draft_prose: str | None,
    verses: list[dict],
    case_title: str = "",
    case_description: str = "",
) -> ReconstructionResult:
    """Attempt to reconstruct JSON structure from prose.

    Tries multiple methods in order of quality:
    1. Parse refined prose with heuristics
    2. Parse draft prose (less refined) if refined unavailable
    3. Return generic fallback as last resort

    Args:
        refined_prose: Output from Pass 3 (Refine)
        draft_prose: Output from Pass 1 (Draft) - fallback if refine unavailable
        verses: Retrieved verses with metadata
        case_title: Original case title
        case_description: Original case description

    Returns:
        ReconstructionResult with reconstructed JSON or error details
    """
    errors = []

    # Try refined prose first (best quality)
    if refined_prose and len(refined_prose.strip()) > 100:
        result = _heuristic_prose_to_json(refined_prose, verses, case_title)
        if _is_valid_structure(result):
            logger.info("Fallback reconstruction succeeded from refined prose")
            return ReconstructionResult(
                success=True,
                result_json=result,
                confidence=_calculate_reconstruction_confidence(refined_prose),
                reconstruction_method="refined_prose_heuristic",
            )
        errors.append("Refined prose heuristic extraction failed validation")

    # Try draft prose as fallback
    if draft_prose and len(draft_prose.strip()) > 100:
        result = _heuristic_prose_to_json(draft_prose, verses, case_title)
        if _is_valid_structure(result):
            logger.info("Fallback reconstruction succeeded from draft prose")
            return ReconstructionResult(
                success=True,
                result_json=result,
                confidence=_calculate_reconstruction_confidence(draft_prose) * 0.8,
                reconstruction_method="draft_prose_heuristic",
            )
        errors.append("Draft prose heuristic extraction failed validation")

    # Last resort: generic fallback
    logger.warning("Heuristic reconstruction failed, using generic fallback")
    return ReconstructionResult(
        success=False,
        result_json=None,
        confidence=0.3,
        reconstruction_method="none",
        errors=errors or ["No usable prose available for reconstruction"],
    )


def _heuristic_prose_to_json(
    prose: str,
    verses: list[dict],
    case_title: str = "",
) -> dict[str, Any]:
    """Extract JSON-like structure from prose without LLM.

    Heuristics:
    - First sentence or heading as title
    - Paragraphs as executive summary
    - Numbered/bulleted lists become options
    - Lines with "Pro:" become pros, "Con:" become cons
    - BG_X_Y patterns become verse references

    Args:
        prose: The prose text to parse
        verses: Retrieved verses for source attribution
        case_title: Fallback title if extraction fails

    Returns:
        Reconstructed JSON structure
    """
    # Extract title
    title = _extract_title(prose, case_title)

    # Extract executive summary (first paragraph or two)
    summary = _extract_summary(prose)

    # Extract options from prose structure
    options = _extract_options(prose, verses)

    # Extract verse references from prose
    verse_refs = _extract_verse_references(prose)

    # Build sources from verses and extracted refs
    sources = _build_sources(verses, verse_refs)

    # Extract reflection prompts (questions in the prose)
    prompts = _extract_reflection_prompts(prose)

    # Build recommended action
    recommended = _build_recommended_action(options, sources)

    return {
        "suggested_title": title,
        "executive_summary": summary,
        "options": options,
        "recommended_action": recommended,
        "reflection_prompts": prompts,
        "sources": sources,
        "confidence": _calculate_reconstruction_confidence(prose),
        "scholar_flag": True,  # Always flag reconstructed outputs
    }


def _extract_title(prose: str, fallback: str = "") -> str:
    """Extract title from prose.

    Looks for:
    - Markdown headers (# Title)
    - Bold text at start (**Title**)
    - First sentence if short enough
    """
    lines = prose.strip().split("\n")

    for line in lines[:5]:  # Check first 5 lines
        line = line.strip()
        if not line:
            continue

        # Check for markdown header
        if line.startswith("#"):
            title = line.lstrip("#").strip()
            if 5 <= len(title) <= 80:
                return title

        # Check for bold text
        bold_match = re.match(r"\*\*(.+?)\*\*", line)
        if bold_match:
            title = bold_match.group(1).strip()
            if 5 <= len(title) <= 80:
                return title

    # Use first sentence if short
    first_sentence = prose.split(".")[0].strip()
    if 10 <= len(first_sentence) <= 80:
        return first_sentence

    # Fallback
    return fallback or "Ethical Guidance"


def _extract_summary(prose: str) -> str:
    """Extract executive summary from prose.

    Takes first 1-2 paragraphs, up to 200 words.
    """
    paragraphs = re.split(r"\n\s*\n", prose.strip())

    summary_parts = []
    word_count = 0

    for para in paragraphs[:3]:  # Max 3 paragraphs
        para = para.strip()
        if not para:
            continue

        # Skip if it looks like a header or list
        if para.startswith("#") or re.match(r"^[\d\-\*•]", para):
            continue

        words = para.split()
        if word_count + len(words) > 200:
            # Truncate to fit
            remaining = 200 - word_count
            summary_parts.append(" ".join(words[:remaining]) + "...")
            break

        summary_parts.append(para)
        word_count += len(words)

    if not summary_parts:
        return "This situation involves complex ethical considerations that require careful reflection."

    return " ".join(summary_parts)


def _extract_options(prose: str, verses: list[dict]) -> list[dict]:
    """Extract options/paths from prose.

    Looks for:
    - Numbered lists (1. Option A, 2. Option B)
    - Path/Option headers
    - Bulleted lists with descriptions
    """
    options = []

    # Pattern for numbered options with titles
    # e.g., "1. **Path of Duty**: Description..."
    numbered_pattern = re.compile(
        r"(?:^|\n)\s*(\d+)[.\)]\s*\**([^:\n*]+?)\**:?\s*(.+?)(?=\n\s*\d+[.\)]|\n\n|\Z)",
        re.DOTALL,
    )

    matches = numbered_pattern.findall(prose)

    for i, match in enumerate(matches[:3]):  # Max 3 options
        _, title, description = match
        title = title.strip()
        description = description.strip()

        # Clean up description
        description = re.sub(r"\s+", " ", description)
        if len(description) > 300:
            description = description[:297] + "..."

        # Extract pros/cons from description
        pros, cons = _extract_pros_cons(description)

        # Assign verse sources
        verse_sources = _get_option_sources(i, verses)

        options.append({
            "title": title or f"Option {i + 1}",
            "description": description,
            "pros": pros or ["Aligns with ethical principles"],
            "cons": cons or ["Requires careful consideration"],
            "sources": verse_sources,
        })

    # If no structured options found, create generic ones
    if len(options) < 3:
        options = _create_generic_options(prose, verses)

    return options


def _extract_pros_cons(text: str) -> tuple[list[str], list[str]]:
    """Extract pros and cons from text.

    Looks for patterns like:
    - Pro: X, Con: Y
    - Benefits: X, Risks: Y
    - Advantages/Disadvantages
    """
    pros = []
    cons = []

    # Pattern for explicit pro/con markers
    pro_patterns = [
        r"(?:pro|benefit|advantage|strength)[s]?:?\s*([^.;]+)",
        r"(?:positive|upside)[s]?:?\s*([^.;]+)",
    ]

    con_patterns = [
        r"(?:con|risk|disadvantage|weakness)[s]?:?\s*([^.;]+)",
        r"(?:negative|downside|challenge)[s]?:?\s*([^.;]+)",
    ]

    text_lower = text.lower()

    for pattern in pro_patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        for match in matches[:3]:
            pros.append(match.strip().capitalize())

    for pattern in con_patterns:
        matches = re.findall(pattern, text_lower, re.IGNORECASE)
        for match in matches[:2]:
            cons.append(match.strip().capitalize())

    return pros[:3], cons[:2]


def _get_option_sources(option_index: int, verses: list[dict]) -> list[str]:
    """Get verse sources for an option based on index."""
    if not verses:
        return ["BG_2_47"]  # Default verse

    # Distribute verses across options
    verses_per_option = max(1, len(verses) // 3)
    start_idx = option_index * verses_per_option
    end_idx = start_idx + verses_per_option

    sources = []
    for verse in verses[start_idx:end_idx]:
        canonical_id = verse.get("canonical_id", f"BG_{option_index + 2}_47")
        sources.append(canonical_id)

    return sources or ["BG_2_47"]


def _create_generic_options(prose: str, verses: list[dict]) -> list[dict]:
    """Create generic options when structured extraction fails."""
    # Look for any mention of different paths/approaches
    has_duty = any(word in prose.lower() for word in ["duty", "dharma", "obligation"])
    has_compassion = any(word in prose.lower() for word in ["compassion", "kindness", "empathy"])
    has_wisdom = any(word in prose.lower() for word in ["wisdom", "discernment", "understanding"])

    options = [
        {
            "title": "Path of Dharma (Duty)" if has_duty else "Consider Your Responsibilities",
            "description": "Focus on your duties and responsibilities in this situation. What does your role demand of you?",
            "pros": ["Honors commitments", "Provides clear direction"],
            "cons": ["May conflict with personal desires"],
            "sources": _get_option_sources(0, verses),
        },
        {
            "title": "Path of Compassion" if has_compassion else "Consider Stakeholder Impact",
            "description": "Consider the impact on all stakeholders. How can you act with kindness while maintaining integrity?",
            "pros": ["Builds relationships", "Reduces harm"],
            "cons": ["May delay difficult decisions"],
            "sources": _get_option_sources(1, verses),
        },
        {
            "title": "Path of Wisdom" if has_wisdom else "Seek Balanced Action",
            "description": "Seek a balanced approach that honors both your duties and the welfare of others.",
            "pros": ["Integrates multiple perspectives", "Sustainable outcome"],
            "cons": ["Requires patience and discernment"],
            "sources": _get_option_sources(2, verses),
        },
    ]

    return options


def _extract_verse_references(prose: str) -> list[str]:
    """Extract BG_X_Y verse references from prose."""
    # Pattern for BG references: BG_2_47, BG 2.47, etc.
    pattern = r"BG[_\s]?(\d+)[_.\s](\d+)"
    matches = re.findall(pattern, prose, re.IGNORECASE)

    refs = []
    for chapter, verse in matches:
        refs.append(f"BG_{chapter}_{verse}")

    return list(set(refs))  # Deduplicate


def _build_sources(verses: list[dict], extracted_refs: list[str]) -> list[dict]:
    """Build sources array from verses and extracted references."""
    sources = []
    seen_ids = set()

    # First, add extracted references
    for ref in extracted_refs[:5]:  # Max 5
        if ref not in seen_ids:
            # Try to find in verses
            verse_data = next(
                (v for v in verses if v.get("canonical_id") == ref),
                None,
            )
            if verse_data:
                paraphrase = (
                    verse_data.get("metadata", {}).get("translation_en") or
                    verse_data.get("metadata", {}).get("paraphrase_en") or
                    f"Wisdom from {ref}"
                )
            else:
                paraphrase = f"Reference to {ref}"

            sources.append({
                "canonical_id": ref,
                "paraphrase": paraphrase[:200],
                "relevance": 0.5,  # Lower relevance for reconstructed
            })
            seen_ids.add(ref)

    # Then add remaining verses
    for verse in verses:
        canonical_id = verse.get("canonical_id", "BG_2_47")
        if canonical_id not in seen_ids and len(sources) < 5:
            metadata = verse.get("metadata", {})
            paraphrase = (
                metadata.get("translation_en") or
                metadata.get("paraphrase_en") or
                "Wisdom from the Bhagavad Geeta"
            )
            sources.append({
                "canonical_id": canonical_id,
                "paraphrase": paraphrase[:200],
                "relevance": 0.4,
            })
            seen_ids.add(canonical_id)

    # Ensure at least one source
    if not sources:
        sources.append({
            "canonical_id": "BG_2_47",
            "paraphrase": "Focus on your duty without attachment to results",
            "relevance": 0.3,
        })

    return sources


def _extract_reflection_prompts(prose: str) -> list[str]:
    """Extract reflection prompts (questions) from prose."""
    # Find questions in the prose
    question_pattern = r"([^.?!]*\?)"
    questions = re.findall(question_pattern, prose)

    prompts = []
    for q in questions:
        q = q.strip()
        # Skip short or meta questions
        if len(q) > 20 and not any(
            skip in q.lower()
            for skip in ["what if", "wouldn't it", "isn't it"]
        ):
            prompts.append(q)
            if len(prompts) >= 3:
                break

    # Add default prompts if none found
    if len(prompts) < 2:
        default_prompts = [
            "What values are most important to you in this situation?",
            "How will this decision affect those you care about?",
            "What would your wisest self advise you to do?",
        ]
        prompts.extend(default_prompts[: 2 - len(prompts)])

    return prompts[:3]


def _build_recommended_action(
    options: list[dict],
    sources: list[dict],
) -> dict:
    """Build recommended action from options."""
    # Default to first option (usually most conventional)
    option_idx = 1

    # Find steps from first option's description or create generic
    first_option = options[0] if options else {}
    description = first_option.get("description", "")

    # Try to extract steps from description
    steps = []
    step_patterns = [
        r"(?:first|1\.?)\s*,?\s*([^.]+)",
        r"(?:then|next|2\.?)\s*,?\s*([^.]+)",
        r"(?:finally|lastly|3\.?)\s*,?\s*([^.]+)",
    ]

    for pattern in step_patterns:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            step = match.group(1).strip().capitalize()
            if len(step) > 10:
                steps.append(step[:100])

    # Default steps if extraction failed
    if len(steps) < 3:
        steps = [
            "Reflect on your core values and dharma",
            "Consider the impact on all stakeholders",
            "Act with integrity and detachment from outcomes",
        ]

    return {
        "option": option_idx,
        "steps": steps[:3],
        "sources": [s["canonical_id"] for s in sources[:2]],
    }


def _calculate_reconstruction_confidence(prose: str) -> float:
    """Calculate confidence score based on reconstruction indicators.

    Base score is low (0.3) since this is reconstructed.
    Adds points for:
    - Longer prose (more content to extract)
    - More structure (paragraphs, lists)
    - Presence of verse references
    - Reasoning indicators
    """
    score = 0.3  # Base: reconstructed, so low

    # Length indicator
    if len(prose) > 500:
        score += 0.15
    elif len(prose) > 300:
        score += 0.1

    # Structure indicator
    paragraph_count = len(re.split(r"\n\s*\n", prose))
    if paragraph_count > 3:
        score += 0.1
    elif paragraph_count > 1:
        score += 0.05

    # Verse reference indicator
    verse_refs = len(re.findall(r"BG[_\s]?\d+[_.\s]\d+", prose, re.IGNORECASE))
    if verse_refs > 2:
        score += 0.1
    elif verse_refs > 0:
        score += 0.05

    # Reasoning indicator
    reasoning_words = ["therefore", "however", "consider", "because", "thus"]
    reasoning_count = sum(1 for word in reasoning_words if word in prose.lower())
    if reasoning_count > 2:
        score += 0.1
    elif reasoning_count > 0:
        score += 0.05

    # Cap at 0.65 (reconstructed can't be high confidence)
    return min(score, 0.65)


def _is_valid_structure(result: dict) -> bool:
    """Validate reconstructed JSON has required fields.

    Less strict than Pass 4 validation since this is fallback.
    """
    required_fields = [
        "suggested_title",
        "executive_summary",
        "options",
        "recommended_action",
    ]

    for field_name in required_fields:
        if field_name not in result:
            return False

    # Must have at least 3 options
    options = result.get("options", [])
    if not isinstance(options, list) or len(options) < 3:
        return False

    # Each option must have title and description
    for opt in options:
        if not isinstance(opt, dict):
            return False
        if not opt.get("title") or not opt.get("description"):
            return False

    return True
