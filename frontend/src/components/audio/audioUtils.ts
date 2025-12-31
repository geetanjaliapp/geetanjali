/**
 * Audio utility functions (v1.17.0)
 */

// ============================================================================
// Timing Constants
// ============================================================================

/** Delay between verses in auto-advance mode (ms) */
export const ADVANCE_DELAY_MS = 800;

/** Duration to show completed state before auto-dismiss (ms) */
export const COMPLETED_DISPLAY_MS = 1500;

/** Preload threshold - start preloading next verse at this progress (0-1) */
export const PRELOAD_THRESHOLD = 0.8;

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format time in seconds to MM:SS or M:SS format
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format verse canonical ID to display format
 * BG_2_47 → BG 2.47
 */
export function formatVerseId(canonicalId: string): string {
  const parts = canonicalId.split("_");
  if (parts.length !== 3) return canonicalId;
  return `${parts[0]} ${parts[1]}.${parts[2]}`;
}
