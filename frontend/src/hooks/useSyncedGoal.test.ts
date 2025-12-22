/**
 * Tests for useSyncedGoal hook
 *
 * Critical paths:
 * - Anonymous users: Works via LearningGoalContext (localStorage)
 * - Multi-goal selection works correctly
 * - Goal toggle, set, and clear operations
 * - Sync status exposed correctly
 *
 * TESTING NOTES:
 * See useSyncedFavorites.test.ts for notes on module-level throttle state
 * and sync behavior testing limitations.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Create mock functions
const mockToggleGoal = vi.fn();
const mockSetGoals = vi.fn();
const mockClearGoals = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockIsSelected = vi.fn((_id: string) => false);

// Mock modules before importing the hook
vi.mock("../contexts/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    user: null,
  })),
}));

vi.mock("../contexts/LearningGoalContext", () => ({
  useLearningGoalContext: vi.fn(() => ({
    selectedGoalIds: [],
    selectedGoals: [],
    goalPrinciples: [],
    goals: [
      { id: "leadership", label: "Leadership", description: "Lead effectively" },
      { id: "ethics", label: "Ethics", description: "Make ethical decisions" },
    ],
    toggleGoal: mockToggleGoal,
    setGoals: mockSetGoals,
    clearGoals: mockClearGoals,
    isSelected: mockIsSelected,
    initialized: true,
  })),
}));

vi.mock("../lib/api", () => ({
  preferencesApi: {
    merge: vi.fn(),
    update: vi.fn(),
  },
}));

import { useSyncedGoal } from "./useSyncedGoal";
import { useAuth } from "../contexts/AuthContext";
import { useLearningGoalContext } from "../contexts/LearningGoalContext";
import { preferencesApi } from "../lib/api";

describe("useSyncedGoal", () => {
  const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;
  const mockUseLearningGoalContext = useLearningGoalContext as unknown as ReturnType<typeof vi.fn>;
  const mockPreferencesApi = preferencesApi as unknown as {
    merge: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Reset mock implementations
    mockToggleGoal.mockClear();
    mockSetGoals.mockClear();
    mockClearGoals.mockClear();
    mockIsSelected.mockImplementation(() => false);

    // Default to anonymous user
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    // Default context state
    mockUseLearningGoalContext.mockReturnValue({
      selectedGoalIds: [],
      selectedGoals: [],
      goalPrinciples: [],
      goals: [
        { id: "leadership", label: "Leadership", description: "Lead effectively" },
        { id: "ethics", label: "Ethics", description: "Make ethical decisions" },
      ],
      toggleGoal: mockToggleGoal,
      setGoals: mockSetGoals,
      clearGoals: mockClearGoals,
      isSelected: mockIsSelected,
      initialized: true,
    });

    mockPreferencesApi.merge.mockResolvedValue({
      learning_goals: { goal_ids: [], updated_at: new Date().toISOString() },
    });
    mockPreferencesApi.update.mockResolvedValue({});
  });

  // ===========================================================================
  // Interface Tests
  // ===========================================================================

  describe("interface", () => {
    it("should expose all required properties and methods", () => {
      const { result } = renderHook(() => useSyncedGoal());

      // Selection state
      expect(Array.isArray(result.current.selectedGoalIds)).toBe(true);
      expect(Array.isArray(result.current.selectedGoals)).toBe(true);
      expect(Array.isArray(result.current.goalPrinciples)).toBe(true);
      expect(Array.isArray(result.current.goals)).toBe(true);
      expect(typeof result.current.initialized).toBe("boolean");

      // Sync state
      expect(typeof result.current.syncStatus).toBe("string");

      // Methods
      expect(typeof result.current.toggleGoal).toBe("function");
      expect(typeof result.current.setGoals).toBe("function");
      expect(typeof result.current.clearGoals).toBe("function");
      expect(typeof result.current.isSelected).toBe("function");
      expect(typeof result.current.resync).toBe("function");
    });

    it("should have valid syncStatus values", () => {
      const { result } = renderHook(() => useSyncedGoal());

      const validStatuses = ["idle", "syncing", "synced", "error"];
      expect(validStatuses).toContain(result.current.syncStatus);
    });
  });

  // ===========================================================================
  // Goal Data
  // ===========================================================================

  describe("goal data", () => {
    it("should expose available goals from context", () => {
      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.goals.length).toBe(2);
      expect(result.current.goals[0].id).toBe("leadership");
      expect(result.current.goals[1].id).toBe("ethics");
    });

    it("should pass through selectedGoalIds from context", () => {
      mockUseLearningGoalContext.mockReturnValue({
        selectedGoalIds: ["leadership", "ethics"],
        selectedGoals: [{ id: "leadership" }, { id: "ethics" }],
        goalPrinciples: [],
        goals: [],
        toggleGoal: mockToggleGoal,
        setGoals: mockSetGoals,
        clearGoals: mockClearGoals,
        isSelected: mockIsSelected,
        initialized: true,
      });

      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.selectedGoalIds).toEqual(["leadership", "ethics"]);
    });

    it("should expose initialized state from context", () => {
      mockUseLearningGoalContext.mockReturnValue({
        selectedGoalIds: [],
        selectedGoals: [],
        goalPrinciples: [],
        goals: [],
        toggleGoal: mockToggleGoal,
        setGoals: mockSetGoals,
        clearGoals: mockClearGoals,
        isSelected: mockIsSelected,
        initialized: false,
      });

      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.initialized).toBe(false);
    });
  });

  // ===========================================================================
  // toggleGoal
  // ===========================================================================

  describe("toggleGoal", () => {
    it("should call context toggleGoal", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.toggleGoal("leadership");
      });

      expect(mockToggleGoal).toHaveBeenCalledWith("leadership");
    });

    it("should not call API for anonymous users", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.toggleGoal("leadership");
      });

      expect(mockPreferencesApi.update).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // setGoals
  // ===========================================================================

  describe("setGoals", () => {
    it("should call context setGoals with goal IDs", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.setGoals(["leadership", "ethics"]);
      });

      expect(mockSetGoals).toHaveBeenCalledWith(["leadership", "ethics"]);
    });

    it("should handle empty array", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.setGoals([]);
      });

      expect(mockSetGoals).toHaveBeenCalledWith([]);
    });
  });

  // ===========================================================================
  // clearGoals
  // ===========================================================================

  describe("clearGoals", () => {
    it("should call context clearGoals", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.clearGoals();
      });

      expect(mockClearGoals).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // isSelected
  // ===========================================================================

  describe("isSelected", () => {
    it("should delegate to context isSelected", () => {
      mockIsSelected.mockImplementation((id) => id === "leadership");

      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.isSelected("leadership")).toBe(true);
      expect(result.current.isSelected("ethics")).toBe(false);
    });
  });

  // ===========================================================================
  // Sync Status
  // ===========================================================================

  describe("sync status", () => {
    it("should be idle for anonymous users", () => {
      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.syncStatus).toBe("idle");
      expect(result.current.lastSynced).toBeNull();
    });
  });

  // ===========================================================================
  // Authenticated User Basics
  // ===========================================================================

  describe("authenticated user basics", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: "user-123", email: "test@example.com" },
      });
    });

    it("should still call context methods for local updates", () => {
      const { result } = renderHook(() => useSyncedGoal());

      act(() => {
        result.current.toggleGoal("leadership");
      });

      expect(mockToggleGoal).toHaveBeenCalledWith("leadership");
    });
  });

  // ===========================================================================
  // Resync
  // ===========================================================================

  describe("resync", () => {
    it("should be a callable function", () => {
      const { result } = renderHook(() => useSyncedGoal());

      expect(typeof result.current.resync).toBe("function");
    });

    it("should return a promise", () => {
      const { result } = renderHook(() => useSyncedGoal());

      const resyncResult = result.current.resync();
      expect(resyncResult).toBeInstanceOf(Promise);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle uninitialized context", () => {
      mockUseLearningGoalContext.mockReturnValue({
        selectedGoalIds: [],
        selectedGoals: [],
        goalPrinciples: [],
        goals: [],
        toggleGoal: mockToggleGoal,
        setGoals: mockSetGoals,
        clearGoals: mockClearGoals,
        isSelected: mockIsSelected,
        initialized: false,
      });

      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.initialized).toBe(false);
      expect(result.current.goals).toEqual([]);
    });

    it("should handle empty goals list", () => {
      mockUseLearningGoalContext.mockReturnValue({
        selectedGoalIds: [],
        selectedGoals: [],
        goalPrinciples: [],
        goals: [],
        toggleGoal: mockToggleGoal,
        setGoals: mockSetGoals,
        clearGoals: mockClearGoals,
        isSelected: mockIsSelected,
        initialized: true,
      });

      const { result } = renderHook(() => useSyncedGoal());

      expect(result.current.goals.length).toBe(0);
    });
  });
});

/**
 * DOCUMENTED EXCEPTION: Sync Behavior Testing
 *
 * See useSyncedFavorites.test.ts for explanation of sync testing limitations.
 */
