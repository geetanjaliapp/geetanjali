import { describe, it, expect } from "vitest";
import { render, screen } from "../../test/utils";
import { TopicCard } from "./TopicCard";
import type { TopicPrincipleSummary } from "../../lib/api";

const mockPrinciple: TopicPrincipleSummary = {
  id: "dharma",
  label: "Righteous Duty",
  shortLabel: "Duty",
  sanskrit: "धर्म",
  transliteration: "Dharma",
  description: "Honor your responsibilities with integrity.",
  verseCount: 24,
};

describe("TopicCard", () => {
  it("renders Sanskrit name prominently", () => {
    render(<TopicCard principle={mockPrinciple} />);
    expect(screen.getByText("धर्म")).toBeInTheDocument();
  });

  it("renders English label", () => {
    render(<TopicCard principle={mockPrinciple} />);
    expect(screen.getByText("Righteous Duty")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<TopicCard principle={mockPrinciple} />);
    expect(
      screen.getByText("Honor your responsibilities with integrity."),
    ).toBeInTheDocument();
  });

  it("shows verse count when showVerseCount is true", () => {
    render(<TopicCard principle={mockPrinciple} showVerseCount />);
    expect(screen.getByText("24 verses")).toBeInTheDocument();
  });

  it("hides verse count when showVerseCount is false", () => {
    render(<TopicCard principle={mockPrinciple} showVerseCount={false} />);
    expect(screen.queryByText("24 verses")).not.toBeInTheDocument();
  });

  it("links to topic detail page", () => {
    render(<TopicCard principle={mockPrinciple} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/topics/dharma");
  });

  it("renders compact variant correctly", () => {
    render(<TopicCard principle={mockPrinciple} compact />);
    // In compact mode with Sanskrit, should show Sanskrit as primary
    expect(screen.getByText("धर्म")).toBeInTheDocument();
    // Should show shortLabel as secondary
    expect(screen.getByText("Duty")).toBeInTheDocument();
    // Description should not be visible in compact mode
    expect(
      screen.queryByText("Honor your responsibilities with integrity."),
    ).not.toBeInTheDocument();
  });

  it("renders compact variant without Sanskrit gracefully", () => {
    const principleNoSanskrit = { ...mockPrinciple, sanskrit: "" };
    render(<TopicCard principle={principleNoSanskrit} compact />);
    // Without Sanskrit, should show shortLabel as primary
    expect(screen.getByText("Duty")).toBeInTheDocument();
    // Should show full label as secondary
    expect(screen.getByText("Righteous Duty")).toBeInTheDocument();
  });

  it("handles zero verse count gracefully", () => {
    const principleNoVerses = { ...mockPrinciple, verseCount: 0 };
    render(<TopicCard principle={principleNoVerses} showVerseCount />);
    // Should not show "0 verses"
    expect(screen.queryByText(/verses/)).not.toBeInTheDocument();
  });

  it("has accessible link with aria-label", () => {
    render(<TopicCard principle={mockPrinciple} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "aria-label",
      "Righteous Duty: Honor your responsibilities with integrity.",
    );
  });
});
