import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test/utils";
import { OfflineIndicator } from "./OfflineIndicator";

// Mock the hooks
vi.mock("../hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}));

vi.mock("../hooks", () => ({
  useSyncStatus: vi.fn(),
}));

import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSyncStatus } from "../hooks";

const mockUseOnlineStatus = vi.mocked(useOnlineStatus);
const mockUseSyncStatus = vi.mocked(useSyncStatus);

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: online, no pending
    mockUseOnlineStatus.mockReturnValue(true);
    mockUseSyncStatus.mockReturnValue({
      status: "idle",
      lastSynced: null,
      pendingCount: 0,
      error: null,
      resync: vi.fn(),
    });
  });

  it("renders nothing when online", () => {
    mockUseOnlineStatus.mockReturnValue(true);

    const { container } = render(<OfflineIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it("renders offline banner when offline", () => {
    mockUseOnlineStatus.mockReturnValue(false);

    render(<OfflineIndicator />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows pending count when offline with pending items", () => {
    mockUseOnlineStatus.mockReturnValue(false);
    mockUseSyncStatus.mockReturnValue({
      status: "idle",
      lastSynced: null,
      pendingCount: 3,
      error: null,
      resync: vi.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.getByText(/3 unsaved changes/)).toBeInTheDocument();
  });

  it("uses singular form for single pending item", () => {
    mockUseOnlineStatus.mockReturnValue(false);
    mockUseSyncStatus.mockReturnValue({
      status: "idle",
      lastSynced: null,
      pendingCount: 1,
      error: null,
      resync: vi.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.getByText(/1 unsaved change\)/)).toBeInTheDocument();
  });

  it("hides count when no pending items", () => {
    mockUseOnlineStatus.mockReturnValue(false);
    mockUseSyncStatus.mockReturnValue({
      status: "idle",
      lastSynced: null,
      pendingCount: 0,
      error: null,
      resync: vi.fn(),
    });

    render(<OfflineIndicator />);

    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
    expect(screen.queryByText(/unsaved/)).not.toBeInTheDocument();
  });

  it("has correct accessibility attributes", () => {
    mockUseOnlineStatus.mockReturnValue(false);

    render(<OfflineIndicator />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
