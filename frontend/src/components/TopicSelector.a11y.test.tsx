import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../test/utils";
import { axe } from "vitest-axe";
import { TopicSelector } from "./TopicSelector";

// Mock useTaxonomy hook
vi.mock("../hooks/useTaxonomy", () => ({
  useTaxonomy: () => ({
    groups: [
      { id: "karma", label: "Karma", sanskrit: "योग", description: "Path of action" },
      { id: "jnana", label: "Jnana", sanskrit: "ज्ञान", description: "Path of knowledge" },
    ],
    getPrinciplesForGroup: (groupId: string) => {
      const principlesByGroup: Record<string, Array<{ id: string; shortLabel: string; group: string }>> = {
        karma: [
          { id: "dharma", shortLabel: "Duty", group: "karma" },
          { id: "nishkama_karma", shortLabel: "Selfless Action", group: "karma" },
        ],
        jnana: [
          { id: "jnana", shortLabel: "Knowledge", group: "jnana" },
          { id: "viveka", shortLabel: "Discernment", group: "jnana" },
        ],
      };
      return principlesByGroup[groupId] || [];
    },
    loading: false,
    error: null,
  }),
}));

describe("TopicSelector accessibility", () => {
  const defaultProps = {
    selectedTopic: null,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    isOpen: true,
  };

  // Note: Component uses role="group" pattern for grouped topics.
  // Dialog region rule is disabled as backdrop is aria-hidden.
  const axeRules = {
    region: { enabled: false },
  };

  it("should have no accessibility violations when open", async () => {
    const { container } = render(<TopicSelector {...defaultProps} />);

    const results = await axe(container, { rules: axeRules });
    expect(results).toHaveNoViolations();
  });

  it("should have proper dialog role and label", () => {
    render(<TopicSelector {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Select topic");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should have group roles with proper labels", () => {
    render(<TopicSelector {...defaultProps} />);

    // Each yoga path should be a group
    const groups = screen.getAllByRole("group");
    expect(groups.length).toBe(2); // karma and jnana in mock

    // Groups should be labeled by their headings
    groups.forEach((group) => {
      expect(group).toHaveAttribute("aria-labelledby");
    });
  });

  it("should indicate selected state via aria-pressed", () => {
    render(<TopicSelector {...defaultProps} selectedTopic="dharma" />);

    const selectedButton = screen.getByText("Duty");
    expect(selectedButton).toHaveAttribute("aria-pressed", "true");

    const unselectedButton = screen.getByText("Knowledge");
    expect(unselectedButton).toHaveAttribute("aria-pressed", "false");
  });

  it("should have no violations with a topic selected", async () => {
    const { container } = render(
      <TopicSelector {...defaultProps} selectedTopic="dharma" />
    );

    const results = await axe(container, { rules: axeRules });
    expect(results).toHaveNoViolations();
  });

  it("should have visible focus indicators via focus-visible classes", () => {
    render(<TopicSelector {...defaultProps} />);

    const buttons = screen.getAllByRole("button");
    // All topic buttons should have focus-visible styling
    buttons.forEach((button) => {
      expect(button.className).toContain("focus-visible:ring");
    });
  });
});
