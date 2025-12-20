import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutputFeedback } from "./OutputFeedback";
import { mockOutput } from "../../test/fixtures";

describe("OutputFeedback", () => {
  const defaultProps = {
    output: mockOutput,
    feedback: null as "up" | "down" | null,
    feedbackLoading: null as string | null,
    expandedFeedback: null as string | null,
    feedbackText: {} as Record<string, string>,
    onFeedback: vi.fn(),
    onSubmitNegativeFeedback: vi.fn(),
    onCancelFeedback: vi.fn(),
    onFeedbackTextChange: vi.fn(),
  };

  it("should render confidence indicator", () => {
    render(<OutputFeedback {...defaultProps} />);

    expect(screen.getByText("Confidence:")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("should render thumbs up and down buttons", () => {
    const { container } = render(<OutputFeedback {...defaultProps} />);

    // Two feedback buttons
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
  });

  describe("confidence indicator colors", () => {
    it("should show green for high confidence (>=0.8)", () => {
      const { container } = render(
        <OutputFeedback
          {...defaultProps}
          output={{ ...mockOutput, confidence: 0.85 }}
        />,
      );

      const bar = container.querySelector(".bg-green-500");
      expect(bar).toBeInTheDocument();
    });

    it("should show yellow for medium confidence (0.6-0.8)", () => {
      const { container } = render(
        <OutputFeedback
          {...defaultProps}
          output={{ ...mockOutput, confidence: 0.7 }}
        />,
      );

      const bar = container.querySelector(".bg-yellow-500");
      expect(bar).toBeInTheDocument();
    });

    it("should show red for low confidence (<0.6)", () => {
      const { container } = render(
        <OutputFeedback
          {...defaultProps}
          output={{ ...mockOutput, confidence: 0.4 }}
        />,
      );

      const bar = container.querySelector(".bg-red-500");
      expect(bar).toBeInTheDocument();
    });
  });

  describe("feedback interactions", () => {
    it('should call onFeedback with "up" when thumbs up clicked', () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <OutputFeedback {...defaultProps} onFeedback={onFeedback} />,
      );

      const buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[0]); // First button is thumbs up

      expect(onFeedback).toHaveBeenCalledWith(mockOutput.id, "up");
    });

    it('should call onFeedback with "down" when thumbs down clicked', () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <OutputFeedback {...defaultProps} onFeedback={onFeedback} />,
      );

      const buttons = container.querySelectorAll("button");
      fireEvent.click(buttons[1]); // Second button is thumbs down

      expect(onFeedback).toHaveBeenCalledWith(mockOutput.id, "down");
    });

    it("should disable buttons when loading", () => {
      const { container } = render(
        <OutputFeedback {...defaultProps} feedbackLoading={mockOutput.id} />,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });
  });

  describe("feedback visual state", () => {
    it('should show thumbs up as active when feedback is "up"', () => {
      const { container } = render(
        <OutputFeedback {...defaultProps} feedback="up" />,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons[0].className).toContain("bg-green-500");
    });

    it('should show thumbs down as active when feedback is "down"', () => {
      const { container } = render(
        <OutputFeedback {...defaultProps} feedback="down" />,
      );

      const buttons = container.querySelectorAll("button");
      expect(buttons[1].className).toContain("bg-red-500");
    });
  });

  describe("negative feedback form", () => {
    it("should show feedback form when expandedFeedback matches output", () => {
      render(
        <OutputFeedback {...defaultProps} expandedFeedback={mockOutput.id} />,
      );

      expect(
        screen.getByText("What could be improved? (optional)"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Tell us what wasn't helpful..."),
      ).toBeInTheDocument();
    });

    it("should not show feedback form when expandedFeedback is null", () => {
      render(<OutputFeedback {...defaultProps} expandedFeedback={null} />);

      expect(
        screen.queryByText("What could be improved? (optional)"),
      ).not.toBeInTheDocument();
    });

    it("should call onFeedbackTextChange when typing", () => {
      const onFeedbackTextChange = vi.fn();
      render(
        <OutputFeedback
          {...defaultProps}
          expandedFeedback={mockOutput.id}
          onFeedbackTextChange={onFeedbackTextChange}
        />,
      );

      const textarea = screen.getByPlaceholderText(
        "Tell us what wasn't helpful...",
      );
      fireEvent.change(textarea, { target: { value: "Not helpful" } });

      expect(onFeedbackTextChange).toHaveBeenCalledWith(
        mockOutput.id,
        "Not helpful",
      );
    });

    it("should call onSubmitNegativeFeedback when submit clicked", () => {
      const onSubmitNegativeFeedback = vi.fn();
      render(
        <OutputFeedback
          {...defaultProps}
          expandedFeedback={mockOutput.id}
          onSubmitNegativeFeedback={onSubmitNegativeFeedback}
        />,
      );

      fireEvent.click(screen.getByText("Submit"));
      expect(onSubmitNegativeFeedback).toHaveBeenCalledWith(mockOutput.id);
    });

    it("should call onCancelFeedback when cancel clicked", () => {
      const onCancelFeedback = vi.fn();
      render(
        <OutputFeedback
          {...defaultProps}
          expandedFeedback={mockOutput.id}
          onCancelFeedback={onCancelFeedback}
        />,
      );

      fireEvent.click(screen.getByText("Cancel"));
      expect(onCancelFeedback).toHaveBeenCalledWith(mockOutput.id);
    });

    it('should show "Saving..." when loading', () => {
      render(
        <OutputFeedback
          {...defaultProps}
          expandedFeedback={mockOutput.id}
          feedbackLoading={mockOutput.id}
        />,
      );

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });
  });
});
