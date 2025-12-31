// API Response Types based on project-description.md

export type CaseStatus =
  | "draft"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "policy_violation";

export type ShareMode = "full" | "essential";

export interface Case {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  role: string;
  stakeholders: string[];
  constraints: string[];
  horizon: "short" | "medium" | "long";
  sensitivity?: "low" | "medium" | "high";
  status?: CaseStatus;
  is_public?: boolean;
  public_slug?: string | null;
  share_mode?: ShareMode | null;
  view_count?: number;
  is_deleted?: boolean;
  created_at?: string;
}

export interface Verse {
  id: string;
  canonical_id: string; // e.g., BG_2_47
  chapter: number;
  verse: number;
  sanskrit_iast?: string;
  sanskrit_devanagari?: string;
  translation_en?: string; // Primary English translation (from source)
  paraphrase_en?: string; // LLM-generated leadership summary
  consulting_principles?: string[];
  is_featured?: boolean; // Whether verse is in curated featured list
  source?: string;
  license?: string;
  created_at: string;
  audio_url?: string | null; // URL to audio recitation (null if not available)
  duration_ms?: number | null; // Audio duration in milliseconds (for auto-advance timing)
}

export interface Option {
  title: string;
  description?: string;
  pros: string[];
  cons: string[];
  sources?: string[]; // canonical_ids of related verses
  verses?: string[]; // canonical_ids (optional - may be missing in fallback responses)
}

export interface UserFeedbackSummary {
  rating: boolean; // true = thumbs up, false = thumbs down
  comment?: string;
}

export interface Output {
  id: string;
  case_id: string;
  result_json: {
    executive_summary: string;
    options: Option[];
    recommended_action:
      | string
      | {
          option?: number;
          steps?: string[];
          sources?: string[];
        };
    reflection_prompts: string[];
    sources: {
      canonical_id: string;
      paraphrase: string;
      school?: string;
    }[];
    confidence: number;
  };
  confidence: number;
  scholar_flag: boolean;
  created_at: string;
  user_feedback?: UserFeedbackSummary;
}

export interface ScholarReviewRequest {
  approved: boolean;
}

export interface Message {
  id: string;
  case_id: string;
  role: "user" | "assistant";
  content: string;
  output_id?: string;
  created_at: string;
}

export interface MessageCreate {
  content: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
}

// Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  org_id: string | null;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  name: string;
  password: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

export interface Translation {
  id: string;
  verse_id: string;
  text: string;
  language: string;
  translator?: string;
  school?: string;
  source?: string;
  license?: string;
}

// Feedback Types
export interface Feedback {
  id: string;
  output_id: string;
  rating: boolean;
  comment?: string;
  created_at: string;
}

export interface FeedbackCreate {
  rating: boolean;
  comment?: string;
}

// Follow-up conversation types
export interface FollowUpRequest {
  content: string;
}

export interface LLMAttribution {
  model: string;
  provider: string;
  input_tokens?: number;
  output_tokens?: number;
}

/**
 * Response from async follow-up submission (HTTP 202 Accepted).
 * Returns the user message immediately; assistant response is processed in background.
 * Poll case status until "completed" to get the assistant response.
 */
export interface FollowUpResponse {
  id: string;
  case_id: string;
  role: "user";
  content: string;
  output_id: string | null;
  created_at: string;
}

// Reading Mode Metadata Types

/** Book metadata for the cover page */
export interface BookMetadata {
  book_key: string;
  sanskrit_title: string;
  transliteration: string;
  english_title: string;
  tagline: string;
  intro_text: string;
  verse_count: number;
  chapter_count: number;
}

/** Chapter metadata for chapter intro cards */
export interface ChapterMetadata {
  chapter_number: number;
  sanskrit_name: string;
  transliteration: string;
  english_title: string;
  subtitle?: string;
  summary: string;
  verse_count: number;
  key_themes?: string[];
  hero_verse_id?: string;
}

