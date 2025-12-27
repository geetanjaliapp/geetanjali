import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CaseHeader } from "./CaseHeader";
import { mockCase } from "../../test/fixtures";

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("CaseHeader", () => {
  const defaultProps = {
    caseData: mockCase,
    canSave: true,
    canDelete: true,
    canShare: true,
    shareLoading: false,
    copySuccess: false,
    onSave: vi.fn(),
    onDeleteClick: vi.fn(),
    onShare: vi.fn(),
    onModeChange: vi.fn(),
    onStopSharing: vi.fn(),
    onCopyShareLink: vi.fn(),
  };

  it("should render back link", () => {
    renderWithRouter(<CaseHeader {...defaultProps} />);

    // Back link contains "←" and a span with "Back" (hidden on mobile)
    const backLink = screen.getByRole("link", { name: /back/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/consultations");
  });

  describe("Save button", () => {
    it("should render save button when canSave is true", () => {
      renderWithRouter(<CaseHeader {...defaultProps} />);

      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    });

    it("should not render save button when canSave is false", () => {
      renderWithRouter(<CaseHeader {...defaultProps} canSave={false} />);

      expect(
        screen.queryByRole("button", { name: /save/i }),
      ).not.toBeInTheDocument();
    });

    it("should call onSave when clicked", () => {
      const onSave = vi.fn();
      renderWithRouter(<CaseHeader {...defaultProps} onSave={onSave} />);

      fireEvent.click(screen.getByRole("button", { name: /save/i }));
      expect(onSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("Delete button (in overflow menu)", () => {
    it("should render overflow menu button when canDelete is true", () => {
      renderWithRouter(<CaseHeader {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /more options/i }),
      ).toBeInTheDocument();
    });

    it("should not render overflow menu when canDelete is false", () => {
      renderWithRouter(<CaseHeader {...defaultProps} canDelete={false} />);

      expect(
        screen.queryByRole("button", { name: /more options/i }),
      ).not.toBeInTheDocument();
    });

    it("should show delete option when overflow menu is clicked", () => {
      renderWithRouter(<CaseHeader {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: /more options/i }));
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("should call onDeleteClick when delete is clicked in menu", () => {
      const onDeleteClick = vi.fn();
      renderWithRouter(
        <CaseHeader {...defaultProps} onDeleteClick={onDeleteClick} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /more options/i }));
      fireEvent.click(screen.getByText("Delete"));
      expect(onDeleteClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Share button", () => {
    it("should render share button when canShare is true", () => {
      renderWithRouter(<CaseHeader {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: /share/i }),
      ).toBeInTheDocument();
    });

    it("should not render share button when canShare is false", () => {
      renderWithRouter(<CaseHeader {...defaultProps} canShare={false} />);

      expect(
        screen.queryByRole("button", { name: /share/i }),
      ).not.toBeInTheDocument();
    });

    it('should show "Shared" indicator when case is public', () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          caseData={{ ...mockCase, is_public: true }}
        />,
      );

      expect(screen.getByText("Shared")).toBeInTheDocument();
    });

    it("should call onShare when share button is clicked", () => {
      const onShare = vi.fn();
      renderWithRouter(<CaseHeader {...defaultProps} onShare={onShare} />);

      fireEvent.click(screen.getByRole("button", { name: /share/i }));
      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it("should be disabled when shareLoading is true", () => {
      renderWithRouter(<CaseHeader {...defaultProps} shareLoading={true} />);

      expect(screen.getByRole("button", { name: /share/i })).toBeDisabled();
    });
  });

  describe("ShareBar popover", () => {
    it("should show share URL when clicking Shared button", () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          caseData={{ ...mockCase, is_public: true, public_slug: "abc123" }}
        />,
      );

      // Click "Shared" to open the ShareBar popover
      fireEvent.click(
        screen.getByRole("button", { name: /toggle share options/i }),
      );
      expect(screen.getByText(/abc123/)).toBeInTheDocument();
    });

    it("should not show share URL when case is private", () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          caseData={{ ...mockCase, is_public: false }}
        />,
      );

      expect(screen.queryByText(/\/c\//)).not.toBeInTheDocument();
    });

    it("should show copy button when ShareBar is open", () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          caseData={{ ...mockCase, is_public: true, public_slug: "abc123" }}
        />,
      );

      // Click "Shared" to open the ShareBar popover
      fireEvent.click(
        screen.getByRole("button", { name: /toggle share options/i }),
      );
      expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    });

    it("should call onCopyShareLink when copy is clicked", () => {
      const onCopyShareLink = vi.fn();
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          onCopyShareLink={onCopyShareLink}
          caseData={{ ...mockCase, is_public: true, public_slug: "abc123" }}
        />,
      );

      // Click "Shared" to open the ShareBar popover
      fireEvent.click(
        screen.getByRole("button", { name: /toggle share options/i }),
      );
      fireEvent.click(screen.getByRole("button", { name: /copy/i }));
      expect(onCopyShareLink).toHaveBeenCalledTimes(1);
    });

    it('should show "Copied!" when copySuccess is true', () => {
      renderWithRouter(
        <CaseHeader
          {...defaultProps}
          copySuccess={true}
          caseData={{ ...mockCase, is_public: true, public_slug: "abc123" }}
        />,
      );

      // Click "Shared" to open the ShareBar popover
      fireEvent.click(
        screen.getByRole("button", { name: /toggle share options/i }),
      );
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });
});
