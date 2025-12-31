"""Mock LLM service for fast testing without external API calls."""

import hashlib
import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# Simulated delay range in seconds (min, max)
MOCK_DELAY_RANGE = (1.0, 2.5)


class MockLLMService:
    """
    Mock LLM service that returns pre-formatted responses with simulated delay.

    Useful for:
    - Development and testing
    - Avoiding API costs during development
    - Testing UI loading states and interactions
    """

    def __init__(self):
        """Initialize mock LLM service."""
        logger.info("Mock LLM Service initialized")

    def _simulate_delay(self, prompt: str) -> None:
        """Simulate LLM processing time based on prompt length."""
        # Base delay + variable based on prompt hash for consistency
        prompt_hash = int(
            hashlib.md5(prompt.encode(), usedforsecurity=False).hexdigest()[:8], 16
        )
        delay = MOCK_DELAY_RANGE[0] + (prompt_hash % 100) / 100 * (
            MOCK_DELAY_RANGE[1] - MOCK_DELAY_RANGE[0]
        )
        logger.info(f"Mock LLM simulating {delay:.1f}s delay")
        time.sleep(delay)

    def _is_follow_up_request(self, system_prompt: str | None) -> bool:
        """Detect if this is a follow-up conversation request."""
        if not system_prompt:
            return False
        return (
            "follow-up" in system_prompt.lower()
            or "continuing a consultation" in system_prompt.lower()
        )

    def _generate_follow_up_response(self, prompt: str) -> str:
        """Generate a markdown prose response for follow-up queries."""
        # Extract the question from the prompt (last section after "# Current Question")
        question = (
            prompt.split("# Current Question")[-1].strip()
            if "# Current Question" in prompt
            else prompt[-200:]
        )

        # Select response based on keywords in the question
        question_lower = question.lower()

        if any(
            word in question_lower
            for word in ["simplify", "simpler", "easier", "understand"]
        ):
            return """Let me break this down more simply.

**The core principle** is this: focus on doing what's right, not on what you'll get from it. The Geeta calls this **nishkama karma** - action without attachment to outcomes.

In practical terms:
- **Step 1**: Identify what you *should* do (your duty)
- **Step 2**: Do it with full effort and care
- **Step 3**: Release your grip on the results

This doesn't mean you don't care about outcomes - it means you don't let fear of failure or desire for success paralyze your action. As BG_2_47 reminds us: "You have the right to action, but not to the fruits of action."

Does this help clarify things?"""

        elif any(
            word in question_lower
            for word in ["option", "choose", "path", "which", "best"]
        ):
            return """That's a thoughtful question about choosing your path.

Based on the Geeta's wisdom, **the best path is the one aligned with your dharma** - your true nature and responsibilities. Here's how to discern it:

**Consider Option 1** (Nishkama Karma) if:
- You have clear responsibilities you've been avoiding
- You're paralyzed by worrying about outcomes
- You need to act but fear is holding you back

**Consider Option 2** (Jnana Yoga) if:
- The situation is genuinely unclear
- You're acting from impulse rather than wisdom
- You need deeper understanding before deciding

**Consider Option 3** (Equanimity) if:
- External circumstances are beyond your control
- You're emotionally reactive to the situation
- You need inner stability before taking action

Which aspects of your situation resonate most with these descriptions?"""

        elif any(
            word in question_lower
            for word in ["more", "detail", "explain", "elaborate"]
        ):
            return """Happy to elaborate further.

The Bhagavad Geeta presents a nuanced view of ethical action. At its heart is the recognition that **we suffer not from action itself, but from our attachment to outcomes**.

**Key insight from BG_2_48**: "Perform your duty with evenness of mind, abandoning attachment to success or failure. Such equanimity is called yoga."

This means:
1. **Engage fully** - Don't use detachment as an excuse for half-hearted effort
2. **Stay present** - Focus on the quality of your action, not future rewards
3. **Accept results gracefully** - Whether success or failure, learn and move forward

The practical application here is to ask yourself: "Am I doing this because it's right, or because I want a specific outcome?" If it's the latter, you may need to realign your motivation.

What specific aspect would you like me to explore further?"""

        else:
            # Default follow-up response
            return """Thank you for your follow-up question.

The Geeta's guidance here is both profound and practical. **The essence is balance** - between action and reflection, between effort and surrender, between personal desires and higher duty.

As you navigate this situation, consider these principles:

**From BG_3_19**: Act without attachment, focusing on the welfare of all involved, not just your personal gain.

**From BG_2_47**: You control your actions, but not their fruits. Do your best and release anxiety about outcomes.

**From BG_6_7**: The self-controlled person remains calm in both success and failure, heat and cold, honor and dishonor.

The path forward often becomes clearer when we step back from our immediate desires and ask: "What is my duty here? What would serve the highest good?"

Is there a specific aspect of this you'd like to explore further?"""

    def _generate_consultation_response(self, prompt: str) -> str:
        """Generate JSON response for initial consultation."""
        prompt_lower = prompt.lower()

        # Determine template based on keywords
        is_leadership = any(
            word in prompt_lower
            for word in ["lead", "manager", "team", "organization", "boss", "employee"]
        )

        # Build executive summary with markdown
        if is_leadership:
            executive_summary = """Your leadership challenge touches on fundamental questions of duty, influence, and responsibility.

The Geeta teaches that **true leadership emerges from selfless service** (seva), not from the pursuit of power or recognition. As BG_3_21 reminds us: "Whatever action a great person performs, common people follow."

This means your primary task is not to control outcomes, but to **embody the values you wish to see** in your team. Lead through example, maintain your composure under pressure, and make decisions rooted in dharma rather than expedience."""
        else:
            executive_summary = """Your situation involves navigating complex ethical terrain where competing values and responsibilities intersect.

The Bhagavad Geeta offers timeless guidance through the principle of **nishkama karma** - performing your duty with excellence while releasing attachment to specific outcomes. As BG_2_47 teaches: "You have the right to action, but not to the fruits of action."

Three paths emerge from this wisdom: **acting from duty** rather than desire, **seeking clarity** through reflection and counsel, and **maintaining equanimity** regardless of external circumstances. The choice between them depends on your specific situation and inner readiness."""

        response = {
            "suggested_title": "Navigating Ethical Complexity with Wisdom",
            "executive_summary": executive_summary,
            "options": [
                {
                    "title": "Option 1: Act According to Duty (Nishkama Karma)",
                    "description": "Fulfill your responsibilities without attachment to personal gain or specific outcomes. Focus on doing what is right rather than what is convenient.",
                    "pros": [
                        "Aligns with dharma and ethical principles",
                        "Reduces anxiety about outcomes beyond your control",
                        "Builds character and integrity over time",
                        "Creates positive momentum through right action",
                    ],
                    "cons": [
                        "May require short-term sacrifices",
                        "Results may not be immediately visible",
                        "Can be emotionally challenging initially",
                        "Others may not understand your approach",
                    ],
                    "sources": ["BG_2_47", "BG_3_19"],
                },
                {
                    "title": "Option 2: Seek Wisdom Through Reflection (Jnana Yoga)",
                    "description": "Take time to deeply understand the situation through contemplation and seeking counsel. Cultivate discernment between what is essential and what is transient.",
                    "pros": [
                        "Leads to clearer understanding",
                        "Reduces impulsive decisions",
                        "Develops lasting inner wisdom",
                        "Helps identify root causes",
                    ],
                    "cons": [
                        "Requires patience and dedicated time",
                        "May delay necessary action",
                        "Can be mistaken for indecision",
                        "Inner clarity takes practice",
                    ],
                    "sources": ["BG_4_38", "BG_2_69"],
                },
                {
                    "title": "Option 3: Practice Equanimity (Samatvam)",
                    "description": "Maintain balance and composure regardless of external circumstances. Accept the situation while working steadily toward improvement.",
                    "pros": [
                        "Preserves mental peace and clarity",
                        "Enables consistent action under pressure",
                        "Reduces suffering from attachment",
                        "Demonstrates strength of character",
                    ],
                    "cons": [
                        "May be perceived as indifference",
                        "Requires significant self-discipline",
                        "Can be difficult in crisis moments",
                        "May not address immediate needs",
                    ],
                    "sources": ["BG_2_48", "BG_6_7"],
                },
            ],
            "recommended_action": {
                "option": 1,
                "steps": [
                    "Clearly identify your core duties and responsibilities in this situation",
                    "Examine your motivations - are you acting from ego or from dharma?",
                    "Consult with trusted advisors for outside perspective",
                    "Take action based on what is right, not what is easy",
                    "Release attachment to specific outcomes while doing your best",
                    "Maintain equanimity and learn from whatever results arise",
                ],
                "sources": ["BG_2_47", "BG_3_19", "BG_18_46"],
            },
            "reflection_prompts": [
                "What are my true responsibilities here, beyond my personal desires?",
                "Am I more concerned with doing what is right, or with how others will perceive me?",
                "What would I advise a dear friend facing this same situation?",
                "How can I act with both compassion and clarity?",
                "What will I learn from this experience regardless of the outcome?",
            ],
            "sources": [
                {
                    "canonical_id": "BG_2_47",
                    "relevance": 0.95,
                    "paraphrase": "You have the right to perform your duty, but not to the fruits of your actions.",
                },
                {
                    "canonical_id": "BG_3_19",
                    "relevance": 0.92,
                    "paraphrase": "By performing action without attachment, one attains the Supreme.",
                },
                {
                    "canonical_id": "BG_2_48",
                    "relevance": 0.89,
                    "paraphrase": "Perform your duty with evenness of mind. Such equanimity is called yoga.",
                },
                {
                    "canonical_id": "BG_4_38",
                    "relevance": 0.85,
                    "paraphrase": "In this world, there is nothing as purifying as knowledge.",
                },
                {
                    "canonical_id": "BG_6_7",
                    "relevance": 0.82,
                    "paraphrase": "The self-controlled person remains calm in success and failure alike.",
                },
            ],
            "confidence": 0.87,
            "scholar_flag": False,
        }

        # Vary confidence slightly based on prompt
        prompt_hash = int(
            hashlib.md5(prompt.encode(), usedforsecurity=False).hexdigest()[:4], 16
        )
        response["confidence"] = 0.82 + (prompt_hash % 15) / 100

        return json.dumps(response)

    def check_health(self) -> bool:
        """Check if mock LLM is available (always true)."""
        return True

    def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        fallback_prompt: str | None = None,
        fallback_system: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate mock response with simulated delay.

        Args:
            prompt: User prompt (used for response selection)
            system_prompt: System prompt (used to detect follow-up vs consultation)
            temperature: Temperature (ignored in mock)
            max_tokens: Max tokens (ignored in mock)
            fallback_prompt: Fallback prompt (ignored in mock)
            fallback_system: Fallback system (ignored in mock)

        Returns:
            Mock generation result with response text and metadata
        """
        logger.info(f"Mock LLM generating response for {len(prompt)} char prompt")

        # Simulate processing delay
        self._simulate_delay(prompt)

        # Determine response type based on system prompt
        is_follow_up = self._is_follow_up_request(system_prompt)

        if is_follow_up:
            response_text = self._generate_follow_up_response(prompt)
            logger.info(
                f"Mock LLM generated follow-up response ({len(response_text)} chars)"
            )
        else:
            response_text = self._generate_consultation_response(prompt)
            logger.info(
                f"Mock LLM generated consultation response ({len(response_text)} chars)"
            )

        return {
            "response": response_text,
            "model": "mock-llm-v1",
            "provider": "mock",
            "input_tokens": len(prompt.split()),
            "output_tokens": len(response_text.split()),
        }

    def generate_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.3,
        fallback_prompt: str | None = None,
        fallback_system: str | None = None,
    ) -> str:
        """
        Generate mock JSON response.

        Args:
            prompt: User prompt requesting JSON output
            system_prompt: System prompt (ignored in mock)
            temperature: Temperature (ignored in mock)
            fallback_prompt: Fallback prompt (ignored in mock)
            fallback_system: Fallback system (ignored in mock)

        Returns:
            JSON string response
        """
        result = self.generate(
            prompt=prompt, system_prompt=system_prompt, temperature=temperature
        )

        return str(result["response"])
