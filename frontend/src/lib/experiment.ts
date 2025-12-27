/**
 * Minimal A/B testing framework
 *
 * Client-side variant assignment with server-side event tracking.
 * Variants are persisted in localStorage for consistency.
 */

import { api } from "./api";
import { setStorageItemRaw } from "./storage";

const EXPERIMENT_PREFIX = "exp_";

export type Variant = "control" | "variant";

export interface ExperimentConfig {
  name: string;
  variants: readonly Variant[];
  weights?: readonly number[]; // Default: equal distribution
}

/**
 * Get or assign a variant for an experiment
 * Persisted in localStorage for consistency across sessions
 */
export function getVariant(experiment: ExperimentConfig): Variant {
  const storageKey = `${EXPERIMENT_PREFIX}${experiment.name}`;
  const stored = localStorage.getItem(storageKey) as Variant | null;

  if (stored && experiment.variants.includes(stored)) {
    return stored;
  }

  // Assign new variant
  const variant = assignVariant(experiment);
  setStorageItemRaw(storageKey, variant);

  // Track assignment (fire and forget)
  trackEvent(experiment.name, "assigned", { variant });

  return variant;
}

/**
 * Assign variant based on weights (default: equal distribution)
 */
function assignVariant(experiment: ExperimentConfig): Variant {
  const weights = experiment.weights || experiment.variants.map(() => 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const random = Math.random() * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      return experiment.variants[i];
    }
  }

  return experiment.variants[0]; // Fallback
}

/**
 * Track an experiment event
 * Fire-and-forget - doesn't block UI
 */
export function trackEvent(
  experiment: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  // Don't track in development unless explicitly enabled
  if (import.meta.env.DEV && !import.meta.env.VITE_TRACK_EXPERIMENTS) {
    console.debug("[Experiment]", experiment, event, properties);
    return;
  }

  api
    .post("/experiments/events", {
      experiment,
      event,
      properties,
      timestamp: new Date().toISOString(),
    })
    .catch(() => {
      // Silent fail - analytics shouldn't break the app
    });
}

/**
 * Clear experiment assignment (for testing)
 */
export function clearExperiment(experimentName: string): void {
  localStorage.removeItem(`${EXPERIMENT_PREFIX}${experimentName}`);
}

/**
 * Get current variant without triggering assignment
 * Returns null if not yet assigned
 */
export function getCurrentVariant(experimentName: string): Variant | null {
  const storageKey = `${EXPERIMENT_PREFIX}${experimentName}`;
  return localStorage.getItem(storageKey) as Variant | null;
}

// ============================================
// Experiment Definitions
// ============================================

export const EXPERIMENTS = {
  HOMEPAGE_CTA: {
    name: "homepage_cta_v1",
    variants: ["control", "variant"] as Variant[],
    weights: [50, 50], // 50/50 split
  },
} as const;

/**
 * Hook for homepage CTA experiment
 * Returns the variant and a tracking function
 */
export function useHomepageCTAExperiment(): {
  variant: Variant;
  trackClick: () => void;
} {
  const variant = getVariant(EXPERIMENTS.HOMEPAGE_CTA);

  const trackClick = () => {
    const event = variant === "control" ? "cta_click" : "teaser_submit";
    trackEvent(EXPERIMENTS.HOMEPAGE_CTA.name, event, { variant });
  };

  return { variant, trackClick };
}
