/**
 * Consulting Principles Taxonomy
 *
 * IMPORTANT: This file provides fallback data for initial render.
 * The actual taxonomy is fetched from the backend API via useTaxonomy hook.
 * Use the hook for dynamic data; use these exports only for immediate rendering.
 *
 * The backend API (/api/v1/taxonomy/principles) is the single source of truth.
 */

/**
 * Fallback principle taxonomy for immediate render
 * This matches the 16 principles from the backend taxonomy
 */
export const PRINCIPLE_TAXONOMY = {
  // KARMA (Action)
  dharma: {
    label: "Righteous Duty",
    shortLabel: "Duty",
    description: "Honor your responsibilities and role. Act on what is right, not what is convenient.",
  },
  nishkama_karma: {
    label: "Selfless Action",
    shortLabel: "Selfless Action",
    description: "Act without attachment to outcomes. Focus on the process, not results.",
  },
  svadharma: {
    label: "True to Your Nature",
    shortLabel: "Your Nature",
    description: "Align work with your innate strengths and authentic self.",
  },
  seva: {
    label: "Selfless Service",
    shortLabel: "Service",
    description: "Act for the welfare of others without expectation. Lead by personal example.",
  },
  // JNANA (Knowledge)
  viveka: {
    label: "Discernment",
    shortLabel: "Discernment",
    description: "Distinguish the essential from non-essential, wise from unwise.",
  },
  jnana: {
    label: "Self-Knowledge",
    shortLabel: "Knowledge",
    description: "Pursue understanding of self, truth, and the nature of reality.",
  },
  sthitaprajna: {
    label: "Steady Wisdom",
    shortLabel: "Steady Wisdom",
    description: "Maintain clarity and stability of mind amidst changing circumstances.",
  },
  tyaga: {
    label: "Letting Go",
    shortLabel: "Letting Go",
    description: "Release attachments to possessions, status, ego, and past.",
  },
  // BHAKTI (Devotion)
  bhakti: {
    label: "Devotion",
    shortLabel: "Devotion",
    description: "Cultivate love and connection to something greater than yourself.",
  },
  sharanagati: {
    label: "Surrender",
    shortLabel: "Surrender",
    description: "Let go of ego-driven control. Trust in the larger order.",
  },
  shraddha: {
    label: "Faith",
    shortLabel: "Faith",
    description: "Act with conviction and trust. You become what you believe.",
  },
  dhyana: {
    label: "Meditation",
    shortLabel: "Meditation",
    description: "Cultivate inner stillness, focus, and connection through practice.",
  },
  // SADACHARA (Character)
  samatvam: {
    label: "Equanimity",
    shortLabel: "Equanimity",
    description: "Remain balanced in success and failure, praise and criticism.",
  },
  discipline: {
    label: "Self-Mastery",
    shortLabel: "Discipline",
    description: "Control senses, mind, and impulses. Cultivate restraint.",
  },
  virtue: {
    label: "Noble Qualities",
    shortLabel: "Virtue",
    description: "Embody divine qualities: truthfulness, courage, compassion, patience.",
  },
  abhyasa: {
    label: "Practice",
    shortLabel: "Practice",
    description: "Persist through consistent effort. Growth comes through repetition.",
  },
  // Legacy mappings for backward compatibility during re-enrichment
  duty_focus: {
    label: "Righteous Duty",
    shortLabel: "Duty",
    description: "Honor your responsibilities and role.",
  },
  detachment: {
    label: "Selfless Action",
    shortLabel: "Selfless Action",
    description: "Act without attachment to outcomes.",
  },
  self_control: {
    label: "Self-Mastery",
    shortLabel: "Discipline",
    description: "Cultivate self-discipline, mental clarity, and personal integrity.",
  },
  informed_choice: {
    label: "Discernment",
    shortLabel: "Discernment",
    description: "Make decisions with full knowledge and freedom.",
  },
  role_fit: {
    label: "True to Your Nature",
    shortLabel: "Your Nature",
    description: "Match responsibilities to natural capabilities and strengths.",
  },
  compassion: {
    label: "Selfless Service",
    shortLabel: "Service",
    description: "Minimize harm and balance stakeholder needs with empathy.",
  },
  self_responsibility: {
    label: "Selfless Service",
    shortLabel: "Service",
    description: "Lead through personal action and take responsibility for growth.",
  },
  ethical_character: {
    label: "Noble Qualities",
    shortLabel: "Virtue",
    description: "Filter actions through virtuous qualities like truthfulness and courage.",
  },
  consistent_duty: {
    label: "Practice",
    shortLabel: "Practice",
    description: "Perform duties regularly. Avoid impulsive or erratic behavior.",
  },
} as const;

export type PrincipleId = keyof typeof PRINCIPLE_TAXONOMY;

/**
 * Get principle label by ID (fallback function for immediate render)
 * For dynamic data, use useTaxonomy().getPrincipleLabel instead
 */
export function getPrincipleLabel(principleId: string): string {
  const principle = PRINCIPLE_TAXONOMY[principleId as PrincipleId];
  return principle?.label ?? principleId;
}

/**
 * Get principle short label by ID (for pills/tags)
 * For dynamic data, use useTaxonomy().getPrincipleShortLabel instead
 */
export function getPrincipleShortLabel(principleId: string): string {
  const principle = PRINCIPLE_TAXONOMY[principleId as PrincipleId];
  return principle?.shortLabel ?? principleId;
}

/**
 * Get principle description by ID
 * For dynamic data, use useTaxonomy().getPrincipleDescription instead
 */
export function getPrincipleDescription(principleId: string): string {
  const principle = PRINCIPLE_TAXONOMY[principleId as PrincipleId];
  return principle?.description ?? "";
}
