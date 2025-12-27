/**
 * Featured cases logic for homepage.
 *
 * Caching strategy: Browser HTTP cache (24h) + Redis (24h)
 * Fallback: Hardcoded examples when API is unavailable
 */

import type { FeaturedCase, FeaturedCasesResponse } from "../types";
import { casesApi } from "./api";

/**
 * Hardcoded fallback examples when API is unavailable.
 * No slug = no "View Full" link, no "From community" badge.
 */
const FALLBACK_EXAMPLES: FeaturedCase[] = [
  {
    slug: null,
    category: "career",
    dilemma_preview:
      "My boss asked me to falsify a report. I need this job, but this feels wrong...",
    guidance_summary: "",
    recommended_steps: [
      "Document the request in writing and clarify what's being asked",
      "Consult with a trusted mentor or legal advisor",
      "Decide based on dharma, not fear of consequences",
    ],
    verse_references: [
      { canonical_id: "BG_2_47", display: "BG 2.47" },
      { canonical_id: "BG_18_63", display: "BG 18.63" },
    ],
    has_followups: false,
  },
  {
    slug: null,
    category: "relationships",
    dilemma_preview:
      "My closest friend borrowed money and keeps avoiding the topic...",
    guidance_summary: "",
    recommended_steps: [
      "Choose a calm moment for a direct but compassionate conversation",
      "Focus on the relationship, not just the money",
      "Accept that you can only control your own actions",
    ],
    verse_references: [
      { canonical_id: "BG_2_47", display: "BG 2.47" },
      { canonical_id: "BG_6_9", display: "BG 6.9" },
    ],
    has_followups: false,
  },
  {
    slug: null,
    category: "ethics",
    dilemma_preview:
      "I discovered financial irregularities at my company. Should I escalate?",
    guidance_summary: "",
    recommended_steps: [
      "Document thoroughly with dates and evidence",
      "Seek counsel from trusted mentors before acting",
      "Act from clarity and duty, not anger",
    ],
    verse_references: [
      { canonical_id: "BG_18_63", display: "BG 18.63" },
      { canonical_id: "BG_3_19", display: "BG 3.19" },
    ],
    has_followups: false,
  },
  {
    slug: null,
    category: "leadership",
    dilemma_preview:
      "I must recommend one of two qualified team members for promotion...",
    guidance_summary: "",
    recommended_steps: [
      "Evaluate based on merit and organizational need",
      "Don't let threats or tenure alone influence the decision",
      "Communicate transparently with both candidates",
    ],
    verse_references: [
      { canonical_id: "BG_2_48", display: "BG 2.48" },
      { canonical_id: "BG_3_21", display: "BG 3.21" },
    ],
    has_followups: false,
  },
];

/**
 * Get featured cases from API with fallback.
 *
 * Caching is handled by:
 * - Browser: HTTP Cache-Control header (24h max-age)
 * - Server: Redis cache (24h TTL)
 *
 * If API fails, returns hardcoded fallback examples.
 */
export async function getFeaturedCases(): Promise<FeaturedCasesResponse> {
  try {
    return await casesApi.getFeatured();
  } catch {
    // API failed - return fallback examples
    return {
      cases: FALLBACK_EXAMPLES,
      categories: ["career", "relationships", "ethics", "leadership"],
      cached_at: new Date().toISOString(),
    };
  }
}

/**
 * Get a random case for a specific category.
 *
 * If multiple cases exist for the category, pick one randomly.
 * Falls back to first case for category if only one exists.
 */
export function getRandomCaseForCategory(
  cases: FeaturedCase[],
  category: string,
): FeaturedCase | undefined {
  const categoryCases = cases.filter((c) => c.category === category);
  if (categoryCases.length === 0) return undefined;
  if (categoryCases.length === 1) return categoryCases[0];

  const randomIndex = Math.floor(Math.random() * categoryCases.length);
  return categoryCases[randomIndex];
}

/**
 * Check if a case is from API (has slug) vs fallback
 */
export function isApiCase(featuredCase: FeaturedCase): boolean {
  return featuredCase.slug !== null;
}
