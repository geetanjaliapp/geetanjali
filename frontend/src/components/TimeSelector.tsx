import { useRef, useCallback } from "react";
import { SunriseIcon, SunMediumIcon, SunsetIcon } from "./icons";

export type SendTime = "morning" | "afternoon" | "evening";

interface TimeOption {
  id: SendTime;
  label: string;
  hint: string;
  time: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const TIME_OPTIONS: TimeOption[] = [
  {
    id: "morning",
    label: "Morning",
    hint: "With your morning tea",
    time: "6 AM",
    Icon: SunriseIcon,
  },
  {
    id: "afternoon",
    label: "Afternoon",
    hint: "A midday pause",
    time: "12:30 PM",
    Icon: SunMediumIcon,
  },
  {
    id: "evening",
    label: "Evening",
    hint: "Wind down your day",
    time: "6 PM",
    Icon: SunsetIcon,
  },
];

interface TimeSelectorProps {
  value: SendTime;
  onChange: (value: SendTime) => void;
  disabled?: boolean;
}

/**
 * Time preference selector using laid-out toggle buttons.
 * Follows the "no dropdowns, keep it fluid" design principle.
 *
 * Keyboard navigation (WAI-ARIA radiogroup pattern):
 * - Arrow keys move between options and select
 * - Only selected option is tabbable (roving tabindex)
 */
export function TimeSelector({ value, onChange, disabled }: TimeSelectorProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      if (disabled) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % TIME_OPTIONS.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          nextIndex =
            (currentIndex - 1 + TIME_OPTIONS.length) % TIME_OPTIONS.length;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        const nextOption = TIME_OPTIONS[nextIndex];
        onChange(nextOption.id);
        buttonRefs.current[nextIndex]?.focus();
      }
    },
    [disabled, onChange],
  );

  const currentIndex = TIME_OPTIONS.findIndex((o) => o.id === value);

  return (
    <div
      className="grid grid-cols-3 gap-1.5"
      role="radiogroup"
      aria-label="When would you like to receive verses?"
    >
      {TIME_OPTIONS.map((option, index) => (
        <button
          key={option.id}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          onClick={() => onChange(option.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          disabled={disabled}
          tabIndex={index === currentIndex ? 0 : -1}
          className={`
            flex flex-col items-center p-2.5 rounded-[var(--radius-button)] transition-[var(--transition-all)]
            focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2
            focus-visible:ring-offset-[var(--focus-ring-offset)]
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            ${
              value === option.id
                ? "bg-[var(--chip-selected-bg)] ring-1 ring-[var(--chip-selected-ring)]"
                : "bg-[var(--surface-muted)] hover:bg-[var(--surface-field)]"
            }
          `}
          role="radio"
          aria-checked={value === option.id}
        >
          {/* Time icon */}
          <div
            className={`
              w-8 h-8 rounded-[var(--radius-avatar)] flex items-center justify-center mb-1
              ${
                value === option.id
                  ? "bg-[var(--chip-selected-bg)] text-[var(--chip-selected-text)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-tertiary)]"
              }
            `}
          >
            <option.Icon className="w-4 h-4" />
          </div>

          {/* Label with time */}
          <div
            className={`
              text-xs font-medium text-center
              ${
                value === option.id
                  ? "text-[var(--chip-selected-text)]"
                  : "text-[var(--text-primary)]"
              }
            `}
          >
            {option.label}
            <span className="text-[var(--text-tertiary)] font-normal block text-[10px]">
              {option.time}
            </span>
          </div>

          {/* Hint - hidden on very small, shown on hover or when selected */}
          <div
            className={`
              text-[10px] text-center mt-0.5 leading-tight hidden sm:block
              ${
                value === option.id
                  ? "text-[var(--chip-selected-text)] opacity-80"
                  : "text-[var(--text-muted)]"
              }
            `}
          >
            {option.hint}
          </div>
        </button>
      ))}
    </div>
  );
}

export default TimeSelector;
