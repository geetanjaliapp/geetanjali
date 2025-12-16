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

// Thresholds matching backend (content_filter.py:216-218)
const MIN_COMMON_WORD_RATIO = 0.2; // At least 20% common words
const MIN_DISTINCT_COMMON_WORDS = 2; // At least 2 distinct common words
const SHORT_INPUT_WORD_CUTOFF = 6; // Short inputs only need 1 common word

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
  /\b(go\s+to\s+hell|kys|kill\s+yourself)\b/i,
  /\b(you\s+should\s+die|just\s+die|go\s+die)\b/i, // "die" only when directed at someone
  /\b(stfu|gtfo|foad)\b/i, // Common abuse acronyms
  // Slurs (always blocked, even in context) - match backend patterns
  /\b(n+[i1*]+gg+[ae3*]+r?|f+[a@4]+gg*[o0]+t|r+[e3]+t+[a@4]+r+d)\b/i,
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

  // Short inputs (1-6 words): need at least 1 common word
  // Allows natural follow-up questions like "What about option C?"
  if (totalWords <= SHORT_INPUT_WORD_CUTOFF) {
    return distinctCommonCount < 1;
  }

  // Longer inputs: need both ratio and distinct count
  const commonOccurrences = words.filter((word) =>
    COMMON_WORDS.has(word),
  ).length;
  const ratio = commonOccurrences / totalWords;

  return (
    ratio < MIN_COMMON_WORD_RATIO ||
    distinctCommonCount < MIN_DISTINCT_COMMON_WORDS
  );
}

/**
 * Check if text contains direct abuse (not contextual profanity).
 *
 * Known limitation: The second-person check looks for profanity AND
 * second-person pronouns anywhere in the text, not adjacency. This means
 * "You told me he called it bullshit" could be blocked even though the
 * profanity isn't directed at the reader. This is a design tradeoff favoring
 * fewer false negatives over false positives. Backend validation is authoritative.
 */
function containsAbuse(text: string): boolean {
  // Check direct abuse patterns first
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Use obscenity matcher for obfuscated profanity
  try {
    if (matcher.hasMatch(text)) {
      // Found profanity - check if directed at reader
      const secondPersonPattern = /\b(you|u|ur|yours?|yourself)\b/i;
      if (secondPersonPattern.test(text)) {
        return true;
      }
    }
  } catch {
    // If obscenity matcher fails, fall through to backend validation
    console.warn("Obscenity matcher error, deferring to backend");
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

// ============================================================================
// Search-Specific Validation
// ============================================================================
// Search queries for sacred text need stricter rules than consultation:
// - Block ANY profanity (not just directed)
// - Block explicit content (sexual, violence)
// - Lenient gibberish for short queries (1-3 words)

// Explicit content patterns (aligned with backend)
const EXPLICIT_PATTERNS = [
  // Sexual content
  /\b(sex|sexual)\s+(act|position|fantasy|slave)/i,
  /\b(orgasm|climax|masturbat|jerk\s*off)/i,
  /\b(penis|vagina|genitals?|cock|dick|pussy|cunt)\b/i,
  /\b(erotic|pornograph|xxx)\b/i,
  /\b(naked|nude)\s+(photo|pic|image|video)/i,
  /\b(blow\s*job|hand\s*job)\b/i,
  /\b(incest|bestiality|pedophil)/i,
  // Violence/harm
  /\b(kill|murder|assassinate)\s+(someone|him|her|them|people)\b/i,
  /\b(torture|mutilate|dismember)\b/i,
  /\bhow\s+to\s+(make|build)\s+(bomb|weapon|poison)\b/i,
  /\b(rape|sexual\s+assault)\s+(her|him|someone)\b/i,
];

// Spam patterns (aligned with backend)
const SPAM_PATTERNS = [
  /(.)\1{10,}/, // Same character repeated 10+ times
  /[^a-zA-Z\s]{20,}/, // 20+ consecutive non-letter chars
];

/**
 * Check if text contains profanity (for search queries).
 *
 * Unlike containsAbuse(), this blocks ANY profanity regardless of context.
 * Used for search where even single-word profanity should be blocked.
 */
function containsProfanity(text: string): boolean {
  // Check direct abuse patterns (slurs, etc.)
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Use obscenity matcher for profanity detection
  try {
    return matcher.hasMatch(text);
  } catch {
    console.warn("Obscenity matcher error, deferring to backend");
    return false;
  }
}

/**
 * Check if text contains explicit content (sexual, violence).
 */
function containsExplicitContent(text: string): boolean {
  for (const pattern of EXPLICIT_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if text is spam (repeated characters, etc.).
 */
function isSpam(text: string): boolean {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if search query is gibberish (lenient for short queries).
 *
 * Aligned with backend _is_search_gibberish:
 * - Skip for 1-3 word queries (allows "karma", "duty dharma", etc.)
 * - For 4+ words, require at least one common word
 */
function isSearchGibberish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];

  // No alphabetic words - allow short inputs
  if (words.length === 0) {
    return text.trim().length > 15;
  }

  // Short queries (1-3 words): skip gibberish check
  if (words.length <= 3) {
    return false;
  }

  // For longer queries (4+ words), require at least one common word
  const foundCommon = words.filter((word) => COMMON_WORDS.has(word));
  return foundCommon.length < 1;
}

/**
 * Validate search query for sacred text search.
 *
 * Aligned with backend check_search_query():
 * - Block explicit content (sexual, violence)
 * - Block ALL profanity (stricter than consultation)
 * - Block spam (repeated chars)
 * - Lenient gibberish: skip for 1-3 words, light check for 4+
 *
 * Frontend provides instant feedback; backend is authoritative.
 *
 * @param query - The search query to validate
 * @returns ValidationResult with valid flag and optional reason
 */
export function validateSearchQuery(query: string): ValidationResult {
  const trimmed = query.trim();

  // Skip validation for empty queries
  if (trimmed.length === 0) {
    return { valid: true };
  }

  // Check explicit content (sexual, violence)
  if (containsExplicitContent(trimmed)) {
    return {
      valid: false,
      reason: "Please use appropriate search terms.",
    };
  }

  // Check profanity (strict - any profanity blocked for sacred text)
  if (containsProfanity(trimmed)) {
    return {
      valid: false,
      reason: "Please use appropriate language in your search.",
    };
  }

  // Check spam patterns
  if (isSpam(trimmed)) {
    return {
      valid: false,
      reason: "Please enter a valid search term.",
    };
  }

  // Check gibberish (lenient for search - aligned with backend)
  if (isSearchGibberish(trimmed)) {
    return {
      valid: false,
      reason: "Please enter a clearer search term.",
    };
  }

  return { valid: true };
}
