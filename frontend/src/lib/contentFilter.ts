/**
 * Client-side content validation module.
 *
 * Provides fast client-side filtering to:
 * 1. Give instant feedback to users
 * 2. Reduce unnecessary API calls for obvious violations
 *
 * Note: This is for UX optimization only. Backend validation is authoritative
 * and cannot be bypassed.
 */

import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

// ============================================================================
// Types
// ============================================================================

export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

export type ViolationType = "gibberish" | "abuse" | "valid";

// ============================================================================
// Obscenity Matcher Setup
// ============================================================================

// Create matcher with English dataset and recommended transformers
// Transformers handle obfuscation like "f4ck" -> "fuck"
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// ============================================================================
// Common Words for Gibberish Detection
// ============================================================================

// Subset of backend's common words list - enough for client-side quick check
const COMMON_WORDS = new Set([
  // Articles, pronouns, prepositions
  "a",
  "an",
  "the",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "she",
  "it",
  "they",
  "them",
  "his",
  "her",
  "its",
  "their",
  "this",
  "that",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "up",
  "out",
  "if",
  "or",
  "and",
  "but",
  "not",
  "no",
  "so",
  "as",
  "be",
  "am",
  "is",
  "are",
  "was",
  "were",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  // Common verbs
  "can",
  "could",
  "will",
  "would",
  "should",
  "may",
  "might",
  "must",
  "get",
  "make",
  "go",
  "going",
  "come",
  "take",
  "know",
  "think",
  "see",
  "want",
  "need",
  "feel",
  "try",
  "help",
  "tell",
  "ask",
  "work",
  "give",
  "find",
  "say",
  "said",
  // Common nouns
  "people",
  "person",
  "man",
  "woman",
  "child",
  "time",
  "year",
  "day",
  "way",
  "thing",
  "world",
  "life",
  "hand",
  "part",
  "place",
  "case",
  "home",
  "job",
  "family",
  "friend",
  "money",
  // Common adjectives
  "good",
  "new",
  "first",
  "last",
  "long",
  "great",
  "little",
  "own",
  "other",
  "old",
  "right",
  "big",
  "small",
  "next",
  "young",
  "important",
  "bad",
  "same",
  "able",
  "best",
  "better",
  // Question words and adverbs
  "what",
  "which",
  "who",
  "how",
  "when",
  "where",
  "why",
  "all",
  "each",
  "every",
  "some",
  "any",
  "many",
  "much",
  "more",
  "very",
  "just",
  "only",
  "also",
  "well",
  "now",
  "here",
  "there",
  // Domain-relevant
  "decision",
  "choice",
  "dilemma",
  "problem",
  "situation",
  "question",
  "answer",
  "option",
  "career",
  "boss",
  "manager",
  "company",
  "ethical",
  "moral",
  "wrong",
  "fair",
  "honest",
  "duty",
  "advice",
  "guidance",
  "support",
  "concern",
  "worry",
  "conflict",
  "relationship",
  "trust",
  "respect",
  "value",
]);

// Thresholds matching backend
const MIN_COMMON_WORD_RATIO = 0.25;
const MIN_DISTINCT_COMMON_WORDS = 3;

// ============================================================================
// Direct Abuse Patterns
// ============================================================================

// Patterns for direct abuse (profanity directed at reader/system)
const ABUSE_PATTERNS = [
  // Profanity + second person
  /\b(f+[uü*@4]+c*k+|fck|fuk)\s*(you|u|off|this|that)\b/i,
  /\b(you|u|ur)\s*(suck|f+[uü*@4]+c*k|fck|fuk|stink)\b/i,
  // Direct insults
  /\b(you|u)\s+(are\s+)?(an?\s+)?(idiot|moron|stupid|dumb|retard)/i,
  /\b(go\s+to\s+hell|die|kys|kill\s+yourself)\b/i,
  /\b(stfu|gtfo|foad)\b/i,
];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if text appears to be gibberish (no recognizable words).
 */
function isGibberish(text: string): boolean {
  // Extract alphabetic words
  const words = text.toLowerCase().match(/[a-z]+/g) || [];

  if (words.length === 0) {
    // No alphabetic words - allow short inputs (might be numbers)
    return text.trim().length > 20;
  }

  // Count distinct common words
  const foundCommon = new Set(words.filter((word) => COMMON_WORDS.has(word)));
  const distinctCommonCount = foundCommon.size;
  const totalWords = words.length;

  // Short inputs: need at least 1 common word
  if (totalWords <= 3) {
    return distinctCommonCount < 1;
  }

  // Longer inputs: need both ratio and distinct count
  const commonOccurrences = words.filter((word) => COMMON_WORDS.has(word)).length;
  const ratio = commonOccurrences / totalWords;

  return ratio < MIN_COMMON_WORD_RATIO || distinctCommonCount < MIN_DISTINCT_COMMON_WORDS;
}

/**
 * Check if text contains direct abuse (not contextual profanity).
 */
function containsAbuse(text: string): boolean {
  // Check direct abuse patterns first
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Use obscenity matcher for obfuscated profanity
  if (matcher.hasMatch(text)) {
    // Found profanity - check if directed at reader
    const secondPersonPattern = /\b(you|u|ur|yours?|yourself)\b/i;
    if (secondPersonPattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Validate content before submission.
 *
 * Provides instant client-side feedback for obvious violations.
 * This is for UX only - backend validation is authoritative.
 *
 * @param text - The text to validate (combined title + description)
 * @returns ValidationResult with valid flag and optional reason
 */
export function validateContent(text: string): ValidationResult {
  // Skip validation for very short text (might still be typing)
  if (text.trim().length < 5) {
    return { valid: true };
  }

  // Check for gibberish
  if (isGibberish(text)) {
    return {
      valid: false,
      reason:
        "Please enter a clear description of your dilemma. " +
        "Try describing the specific situation you're facing.",
    };
  }

  // Check for direct abuse
  if (containsAbuse(text)) {
    return {
      valid: false,
      reason:
        "Please rephrase without direct offensive language. " +
        "If describing a difficult situation, try framing it differently.",
    };
  }

  return { valid: true };
}

/**
 * Get the type of content violation (for analytics/logging).
 */
export function getViolationType(text: string): ViolationType {
  if (isGibberish(text)) return "gibberish";
  if (containsAbuse(text)) return "abuse";
  return "valid";
}
