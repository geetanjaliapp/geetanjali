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
import { SearchIcon, CloseIcon, SpinnerIcon } from "./icons";

// localStorage key for recent searches
const RECENT_SEARCHES_KEY = "geetanjali:recentSearches";
const MAX_RECENT_SEARCHES = 5;

// Search type examples for educational hints
const SEARCH_EXAMPLES = [
  { query: "2.47", label: "By verse" },
  { query: "कर्म", label: "Sanskrit" },
  { query: "duty", label: "Keyword" },
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
// eslint-disable-next-line react-refresh/only-export-components
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
        const items = value
          ? []
          : showExamples && recentSearches.length === 0
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
      [
        showDropdown,
        value,
        showExamples,
        recentSearches,
        selectedIndex,
        handleSelect,
      ],
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
    const showRecentDropdown =
      showDropdown && !value && recentSearches.length > 0;
    const showExamplesDropdown =
      showDropdown && !value && showExamples && recentSearches.length === 0;

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
              className="w-full pl-10 pr-10 py-3 sm:py-3.5 border border-[var(--border-warm)] rounded-l-[var(--radius-chip)] bg-[var(--surface-elevated)]/80 backdrop-blur-xs focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--focus-ring)] focus:z-10 text-[var(--input-text)] placeholder:text-[var(--input-text-placeholder)] shadow-[var(--shadow-button)] transition-[var(--transition-all)]"
              aria-label="Search query"
              aria-expanded={showRecentDropdown || showExamplesDropdown}
              aria-haspopup="listbox"
              aria-activedescendant={
                selectedIndex >= 0 ? `search-item-${selectedIndex}` : undefined
              }
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-accent)]" />

            {/* Clear button or keyboard hint */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {value ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-3 sm:p-1 -m-2 sm:m-0 rounded-[var(--radius-avatar)] hover:bg-[var(--interactive-secondary-hover-bg)] transition-[var(--transition-color)]"
                  aria-label="Clear search"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              ) : (
                <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] text-[var(--text-accent-muted)] bg-[var(--surface-warm)] rounded-[var(--radius-skeleton)] border border-[var(--border-warm-subtle)]">
                  ⌘K
                </kbd>
              )}
            </div>

            {/* Recent Searches Dropdown */}
            {showRecentDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] z-20 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/50">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">
                    Recent
                  </span>
                  <button
                    type="button"
                    onClick={handleClearRecent}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
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
                            ? "bg-[var(--menu-item-selected-bg)] text-[var(--menu-item-selected-text)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)]"
                        }`}
                      >
                        <SearchIcon
                          className={`w-4 h-4 ${index === selectedIndex ? "text-[var(--interactive-primary)]" : "text-[var(--text-accent)]"}`}
                        />
                        {query}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/30">
                  <span className="text-[10px] text-[var(--text-muted)]">
                    ↑↓ to navigate · Enter to select
                  </span>
                </div>
              </div>
            )}

            {/* Search Examples Dropdown (when no recent searches) */}
            {showExamplesDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-[var(--radius-card)] shadow-[var(--shadow-dropdown)] z-20 overflow-hidden">
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/50">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">
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
                            ? "bg-[var(--menu-item-selected-bg)] text-[var(--menu-item-selected-text)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--menu-item-hover-bg)]"
                        }`}
                      >
                        <span className="font-medium">{example.query}</span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {example.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-1.5 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/30">
                  <span className="text-[10px] text-[var(--text-muted)]">
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
            className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[var(--interactive-primary)] text-[var(--interactive-primary-text)] font-medium rounded-r-[var(--radius-chip)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-[var(--transition-all)] flex items-center gap-2 shadow-[var(--shadow-button)] hover:shadow-[var(--shadow-card)] border border-[var(--interactive-primary)] hover:border-[var(--interactive-primary)] -ml-px"
          >
            {loading ? (
              <SpinnerIcon className="w-5 h-5" />
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
