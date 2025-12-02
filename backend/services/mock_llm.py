"""Mock LLM service for fast testing without external API calls."""

import logging
import json
import hashlib
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class MockLLMService:
    """
    Mock LLM service that returns pre-formatted responses instantly.

    Useful for:
    - Development and testing
    - Avoiding API costs during development
    - Fast iteration without network delays
    """

    def __init__(self):
        """Initialize mock LLM service."""
        self.response_templates = self._load_response_templates()
        logger.info("Mock LLM Service initialized")

    def _load_response_templates(self) -> Dict[str, str]:
        """Load response templates for different types of cases."""
        return {
            "default": json.dumps({
                "executive_summary": "Your situation involves navigating complex ethical considerations. The Bhagavad Geeta offers timeless wisdom on righteous action (dharma), detachment from outcomes, and maintaining equanimity in difficult circumstances. Three key perspectives emerge from the verses: performing your duty without attachment to results, acting with compassion while maintaining clarity, and seeking wisdom through self-reflection.",
                "options": [
                    {
                        "title": "Option 1: Act According to Duty (Nishkama Karma)",
                        "description": "Fulfill your responsibilities and obligations without attachment to personal gain or specific outcomes. Focus on doing what is right rather than what is convenient or immediately rewarding.",
                        "pros": [
                            "Aligns with dharma and ethical principles",
                            "Reduces anxiety about outcomes beyond your control",
                            "Builds character and integrity",
                            "Creates long-term positive karma"
                        ],
                        "cons": [
                            "May require short-term sacrifices",
                            "Results may not be immediately visible",
                            "Can be emotionally challenging",
                            "Others may not understand your approach"
                        ],
                        "sources": ["BG 2.47", "BG 3.19"]
                    },
                    {
                        "title": "Option 2: Seek Wisdom Through Reflection (Jnana Yoga)",
                        "description": "Take time to deeply understand the situation through meditation, contemplation, and seeking counsel from wise individuals. Cultivate discernment between what is essential and what is transient.",
                        "pros": [
                            "Leads to clearer understanding",
                            "Reduces impulsive decisions",
                            "Develops inner wisdom and clarity",
                            "Helps identify root causes rather than symptoms"
                        ],
                        "cons": [
                            "Requires patience and time",
                            "May delay necessary action",
                            "Can be mistaken for indecision",
                            "Inner clarity takes practice to develop"
                        ],
                        "sources": ["BG 4.38", "BG 2.69"]
                    },
                    {
                        "title": "Option 3: Practice Equanimity (Samatvam)",
                        "description": "Maintain balance and composure regardless of external circumstances. Accept the situation as it is while working steadily toward improvement, without being disturbed by obstacles or elated by success.",
                        "pros": [
                            "Preserves mental peace and clarity",
                            "Enables consistent action under pressure",
                            "Reduces suffering from attachment",
                            "Demonstrates strength of character"
                        ],
                        "cons": [
                            "May be perceived as indifference",
                            "Requires significant self-discipline",
                            "Can be difficult to maintain in crisis",
                            "May not address immediate practical needs"
                        ],
                        "sources": ["BG 2.48", "BG 6.7"]
                    }
                ],
                "recommended_action": {
                    "option": 1,
                    "steps": [
                        "Clearly identify your core duties and responsibilities in this situation",
                        "Examine your motivations - are you acting from ego or from dharma?",
                        "Consult with trusted advisors or mentors for perspective",
                        "Take action based on what is right, not what is easy",
                        "Release attachment to specific outcomes while doing your best",
                        "Maintain equanimity and learn from the results"
                    ],
                    "sources": ["BG 2.47", "BG 3.19", "BG 18.46"]
                },
                "reflection_prompts": [
                    "What are my true responsibilities in this situation, beyond my personal desires?",
                    "Am I more concerned with doing what is right, or with what others will think?",
                    "What would I advise a dear friend facing this same situation?",
                    "How can I act with both compassion and clarity?",
                    "What will I learn from this experience regardless of the outcome?"
                ],
                "sources": [
                    {"canonical_id": "BG 2.47", "relevance": 0.95, "paraphrase": "You have the right to perform your duty, but not to the fruits of your actions. Never consider yourself the cause of results, nor be attached to inaction."},
                    {"canonical_id": "BG 3.19", "relevance": 0.92, "paraphrase": "Therefore, without attachment, always perform action which should be done, for by performing action without attachment, one attains the Supreme."},
                    {"canonical_id": "BG 2.48", "relevance": 0.89, "paraphrase": "Perform your duty with an evenness of mind, abandoning attachment to success or failure. Such equanimity is called yoga."},
                    {"canonical_id": "BG 4.38", "relevance": 0.85, "paraphrase": "In this world, there is nothing as purifying as knowledge. One who is perfected in yoga finds this knowledge within the self in due course of time."},
                    {"canonical_id": "BG 18.46", "relevance": 0.82, "paraphrase": "By performing one's natural occupation, one can worship the Lord who is the source of all beings and by whom all this universe is pervaded, thus attaining perfection."}
                ],
                "confidence": 0.85,
                "scholar_flag": False
            }),
            "leadership": json.dumps({
                "executive_summary": "Your leadership challenge requires balancing competing interests while upholding dharma. The Geeta emphasizes that true leadership comes from selfless service (seva), maintaining composure under pressure, and making decisions based on duty rather than personal gain. Leaders must act with both strength and compassion.",
                "options": [
                    {
                        "title": "Option 1: Lead by Example (Lokasangraha)",
                        "description": "Demonstrate the values and behaviors you expect from others. Lead through personal integrity and consistent action rather than just directives.",
                        "pros": [
                            "Builds genuine respect and trust",
                            "Creates lasting cultural change",
                            "Demonstrates authenticity",
                            "Inspires others naturally"
                        ],
                        "cons": [
                            "Requires personal sacrifice",
                            "Change may be gradual",
                            "Higher scrutiny on your actions",
                            "May be tested by others"
                        ],
                        "sources": ["BG 3.21", "BG 3.25"]
                    },
                    {
                        "title": "Option 2: Make the Difficult Decision",
                        "description": "Take decisive action based on dharma, even if it's unpopular. Sometimes leadership requires making hard choices for the greater good.",
                        "pros": [
                            "Demonstrates courage and conviction",
                            "Addresses problems directly",
                            "Sets clear standards",
                            "Prevents issues from festering"
                        ],
                        "cons": [
                            "May face resistance or criticism",
                            "Requires standing alone at times",
                            "Short-term unpopularity",
                            "Demands certainty in judgment"
                        ],
                        "sources": ["BG 2.37", "BG 2.47"]
                    },
                    {
                        "title": "Option 3: Seek Stakeholder Alignment",
                        "description": "Engage key stakeholders to build shared understanding and consensus on the path forward.",
                        "pros": [
                            "Increases buy-in and support",
                            "Surfaces diverse perspectives",
                            "Reduces resistance to change",
                            "Distributes responsibility"
                        ],
                        "cons": [
                            "Time-consuming process",
                            "May dilute decisive action",
                            "Not all views may align",
                            "Can delay necessary action"
                        ],
                        "sources": ["BG 5.25", "BG 12.13"]
                    }
                ],
                "recommended_action": {
                    "option": 1,
                    "steps": [
                        "Clarify the values and standards you want to establish",
                        "Assess where your actions may not align with these standards",
                        "Make visible changes in your own behavior first",
                        "Communicate clearly about expectations",
                        "Hold yourself to the highest standard",
                        "Support others in making similar changes"
                    ],
                    "sources": ["BG 3.21", "BG 3.25", "BG 5.25"]
                },
                "reflection_prompts": [
                    "Am I asking others to do what I'm not willing to do myself?",
                    "What legacy do I want to leave through my leadership?",
                    "Am I leading from ego or from service?",
                    "How can I balance firmness with compassion?",
                    "What would a leader I deeply respect do in this situation?"
                ],
                "sources": [
                    {"canonical_id": "BG 3.21", "relevance": 0.94, "paraphrase": "Whatever action a great person performs, common people follow. Whatever standards they set, the world pursues."},
                    {"canonical_id": "BG 3.25", "relevance": 0.91, "paraphrase": "As the ignorant act with attachment to their work, the wise should act without attachment, desiring the welfare of the world."},
                    {"canonical_id": "BG 2.47", "relevance": 0.88, "paraphrase": "You have the right to perform your duty, but not to the fruits of your actions. Never consider yourself the cause of results, nor be attached to inaction."},
                    {"canonical_id": "BG 5.25", "relevance": 0.85, "paraphrase": "Those who are free from anger and material desires, who have controlled their minds and realized the Self, attain the supreme liberation both here and hereafter."},
                    {"canonical_id": "BG 12.13", "relevance": 0.82, "paraphrase": "One who is not envious but a kind friend to all, free from possessiveness and false ego, equal in happiness and distress, and always forgiving."}
                ],
                "confidence": 0.87,
                "scholar_flag": False
            })
        }

    def _select_template(self, prompt: str) -> str:
        """Select appropriate template based on prompt content."""
        prompt_lower = prompt.lower()

        # Simple keyword matching for template selection
        if any(word in prompt_lower for word in ['lead', 'manager', 'team', 'organization', 'boss']):
            return "leadership"

        return "default"

    def _customize_response(self, template: str, prompt: str) -> str:
        """Customize the template response based on the specific prompt."""
        response = json.loads(template)

        # Add slight variations to make responses feel less canned
        # This helps with testing different scenarios
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()[:4]

        # Vary confidence slightly based on prompt hash
        base_confidence = response.get("confidence", 0.85)
        confidence_adjustment = int(prompt_hash, 16) % 10 / 100  # 0.00 to 0.09
        response["confidence"] = min(0.95, base_confidence + confidence_adjustment)

        return json.dumps(response)

    def check_health(self) -> bool:
        """Check if mock LLM is available (always true)."""
        return True

    def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        fallback_prompt: Optional[str] = None,
        fallback_system: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate mock response instantly.

        Args:
            prompt: User prompt (used for template selection)
            system_prompt: System prompt (ignored in mock)
            temperature: Temperature (ignored in mock)
            max_tokens: Max tokens (ignored in mock)
            fallback_prompt: Fallback prompt (ignored in mock)
            fallback_system: Fallback system (ignored in mock)

        Returns:
            Mock generation result with response text and metadata
        """
        logger.info(f"Mock LLM generating response for {len(prompt)} char prompt")

        # Select and customize template
        template_key = self._select_template(prompt)
        template = self.response_templates[template_key]
        response_text = self._customize_response(template, prompt)

        logger.info(f"Mock LLM response ready (template: {template_key})")

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
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        fallback_prompt: Optional[str] = None,
        fallback_system: Optional[str] = None
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
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature
        )

        return result["response"]
