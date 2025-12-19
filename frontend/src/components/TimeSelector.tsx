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
  { id: "morning", label: "Morning", hint: "With your morning tea", time: "6 AM", Icon: SunriseIcon },
  { id: "afternoon", label: "Afternoon", hint: "A midday pause", time: "12:30 PM", Icon: SunMediumIcon },
  { id: "evening", label: "Evening", hint: "Wind down your day", time: "6 PM", Icon: SunsetIcon },
];

interface TimeSelectorProps {
  value: SendTime;
  onChange: (value: SendTime) => void;
  disabled?: boolean;
}

/**
 * Time preference selector using laid-out toggle buttons.
 * Follows the "no dropdowns, keep it fluid" design principle.
 */
export function TimeSelector({ value, onChange, disabled }: TimeSelectorProps) {
  return (
    <div
      className="flex flex-col sm:flex-row gap-2"
      role="radiogroup"
      aria-label="When would you like to receive verses?"
    >
      {TIME_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          disabled={disabled}
          className={`
            flex-1 flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2
            dark:focus-visible:ring-offset-gray-900
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            ${
              value === option.id
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-700"
            }
          `}
          role="radio"
          aria-checked={value === option.id}
        >
          {/* Time icon/indicator */}
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center shrink-0
              ${
                value === option.id
                  ? "bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-400"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }
            `}
          >
            <option.Icon className="w-4 h-4" />
          </div>

          {/* Label and hint */}
          <div className="text-left min-w-0">
            <div
              className={`
                font-medium text-sm
                ${
                  value === option.id
                    ? "text-amber-900 dark:text-amber-300"
                    : "text-gray-900 dark:text-gray-100"
                }
              `}
            >
              {option.label}{" "}
              <span className="text-gray-500 dark:text-gray-400 font-normal">
                ({option.time})
              </span>
            </div>
            <div
              className={`
                text-xs truncate
                ${
                  value === option.id
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-gray-500 dark:text-gray-400"
                }
              `}
            >
              {option.hint}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default TimeSelector;
