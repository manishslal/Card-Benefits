'use client';

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Clock,
  BarChart3,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

/** Supported sort keys — consumers should handle these in their sort logic. */
export type SortKey = 'default' | 'name' | 'value' | 'expiry' | 'usage';

export interface SearchSortBarProps {
  /** Current search query (controlled). */
  searchQuery: string;
  /** Called with the debounced search value. */
  onSearch: (query: string) => void;
  /** Currently active sort key (controlled). */
  activeSort: SortKey;
  /** Called when a sort option is selected. */
  onSort: (sortKey: SortKey) => void;
}

interface SortOption {
  key: SortKey;
  label: string;
  icon: React.ReactNode;
}

// ============================================================
// Constants
// ============================================================

const SORT_OPTIONS: SortOption[] = [
  {
    key: 'default',
    label: 'Default',
    icon: <BarChart3 size={14} aria-hidden="true" />,
  },
  {
    key: 'name',
    label: 'Name (A\u2013Z)',
    icon: <ArrowDownAZ size={14} aria-hidden="true" />,
  },
  {
    key: 'value',
    label: 'Value (High\u2192Low)',
    icon: <ArrowDownWideNarrow size={14} aria-hidden="true" />,
  },
  {
    key: 'expiry',
    label: 'Expiry (Soonest)',
    icon: <Clock size={14} aria-hidden="true" />,
  },
  {
    key: 'usage',
    label: 'Usage (Most Used)',
    icon: <BarChart3 size={14} aria-hidden="true" />,
  },
];

const DEBOUNCE_MS = 300;

// ============================================================
// Hook: click-outside detection
// ============================================================

function useClickOutside<T extends HTMLElement>(
  handler: () => void,
  active: boolean,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener, { passive: true });

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler, active]);

  return ref;
}

// ============================================================
// Sub-component: SearchInput
// ============================================================

const SearchInput = memo(function SearchInput({
  searchQuery,
  onSearch,
}: {
  searchQuery: string;
  onSearch: (query: string) => void;
}) {
  const [localValue, setLocalValue] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value when controlled value changes externally
  useEffect(() => {
    setLocalValue(searchQuery);
    // Cancel any pending debounce when parent resets the query
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [searchQuery]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, DEBOUNCE_MS);
    },
    [onSearch],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleClear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setLocalValue('');
    onSearch('');
    inputRef.current?.focus();
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape' && localValue) {
        e.preventDefault();
        handleClear();
      }
    },
    [localValue, handleClear],
  );

  return (
    <div className="relative flex-1 min-w-[180px] max-w-[320px]">
      {/* Search icon */}
      <span
        className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-hidden="true"
      >
        <Search size={15} />
      </span>

      <input
        ref={inputRef}
        type="search"
        data-search-input
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search benefits\u2026"
        aria-label="Search benefits by name"
        autoComplete="off"
        spellCheck={false}
        className="w-full pl-8 pr-8 py-2 text-sm rounded-[var(--radius-md)] border transition-colors"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
          transitionDuration: 'var(--duration-base)',
          fontFamily: 'var(--font-primary)',
        }}
      />

      {/* Clear button — only visible when there is text */}
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
            transitionDuration: 'var(--duration-base)',
          }}
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

// ============================================================
// Sub-component: SortDropdown
// ============================================================

const SortDropdown = memo(function SortDropdown({
  activeSort,
  onSort,
}: {
  activeSort: SortKey;
  onSort: (sortKey: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => setOpen(false), []);
  const containerRef = useClickOutside<HTMLDivElement>(handleClose, open);

  const activeLabel =
    SORT_OPTIONS.find((o) => o.key === activeSort)?.label ?? 'Sort';

  const handleSelect = useCallback(
    (key: SortKey) => {
      onSort(key);
      setOpen(false);
      buttonRef.current?.focus();
    },
    [onSort],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(
            Math.max(
              0,
              SORT_OPTIONS.findIndex((o) => o.key === activeSort),
            ),
          );
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
          break;
        case 'Tab':
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < SORT_OPTIONS.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : SORT_OPTIONS.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < SORT_OPTIONS.length) {
            handleSelect(SORT_OPTIONS[focusedIndex].key);
          }
          break;
      }
    },
    [open, focusedIndex, activeSort, handleSelect],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort by: ${activeLabel}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] border transition-colors"
        style={{
          backgroundColor:
            activeSort !== 'default'
              ? 'var(--color-primary-light)'
              : 'var(--color-bg)',
          borderColor: open
            ? 'var(--color-primary)'
            : activeSort !== 'default'
              ? 'var(--color-primary)'
              : 'var(--color-border)',
          color:
            activeSort !== 'default'
              ? 'var(--color-primary)'
              : 'var(--color-text)',
          transitionDuration: 'var(--duration-base)',
        }}
      >
        <ArrowDownAZ size={14} aria-hidden="true" />
        <span className="hidden sm:inline">{activeLabel}</span>
        <span className="sm:hidden">Sort</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="transition-transform"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: 'var(--duration-fast)',
          }}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Sort benefits by"
          className="absolute right-0 top-full mt-1 min-w-[200px] rounded-[var(--radius-md)] border py-1 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 'var(--z-dropdown)',
          } as React.CSSProperties}
        >
          {SORT_OPTIONS.map((option, idx) => {
            const isSelected = option.key === activeSort;
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={option.key}
                id={`sort-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => handleSelect(option.key)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className="px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: isFocused
                    ? 'var(--color-bg-secondary)'
                    : isSelected
                      ? 'var(--color-primary-light)'
                      : 'transparent',
                  color: isSelected
                    ? 'var(--color-primary)'
                    : 'var(--color-text)',
                  fontWeight: isSelected ? 600 : 400,
                  transitionDuration: 'var(--duration-fast)',
                }}
              >
                <span
                  className="flex-shrink-0 flex items-center"
                  aria-hidden="true"
                >
                  {option.icon}
                </span>
                {option.label}
                {isSelected && (
                  <span
                    className="ml-auto flex-shrink-0"
                    style={{ color: 'var(--color-primary)' }}
                    aria-hidden="true"
                  >
                    <svg
                      width="12"
                      height="10"
                      viewBox="0 0 12 10"
                      fill="none"
                    >
                      <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

SortDropdown.displayName = 'SortDropdown';

// ============================================================
// Main component: SearchSortBar
// ============================================================

/**
 * SearchSortBar provides a search input and sort dropdown for benefit lists.
 *
 * Fully controlled: searchQuery and activeSort come from the parent.
 * Search is debounced internally (300 ms) before calling onSearch.
 */
const SearchSortBar = memo(function SearchSortBar({
  searchQuery,
  onSearch,
  activeSort,
  onSort,
}: SearchSortBarProps) {
  return (
    <div
      role="search"
      aria-label="Search and sort benefits"
      className="flex flex-wrap items-center gap-2"
    >
      <SearchInput searchQuery={searchQuery} onSearch={onSearch} />
      <SortDropdown activeSort={activeSort} onSort={onSort} />
    </div>
  );
});

SearchSortBar.displayName = 'SearchSortBar';

export { SearchSortBar };
