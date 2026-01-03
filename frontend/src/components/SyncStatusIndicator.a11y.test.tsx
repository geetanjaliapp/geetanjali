import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "../test/utils";
import { axe } from "vitest-axe";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

// Mock the sync status hook
vi.mock("../hooks", () => ({
  useSyncStatus: vi.fn(),
}));

import { useSyncStatus } from "../hooks";

const mockUseSyncStatus = vi.mocked(useSyncStatus);

describe("SyncStatusIndicator accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSyncStatus.mockReturnValue({
      status: "idle",
      lastSynced: null,
      pendingCount: 0,
      error: null,
      resync: vi.fn(),
    });
  });

  it("should have no violations in idle state (renders nothing)", async () => {
    const { container } = render(<SyncStatusIndicator />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have no violations in error state", async () => {
    mockUseSyncStatus.mockReturnValue({
      status: "error",
      lastSynced: null,
      pendingCount: 0,
      error: new Error("Sync failed"),
      resync: vi.fn(),
    });

    const { container } = render(<SyncStatusIndicator />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have proper status role for non-interactive states", async () => {
    mockUseSyncStatus.mockReturnValue({
      status: "offline",
      lastSynced: null,
      pendingCount: 0,
      error: null,
      resync: vi.fn(),
    });

    render(<SyncStatusIndicator />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Offline");
  });

  it("error state should be keyboard accessible", () => {
    mockUseSyncStatus.mockReturnValue({
      status: "error",
      lastSynced: null,
      pendingCount: 0,
      error: new Error("Sync failed"),
      resync: vi.fn(),
    });

    render(<SyncStatusIndicator />);

    // Error state renders as button for retry
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label");
  });
});
