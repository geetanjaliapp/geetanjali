import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { SearchIcon, CloseIcon } from "./icons";

// localStorage key for recent searches
const RECENT_SEARCHES_KEY = "geetanjali:recentSearches";
const MAX_RECENT_SEARCHES = 5;

// Search type examples for educational hints
const SEARCH_EXAMPLES = [
  { query: "2.47", label: "By verse", description: "Direct verse reference" },
  { query: "कर्म", label: "Sanskrit", description: "Devanagari text" },
  { query: "duty", label: "Keyword", description: "English search" },
];

/**
 * Get recent searches from localStorage
 */
function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a search to recent searches
 */
export function saveRecentSearch(query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;

    const recent = getRecentSearches();
    const filtered = recent.filter(
      (s) => s.toLowerCase() !== trimmed.toLowerCase(),
    );
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear recent searches
 */
function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore
  }
}

export interface SearchInputProps {
  /** Current input value */
  value: string;
  /** Called when input value changes */
  onChange: (value: string) => void;
  /** Called when search is submitted (via button or Enter) */
  onSearch: (query: string) => void;
  /** Called when input is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the search is in progress */
  loading?: boolean;
  /** Show search examples in empty dropdown instead of just recent */
  showExamples?: boolean;
  /** Auto-focus on mount (desktop only) */
  autoFocus?: boolean;
  /** Custom class for container */
  className?: string;
}

export interface SearchInputHandle {
  focus: () => void;
  blur: () => void;
}

/**
 * Reusable search input with recent searches dropdown.
 * - Shows recent searches on focus when input is empty
 * - Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
 * - Integrated search button
 * - Keyboard shortcut hint (⌘K)
 */
export const SearchInput = forwardRef<SearchInputHandle, SearchInputProps>(
  function SearchInput(
    {
      value,
      onChange,
      onSearch,
      onClear,
      placeholder = "Search verses, topics, or references...",
      loading = false,
      showExamples = false,
      autoFocus = false,
      className = "",
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);

    // Recent searches state
    const [recentSearches, setRecentSearches] = useState<string[]>(() =>
      getRecentSearches(),
    );
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    // Expose focus/blur methods
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
    }));

    // Keyboard shortcut: Cmd/Ctrl+K to focus search
    useEffect(() => {
      const handleKeyDown = (e: globalThis.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          inputRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Auto-focus on desktop
    useEffect(() => {
      if (autoFocus && window.innerWidth >= 1024) {
        inputRef.current?.focus();
      }
    }, [autoFocus]);

    // Handle form submit
    const handleSubmit = useCallback(
      (e: FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) {
          inputRef.current?.focus();
          return;
        }
        setShowDropdown(false);
        onSearch(trimmed);
      },
      [value, onSearch],
    );

    // Handle selecting from dropdown
    const handleSelect = useCallback(
      (query: string) => {
        onChange(query);
        setShowDropdown(false);
        setSelectedIndex(-1);
        onSearch(query);
      },
      [onChange, onSearch],
    );

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLInputElement>) => {
        const items = value ? [] : showExamples && recentSearches.length === 0
          ? SEARCH_EXAMPLES.map((ex) => ex.query)
          : recentSearches;

        if (!showDropdown || items.length === 0) return;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev < items.length - 1 ? prev + 1 : 0,
            );
            break;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) =>
              prev > 0 ? prev - 1 : items.length - 1,
            );
            break;
          case "Enter":
            if (selectedIndex >= 0 && selectedIndex < items.length) {
              e.preventDefault();
              handleSelect(items[selectedIndex]);
            }
            break;
          case "Escape":
            setShowDropdown(false);
            setSelectedIndex(-1);
            break;
        }
      },
      [showDropdown, value, showExamples, recentSearches, selectedIndex, handleSelect],
    );

    // Handle clearing
    const handleClear = useCallback(() => {
      onChange("");
      onClear?.();
      inputRef.current?.focus();
    }, [onChange, onClear]);

    // Handle clearing recent searches
    const handleClearRecent = useCallback(() => {
      clearRecentSearches();
      setRecentSearches([]);
    }, []);

    // Refresh recent searches when they might have changed
    const refreshRecent = useCallback(() => {
      setRecentSearches(getRecentSearches());
    }, []);

    // Determine what to show in dropdown
    const showRecentDropdown = showDropdown && !value && recentSearches.length > 0;
    const showExamplesDropdown = showDropdown && !value && showExamples && recentSearches.length === 0;

    return (
      <form onSubmit={handleSubmit} className={className}>
        <div className="relative flex items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setSelectedIndex(-1);
              }}
              onFocus={() => {
                refreshRecent();
                setShowDropdown(true);
                setSelectedIndex(-1);
              }}
              onBlur={() =>
                setTimeout(() => {
                  setShowDropdown(false);
                  setSelectedIndex(-1);
                }, 200)
              }
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full pl-10 pr-10 py-3 sm:py-3.5 border border-amber-200 dark:border-gray-600 rounded-l-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:z-10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm transition-shadow"
              aria-label="Search query"
              aria-expanded={showRecentDropdown || showExamplesDropdown}
              aria-haspopup="listbox"
              aria-activedescendant={
                selectedIndex >= 0 ? `search-item-${selectedIndex}` : undefined
              }
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500 dark:text-amber-400" />

            {/* Clear button or keyboard hint */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {value ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Clear search"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] text-amber-600/70 dark:text-amber-400/70 bg-amber-50 dark:bg-amber-900/30 rounded border border-amber-200/50 dark:border-amber-700/50">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Recent Searches Dropdown */}
            {showRecentDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-600 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-amber-100 dark:border-gray-700 bg-amber-50/50 dark:bg-gray-700/50">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Recent
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                <ul role="listbox">
                  {recentSearches.map((query, index) => (
                    <li
                      key={index}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <button
                        id={`search-item-${index}`}
                        type="button"
                        onClick={() => handleSelect(query)}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                          index === selectedIndex
                            ? "bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200"
                            : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <SearchIcon
                          className={`w-4 h-4 ${index === selectedIndex ? "text-orange-500 dark:text-orange-400" : "text-amber-400 dark:text-amber-500"}`}
                        />
                        {query}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-1.5 border-t border-amber-100 dark:border-gray-700 bg-amber-50/30 dark:bg-gray-700/30">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    ↑↓ to navigate · Enter to select
                  </span>
                </div>
              </div>
            )}

            {/* Search Examples Dropdown (when no recent searches) */}
            {showExamplesDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-amber-200 dark:border-gray-600 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-2 border-b border-amber-100 dark:border-gray-700 bg-amber-50/50 dark:bg-gray-700/50">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Try searching for
                  </span>
                </div>
                <ul role="listbox">
                  {SEARCH_EXAMPLES.map((example, index) => (
                    <li
                      key={example.query}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <button
                        id={`search-item-${index}`}
                        type="button"
                        onClick={() => handleSelect(example.query)}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 transition-colors ${
                          index === selectedIndex
                            ? "bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200"
                            : "text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span className="font-medium">{example.query}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {example.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-1.5 border-t border-amber-100 dark:border-gray-700 bg-amber-50/30 dark:bg-gray-700/30">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    ↑↓ to navigate · Enter to select
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Search Button - inline with input */}
          <button
            type="submit"
            disabled={loading}
            className="px-4 sm:px-6 py-3 sm:py-3.5 bg-orange-600 text-white font-medium rounded-r-full hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm hover:shadow-md border border-orange-600 hover:border-orange-700 -ml-px"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <SearchIcon className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </form>
    );
  },
);

export default SearchInput;
