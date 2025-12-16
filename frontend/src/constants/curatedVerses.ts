/**
 * Curated Verses - Central location for handpicked verses and quotes
 *
 * This file contains carefully selected verses used throughout the app
 * for waiting states, inspiration, and other static displays.
 *
 * Guidelines for adding verses:
 * - Ensure accurate verse references (chapter.verse format)
 * - Keep translations concise and accessible
 * - Avoid duplicate verse citations within the same array
 */

/** Quote with source reference */
export interface WisdomQuote {
  text: string;
  source: string; // Format: "BG chapter.verse"
}

/** Verse reference with short text */
export interface InspirationVerse {
  ref: string; // Format: "BG chapter.verse"
  text: string;
}

/**
 * Wisdom quotes displayed during waiting/thinking states
 * Used by: ConsultationWaiting, FollowUpThinking
 */
export const WISDOM_QUOTES: WisdomQuote[] = [
  {
    text: "The mind is restless and difficult to restrain, but it is subdued by practice.",
    source: "BG 6.35",
  },
  {
    text: "You have the right to work, but never to the fruit of work.",
    source: "BG 2.47",
  },
  {
    text: "The soul is neither born, and nor does it die.",
    source: "BG 2.20",
  },
  {
    text: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.",
    source: "BG 6.19",
  },
  {
    text: "One who sees inaction in action, and action in inaction, is intelligent among men.",
    source: "BG 4.18",
  },
];

/**
 * Short wisdom verses for decision-making inspiration
 * Used by: InspirationVerse (NewCase page)
 */
export const INSPIRATION_VERSES: InspirationVerse[] = [
  {
    ref: "BG 2.47",
    text: "You have the right to work, but never to the fruit of work.",
  },
  {
    ref: "BG 2.48",
    text: "Perform work in this world, Arjuna, as a man established within himself.",
  },
  {
    ref: "BG 3.35",
    text: "It is better to do one's own duty imperfectly than another's duty perfectly.",
  },
  {
    ref: "BG 6.5",
    text: "Elevate yourself through the power of your mind, and not degrade yourself.",
  },
  {
    ref: "BG 18.63",
    text: "Reflect on this fully, and then do as you wish.",
  },
];
