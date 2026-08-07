import { describe, it, expect } from "vitest";
import { render, screen } from "../test/utils";
import { FeaturedVerse } from "./FeaturedVerse";
import type { Verse } from "../types";

/**
 * The featured card is the largest element above the fold on the homepage. It shipped rendering
 * Devanagari and a verse reference only, which is legible to a minority of visitors. These tests
 * pin the transliteration and translation so that regression is visible rather than silent.
 */

const verse: Verse = {
  id: "test-id",
  canonical_id: "BG_2_47",
  chapter: 2,
  verse: 47,
  sanskrit_devanagari: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन",
  sanskrit_iast: "karmaṇy-evādhikāras te mā phaleṣu kadācana",
  translation_en: "You have the right to work only, but never to its fruits.",
  paraphrase_en: "Focus on your duty without attachment to outcomes.",
  consulting_principles: ["duty_focused_action"],
  is_featured: true,
  source: "test",
  license: "test",
} as Verse;

describe("FeaturedVerse", () => {
  it("renders Devanagari, transliteration and translation together", () => {
    render(<FeaturedVerse verse={verse} />);

    expect(screen.getByText(/कर्मण्येवाधिकारस्ते/)).toBeInTheDocument();
    expect(screen.getByText(verse.sanskrit_iast!)).toBeInTheDocument();
    expect(screen.getByText(verse.translation_en!)).toBeInTheDocument();
  });

  it("marks the language of each script so screen readers switch pronunciation", () => {
    render(<FeaturedVerse verse={verse} />);

    expect(screen.getByText(verse.sanskrit_iast!)).toHaveAttribute(
      "lang",
      "sa-Latn",
    );
    expect(screen.getByText(verse.translation_en!)).toHaveAttribute(
      "lang",
      "en",
    );
  });

  it("omits the translation cleanly when the verse has none", () => {
    render(<FeaturedVerse verse={{ ...verse, translation_en: undefined }} />);

    expect(screen.getByText(verse.sanskrit_iast!)).toBeInTheDocument();
    expect(screen.queryByText(verse.translation_en!)).not.toBeInTheDocument();
    // The card still renders rather than collapsing.
    expect(screen.getByText(/कर्मण्येवाधिकारस्ते/)).toBeInTheDocument();
  });

  it("omits the transliteration cleanly when the verse has none", () => {
    render(<FeaturedVerse verse={{ ...verse, sanskrit_iast: undefined }} />);

    expect(screen.queryByText(verse.sanskrit_iast!)).not.toBeInTheDocument();
    expect(screen.getByText(verse.translation_en!)).toBeInTheDocument();
  });

  it("keeps the whole card a single link target", () => {
    render(<FeaturedVerse verse={verse} />);

    // Added text must not introduce nested interactive elements inside the wrapping Link.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/verses/BG_2_47");
  });
});
