import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../test/utils";
import { TopicSelector } from "./TopicSelector";

// Mock useTaxonomy hook
vi.mock("../hooks/useTaxonomy", () => ({
  useTaxonomy: () => ({
    groups: [
      { id: "karma", label: "Karma", sanskrit: "योग", description: "Path of action" },
      { id: "jnana", label: "Jnana", sanskrit: "ज्ञान", description: "Path of knowledge" },
      { id: "bhakti", label: "Bhakti", sanskrit: "भक्ति", description: "Path of devotion" },
      { id: "sadachara", label: "Sadachara", sanskrit: "सदाचार", description: "Right conduct" },
    ],
    getPrinciplesForGroup: (groupId: string) => {
      const principlesByGroup: Record<string, Array<{ id: string; shortLabel: string; group: string }>> = {
        karma: [
          { id: "dharma", shortLabel: "Duty", group: "karma" },
          { id: "nishkama_karma", shortLabel: "Selfless Action", group: "karma" },
          { id: "svadharma", shortLabel: "Own Nature", group: "karma" },
          { id: "yoga", shortLabel: "Union", group: "karma" },
        ],
        jnana: [
          { id: "jnana", shortLabel: "Knowledge", group: "jnana" },
          { id: "viveka", shortLabel: "Discernment", group: "jnana" },
          { id: "atman", shortLabel: "Self", group: "jnana" },
          { id: "maya", shortLabel: "Illusion", group: "jnana" },
        ],
        bhakti: [
          { id: "bhakti", shortLabel: "Devotion", group: "bhakti" },
          { id: "shraddha", shortLabel: "Faith", group: "bhakti" },
          { id: "ishvara", shortLabel: "Divine", group: "bhakti" },
          { id: "seva", shortLabel: "Service", group: "bhakti" },
        ],
        sadachara: [
          { id: "satya", shortLabel: "Truth", group: "sadachara" },
          { id: "ahimsa", shortLabel: "Non-violence", group: "sadachara" },
          { id: "tapas", shortLabel: "Discipline", group: "sadachara" },
          { id: "sthitaprajna", shortLabel: "Equanimity", group: "sadachara" },
        ],
      };
      return principlesByGroup[groupId] || [];
    },
    loading: false,
    error: null,
  }),
}));

describe("TopicSelector", () => {
  const defaultProps = {
    selectedTopic: null,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    isOpen: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 4 groups when open", () => {
    render(<TopicSelector {...defaultProps} />);

    expect(screen.getByText("Karma")).toBeInTheDocument();
    expect(screen.getByText("Jnana")).toBeInTheDocument();
    expect(screen.getByText("Bhakti")).toBeInTheDocument();
    expect(screen.getByText("Sadachara")).toBeInTheDocument();
  });

  it("renders Sanskrit labels for each group", () => {
    render(<TopicSelector {...defaultProps} />);

    expect(screen.getByText("योग")).toBeInTheDocument();
    expect(screen.getByText("ज्ञान")).toBeInTheDocument();
    expect(screen.getByText("भक्ति")).toBeInTheDocument();
    expect(screen.getByText("सदाचार")).toBeInTheDocument();
  });

  it("renders all 16 principles", () => {
    render(<TopicSelector {...defaultProps} />);

    // Karma principles
    expect(screen.getByText("Duty")).toBeInTheDocument();
    expect(screen.getByText("Selfless Action")).toBeInTheDocument();
    expect(screen.getByText("Own Nature")).toBeInTheDocument();
    expect(screen.getByText("Union")).toBeInTheDocument();

    // Jnana principles
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Discernment")).toBeInTheDocument();
    expect(screen.getByText("Self")).toBeInTheDocument();
    expect(screen.getByText("Illusion")).toBeInTheDocument();

    // Bhakti principles
    expect(screen.getByText("Devotion")).toBeInTheDocument();
    expect(screen.getByText("Faith")).toBeInTheDocument();
    expect(screen.getByText("Divine")).toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();

    // Sadachara principles
    expect(screen.getByText("Truth")).toBeInTheDocument();
    expect(screen.getByText("Non-violence")).toBeInTheDocument();
    expect(screen.getByText("Discipline")).toBeInTheDocument();
    expect(screen.getByText("Equanimity")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<TopicSelector {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("highlights selected topic", () => {
    render(<TopicSelector {...defaultProps} selectedTopic="dharma" />);

    const dutyButton = screen.getByText("Duty");
    expect(dutyButton).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSelect when topic is clicked", () => {
    const onSelect = vi.fn();
    render(<TopicSelector {...defaultProps} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Duty"));

    expect(onSelect).toHaveBeenCalledWith("dharma");
  });

  it("calls onSelect with null when selected topic is clicked (toggle off)", () => {
    const onSelect = vi.fn();
    render(
      <TopicSelector
        {...defaultProps}
        selectedTopic="dharma"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText("Duty"));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<TopicSelector {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId("backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<TopicSelector {...defaultProps} onClose={onClose} />);

    // Find a button and fire keydown on it
    const firstButton = screen.getByText("Duty");
    fireEvent.keyDown(firstButton, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });

  it("renders footer link to topics page", () => {
    render(<TopicSelector {...defaultProps} />);

    const link = screen.getByText("Explore all teachings →");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/topics");
  });

  it("calls onClose when footer link is clicked", () => {
    const onClose = vi.fn();
    render(<TopicSelector {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText("Explore all teachings →"));

    expect(onClose).toHaveBeenCalled();
  });

  it("navigates with arrow keys", () => {
    render(<TopicSelector {...defaultProps} />);

    const dutyButton = screen.getByText("Duty");
    dutyButton.focus();

    // Arrow right should move focus to next button
    fireEvent.keyDown(dutyButton, { key: "ArrowRight" });

    // Check that focus moved (the focused element should be different)
    expect(document.activeElement).not.toBe(dutyButton);
  });
});
