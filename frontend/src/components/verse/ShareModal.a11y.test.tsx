import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils";
import { axe } from "vitest-axe";
import { ShareModal } from "./ShareModal";

// Mock canvas context for image generation
vi.mock("./ImageCardGenerator", () => ({
  generateVerseImage: vi.fn().mockResolvedValue("data:image/png;base64,test"),
  downloadImage: vi.fn(),
}));

describe("ShareModal accessibility", () => {
  const mockVerse = {
    id: "verse-1",
    chapter: 2,
    verse: 47,
    canonical_id: "BG_2_47",
    sanskrit_devanagari: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
    sanskrit_iast: "karmaṇy evādhikāras te",
    translation_en: "You have a right to perform your prescribed duties.",
    paraphrase_en: "Focus on your work, not the fruits.",
    created_at: "2024-01-01T00:00:00Z",
  };

  const defaultProps = {
    verse: mockVerse,
    isOpen: true,
    onClose: vi.fn(),
  };

  it("should have no accessibility violations when open", async () => {
    const { baseElement } = render(<ShareModal {...defaultProps} />);

    // Wait for async rendering
    await new Promise((resolve) => setTimeout(resolve, 100));

    const results = await axe(baseElement, {
      rules: {
        // Modal renders in portal
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });

  it("should have proper dialog semantics", () => {
    const { baseElement } = render(<ShareModal {...defaultProps} />);

    const dialog = baseElement.querySelector('[role="dialog"]');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should have no violations with Hindi translation", async () => {
    const { baseElement } = render(
      <ShareModal
        {...defaultProps}
        hindiTranslation={{
          id: "trans-1",
          verse_id: "verse-1",
          language: "hindi",
          text: "कर्म में ही तुम्हारा अधिकार है",
        }}
      />
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    const results = await axe(baseElement, {
      rules: {
        region: { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});
