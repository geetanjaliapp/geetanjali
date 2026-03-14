import type { Message, Output, Case, User, Verse } from "../types";

export const mockUser: User = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  role: "user",
  org_id: null,
  email_verified: true,
  created_at: "2024-01-01T00:00:00Z",
};

export const mockCase: Case = {
  id: "case-123",
  user_id: "user-123",
  title: "Test Case",
  description: "This is a test ethical dilemma",
  role: "Employee",
  stakeholders: ["team", "manager"],
  constraints: ["deadline", "budget"],
  horizon: "short",
  sensitivity: "medium",
  status: "completed",
  is_public: false,
  public_slug: null,
  is_deleted: false,
  created_at: "2024-01-01T10:00:00Z",
};

export const mockMessages: Message[] = [
  {
    id: "msg-1",
    case_id: "case-123",
    role: "user",
    content: "What should I do about this situation?",
    created_at: "2024-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    case_id: "case-123",
    role: "assistant",
    content: "Based on the Gita teachings...",
    output_id: "output-1",
    created_at: "2024-01-01T10:01:00Z",
  },
];

export const mockOutput: Output = {
  id: "output-1",
  case_id: "case-123",
  result_json: {
    executive_summary: "This is a test summary of the ethical guidance.",
    options: [
      {
        title: "Option A",
        pros: ["Pro 1", "Pro 2"],
        cons: ["Con 1"],
        verses: ["BG_2_47"],
      },
      {
        title: "Option B",
        pros: ["Pro A"],
        cons: ["Con A", "Con B"],
        verses: ["BG_3_35"],
      },
    ],
    recommended_action: {
      option: 1,
      steps: ["Step 1", "Step 2", "Step 3"],
      sources: ["BG_2_47"],
    },
    reflection_prompts: [
      "What does success mean to you?",
      "How would this decision affect others?",
    ],
    sources: [
      { canonical_id: "BG_2_47", paraphrase: "Focus on action, not results" },
      { canonical_id: "BG_3_35", paraphrase: "Follow your own dharma" },
    ],
    confidence: 0.85,
  },
  confidence: 0.85,
  scholar_flag: false,
  created_at: "2024-01-01T10:01:00Z",
};

export const mockOutputs: Output[] = [mockOutput];

export const mockVerse: Verse = {
  id: "verse-1",
  canonical_id: "BG_2_47",
  chapter: 2,
  verse: 47,
  sanskrit_iast: "karmaṇy evādhikāras te mā phaleṣu kadācana",
  sanskrit_devanagari: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
  translation_en: "You have the right to action, but never to its fruits.",
  paraphrase_en: "Focus on your duties without attachment to results.",
  consulting_principles: ["Focus on action", "Let go of attachment"],
  source: "Bhagavad Gita",
  license: "Public Domain",
  created_at: "2024-01-01T00:00:00Z",
};

// Multiple messages for testing grouping with retries
export const mockMessagesWithRetries: Message[] = [
  {
    id: "msg-1",
    case_id: "case-123",
    role: "user",
    content: "First question",
    created_at: "2024-01-01T10:00:00Z",
  },
  {
    id: "msg-2",
    case_id: "case-123",
    role: "assistant",
    content: "First response (will be replaced)",
    output_id: "output-old",
    created_at: "2024-01-01T10:01:00Z",
  },
  {
    id: "msg-3",
    case_id: "case-123",
    role: "assistant",
    content: "Retry response (latest)",
    output_id: "output-1",
    created_at: "2024-01-01T10:02:00Z",
  },
  {
    id: "msg-4",
    case_id: "case-123",
    role: "user",
    content: "Second question",
    created_at: "2024-01-01T10:05:00Z",
  },
  {
    id: "msg-5",
    case_id: "case-123",
    role: "assistant",
    content: "Second response",
    output_id: "output-2",
    created_at: "2024-01-01T10:06:00Z",
  },
];

export const mockOutputsMultiple: Output[] = [
  mockOutput,
  {
    ...mockOutput,
    id: "output-2",
    result_json: {
      ...mockOutput.result_json,
      executive_summary: "Second analysis summary",
    },
  },
];