/** Geeta Dhyanam verse (invocation verse) */
export interface GeetaDhyanamVerse {
  verse_number: number;
  sanskrit: string;
  iast: string;
  english: string;
  hindi: string;
  theme: string;
  duration_ms: number; // Audio duration in milliseconds
  audio_url: string; // Path to pre-generated audio file
}

// Search Types

/** Match type indicating how a verse matched the search query */
export type SearchMatchType =
  | "exact_canonical"
  | "exact_sanskrit"
  | "keyword_translation"
  | "keyword_paraphrase"
  | "principle"
  | "semantic";

/** Information about how a verse matched the search query */
export interface SearchMatch {
  type: SearchMatchType;
  field: string;
  score: number;
  highlight: string | null;
}

/** A single search result with verse data and match context */
export interface SearchResult {
  canonical_id: string;
  chapter: number;
  verse: number;
  sanskrit_devanagari: string | null;
  sanskrit_iast: string | null;
  translation_en: string | null;
  paraphrase_en: string | null;
  principles: string[];
  is_featured: boolean;
  match: SearchMatch;
  rank_score: number;
  audio_url: string | null;
}

/** Moderation result for blocked queries */
export interface SearchModeration {
  blocked: boolean;
  message: string;
}

/** Suggestion for alternative actions (e.g., consultation CTA) */
export interface SearchSuggestion {
  type: string;
  message: string;
  cta: string;
  prefill?: string;
}

/** Complete search response from the API */
export interface SearchResponse {
  query: string;
  strategy: string;
  total: number;
  total_count?: number;
  results: SearchResult[];
  moderation: SearchModeration | null;
  suggestion: SearchSuggestion | null;
}

// Featured Cases Types (Homepage)

/** Verse reference for featured case display */
export interface VerseRef {
  canonical_id: string;
  display: string;
}

/** A single featured case for homepage display */
export interface FeaturedCase {
  slug: string | null;
  category: string;
  dilemma_preview: string;
  guidance_summary: string;
  recommended_steps: string[];
  verse_references: VerseRef[];
  has_followups: boolean;
}

/** Response from GET /cases/featured */
export interface FeaturedCasesResponse {
  cases: FeaturedCase[];
  categories: string[];
  cached_at: string;
}

// User Preferences Types (Cross-device sync)

/** Favorites data in preferences */
export interface FavoritesPrefs {
  items: string[];
  updated_at: string;
}

/** Reading progress data in preferences */
export interface ReadingPrefs {
  chapter: number | null;
  verse: number | null;
  font_size: string;
  section_prefs: Record<string, boolean>;
  updated_at: string | null;
}

/** Learning goals data in preferences (multi-select) */
export interface LearningGoalsPrefs {
  goal_ids: string[];
  updated_at: string | null;
}

/** Theme preferences data */
export interface ThemePrefs {
  mode: string; // light/dark/system
  theme_id: string; // default/sutra/serenity/forest
  font_family: string; // serif/sans/mixed
  updated_at: string | null;
}

/** Full user preferences response */
export interface UserPreferences {
  favorites: FavoritesPrefs;
  reading: ReadingPrefs;
  learning_goals: LearningGoalsPrefs;
  theme: ThemePrefs;
}

/** Partial preferences update request */
export interface PreferencesUpdate {
  favorites?: { items: string[] };
  reading?: {
    chapter?: number;
    verse?: number;
    font_size?: string;
    section_prefs?: Record<string, boolean>;
  };
  learning_goals?: { goal_ids: string[] };
  theme?: {
    mode?: string;
    theme_id?: string;
    font_family?: string;
  };
}

/** Local preferences for merge request */
export interface LocalPreferences {
  favorites?: { items: string[]; updated_at?: string };
  reading?: {
    chapter?: number;
    verse?: number;
    font_size?: string;
    section_prefs?: Record<string, boolean>;
    updated_at?: string;
  };
  learning_goals?: { goal_ids?: string[]; updated_at?: string };
  theme?: {
    mode?: string;
    theme_id?: string;
    font_family?: string;
    updated_at?: string;
  };
}
