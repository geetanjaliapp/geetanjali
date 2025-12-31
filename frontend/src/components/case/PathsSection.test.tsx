import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { PathsSection } from "./PathsSection";
import { TTSProvider } from "../../contexts/TTSContext";
import { AudioPlayerProvider } from "../../components/audio";
import type { ReactNode } from "react";

// Wrapper with providers for tests that render SpeakButton
// TTSProvider requires AudioPlayerProvider (for stopping audio recitation) and Router (for useLocation)
const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AudioPlayerProvider>
      <TTSProvider>{children}</TTSProvider>
    </AudioPlayerProvider>
  </BrowserRouter>
);

const mockOptions = [
  {
    title: "Direct Approach",
    pros: ["Clear communication", "Quick resolution"],
    cons: ["May cause tension"],
  },
  {
    title: "Gradual Approach",
    pros: ["Less confrontational", "Builds trust"],
    cons: ["Takes more time", "Uncertain outcome"],
  },
  {
    title: "Delegate Approach",
    pros: ["Removes direct conflict"],
    cons: ["Less control", "May not resolve issue"],
  },
];

describe("PathsSection", () => {
  const defaultProps = {
    options: mockOptions,
    selectedOption: 0,
    showPaths: false,
    onToggle: vi.fn(),
    onSelectOption: vi.fn(),
  };

  it("should render nothing when options are empty", () => {
    const { container } = render(
      <PathsSection {...defaultProps} options={[]} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render collapsed state by default", () => {
    render(<PathsSection {...defaultProps} />);

    expect(screen.getByText("Paths Before You")).toBeInTheDocument();
    expect(screen.getByText("3 approaches to consider")).toBeInTheDocument();
  });

  it("should call onToggle when header is clicked", () => {
    const onToggle = vi.fn();
    render(<PathsSection {...defaultProps} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("Paths Before You"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  describe("expanded state", () => {
    it("should show all path options when expanded", () => {
      render(<PathsSection {...defaultProps} showPaths={true} />, { wrapper });

      expect(screen.getByText("Path 1")).toBeInTheDocument();
      expect(screen.getByText("Path 2")).toBeInTheDocument();
      expect(screen.getByText("Path 3")).toBeInTheDocument();
    });

    it("should show selected option details", () => {
      render(
        <PathsSection {...defaultProps} showPaths={true} selectedOption={0} />,
        { wrapper },
      );

      expect(screen.getByText("Direct Approach")).toBeInTheDocument();
      expect(screen.getByText("Clear communication")).toBeInTheDocument();
      expect(screen.getByText("May cause tension")).toBeInTheDocument();
    });

    it("should call onSelectOption when path is clicked", () => {
      const onSelectOption = vi.fn();
      render(
        <PathsSection
          {...defaultProps}
          showPaths={true}
          onSelectOption={onSelectOption}
        />,
        { wrapper },
      );

      fireEvent.click(screen.getByText("Path 2"));
      expect(onSelectOption).toHaveBeenCalledWith(1);
    });

    it("should display pros and cons for selected option", () => {
      render(
        <PathsSection {...defaultProps} showPaths={true} selectedOption={1} />,
        { wrapper },
      );

      // Selected option: Gradual Approach
      expect(screen.getByText("Gradual Approach")).toBeInTheDocument();
      expect(screen.getByText("Less confrontational")).toBeInTheDocument();
      expect(screen.getByText("Builds trust")).toBeInTheDocument();
      expect(screen.getByText("Takes more time")).toBeInTheDocument();
      expect(screen.getByText("Uncertain outcome")).toBeInTheDocument();
    });

    it("should show Benefits and Consider sections", () => {
      render(<PathsSection {...defaultProps} showPaths={true} />, { wrapper });

      expect(screen.getByText("Benefits")).toBeInTheDocument();
      expect(screen.getByText("Consider")).toBeInTheDocument();
    });
  });
});
