/**
 * Tests for useSwipeNavigation hook
 *
 * Tests the core swipe detection logic used in Reading Mode.
 * Uses a test component wrapper for proper ref handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSwipeNavigation } from "./useSwipeNavigation";

// Helper to create proper touch events that jsdom accepts
function createTouchEvent(
  type: "touchstart" | "touchmove" | "touchend",
  clientX: number,
  clientY: number
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });

  const touch = {
    clientX,
    clientY,
    identifier: 0,
    target: document.body,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
  };

  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [touch],
    writable: false,
  });
  Object.defineProperty(event, "changedTouches", {
    value: [touch],
    writable: false,
  });
  Object.defineProperty(event, "targetTouches", {
    value: type === "touchend" ? [] : [touch],
    writable: false,
  });

  return event;
}

// Test component that uses the hook
interface TestComponentProps {
  onNext?: () => void;
  onPrev?: () => void;
  threshold?: number;
  minVelocity?: number;
  enabled?: boolean;
}

function TestComponent({
  onNext,
  onPrev,
  threshold = 50,
  minVelocity = 0.3,
  enabled = true,
}: TestComponentProps) {
  const swipeRef = useSwipeNavigation<HTMLDivElement>({
    onNext,
    onPrev,
    threshold,
    minVelocity,
    enabled,
  });

  return (
    <div ref={swipeRef} data-testid="swipe-area">
      Swipeable Area
    </div>
  );
}

describe("useSwipeNavigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the swipeable element", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("swipe-area")).toBeInTheDocument();
  });

  it("should call onNext when swiping left with sufficient distance and velocity", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();

    render(<TestComponent onNext={onNext} onPrev={onPrev} />);
    const element = screen.getByTestId("swipe-area");

    // Simulate swipe left: start at x=200, end at x=50 (150px left)
    element.dispatchEvent(createTouchEvent("touchstart", 200, 100));
    vi.advanceTimersByTime(100); // Fast swipe: 150px in 100ms = 1.5 px/ms
    element.dispatchEvent(createTouchEvent("touchend", 50, 100));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should call onPrev when swiping right with sufficient distance and velocity", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();

    render(<TestComponent onNext={onNext} onPrev={onPrev} />);
    const element = screen.getByTestId("swipe-area");

    // Simulate swipe right: start at x=50, end at x=200 (150px right)
    element.dispatchEvent(createTouchEvent("touchstart", 50, 100));
    vi.advanceTimersByTime(100);
    element.dispatchEvent(createTouchEvent("touchend", 200, 100));

    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("should not trigger callback when swipe distance is below threshold", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();

    render(<TestComponent onNext={onNext} onPrev={onPrev} threshold={50} />);
    const element = screen.getByTestId("swipe-area");

    // Simulate small swipe: only 30px (below 50px threshold)
    element.dispatchEvent(createTouchEvent("touchstart", 100, 100));
    vi.advanceTimersByTime(50);
    element.dispatchEvent(createTouchEvent("touchend", 70, 100));

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should not trigger callback when swipe velocity is too slow", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();

    render(<TestComponent onNext={onNext} onPrev={onPrev} minVelocity={0.3} />);
    const element = screen.getByTestId("swipe-area");

    // Simulate slow swipe: 60px over 500ms = 0.12 px/ms (below 0.3 threshold)
    element.dispatchEvent(createTouchEvent("touchstart", 160, 100));
    vi.advanceTimersByTime(500);
    element.dispatchEvent(createTouchEvent("touchend", 100, 100));

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should not trigger callback when disabled", () => {
    const onNext = vi.fn();

    render(<TestComponent onNext={onNext} enabled={false} />);
    const element = screen.getByTestId("swipe-area");

    element.dispatchEvent(createTouchEvent("touchstart", 200, 100));
    vi.advanceTimersByTime(100);
    element.dispatchEvent(createTouchEvent("touchend", 50, 100));

    expect(onNext).not.toHaveBeenCalled();
  });

  it("should ignore swipe when vertical movement exceeds horizontal", () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();

    render(<TestComponent onNext={onNext} onPrev={onPrev} />);
    const element = screen.getByTestId("swipe-area");

    // Simulate diagonal swipe: 20px horizontal, 100px vertical
    element.dispatchEvent(createTouchEvent("touchstart", 100, 100));
    element.dispatchEvent(createTouchEvent("touchmove", 80, 200));
    vi.advanceTimersByTime(100);
    element.dispatchEvent(createTouchEvent("touchend", 80, 200));

    // Should not trigger because vertical > horizontal
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("should handle multiple consecutive swipes", () => {
    const onNext = vi.fn();

    render(<TestComponent onNext={onNext} />);
    const element = screen.getByTestId("swipe-area");

    // First swipe
    element.dispatchEvent(createTouchEvent("touchstart", 200, 100));
    vi.advanceTimersByTime(100);
    element.dispatchEvent(createTouchEvent("touchend", 50, 100));

    // Second swipe
    element.dispatchEvent(createTouchEvent("touchstart", 200, 100));
    vi.advanceTimersByTime(100);
    element.dispatchEvent(createTouchEvent("touchend", 50, 100));

    expect(onNext).toHaveBeenCalledTimes(2);
  });
});
