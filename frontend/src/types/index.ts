// API Response Types based on project-description.md

export type CaseStatus =
  | "draft"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "policy_violation";

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
