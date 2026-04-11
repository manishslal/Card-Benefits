'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface PeriodItem {
  id: string;
  label: string;
  displayLabel?: string;
  icon?: ReactNode;
  /** Accept extra fields from PeriodOption (getDateRange, etc.) */
  getDateRange?: () => { start: Date; end: Date };
}

interface StatusItem {
  id: string;
  label: string;
  color: string;
  icon?: ReactNode;
  description?: string;
}

export interface UnifiedFilterBarProps {
  /** Currently selected period id */
  selectedPeriodId: string;
  onPeriodChange: (id: string) => void;
  periods: PeriodItem[];
  /** Currently selected status ids */
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  availableStatuses: StatusItem[];
  /** Current vs history toggle */
  viewMode: 'current' | 'history';
  onViewModeChange: (mode: 'current' | 'history') => void;
  benefitEngineEnabled: boolean;
  /** Counts for the "Showing X of Y" label */
  filteredCount: number;
  totalCount: number;
}

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
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [handler, active]);

  return ref;
}

// ============================================================
// Sub-component: PeriodDropdown (single-select listbox)
// ============================================================

function PeriodDropdown({
  selectedPeriodId,
  onPeriodChange,
  periods,
}: {
  selectedPeriodId: string;
  onPeriodChange: (id: string) => void;
  periods: PeriodItem[];
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleClose = useCallback(() => setOpen(false), []);
  const containerRef = useClickOutside<HTMLDivElement>(handleClose, open);

  const selectedLabel =
    periods.find((p) => p.id === selectedPeriodId)?.label ?? 'Period';

  const handleSelect = useCallback(
    (id: string) => {
      onPeriodChange(id);
      setOpen(false);
    },
    [onPeriodChange],
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
              periods.findIndex((p) => p.id === selectedPeriodId),
            ),
          );
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < periods.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : periods.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < periods.length) {
            handleSelect(periods[focusedIndex].id);
          }
          break;
      }
    },
    [open, focusedIndex, periods, selectedPeriodId, handleSelect],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && focusedIndex >= 0 ? `period-option-${focusedIndex}` : undefined}
        aria-label={`Period filter: ${selectedLabel}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] border transition-colors"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: open ? 'var(--color-primary)' : 'var(--color-border)',
          color: 'var(--color-text)',
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        {selectedLabel}
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
          aria-label="Select time period"
          className="absolute left-0 top-full mt-1 min-w-[180px] rounded-[var(--radius-md)] border py-1 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 'var(--z-dropdown)' as unknown as number,
          }}
        >
          {periods.map((period, idx) => {
            const isSelected = period.id === selectedPeriodId;
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={period.id}
                id={`period-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => handleSelect(period.id)}
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
                {period.icon && (
                  <span aria-hidden="true" className="flex-shrink-0">
                    {period.icon}
                  </span>
                )}
                {period.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Sub-component: StatusDropdown (multi-select with checkboxes)
// ============================================================

function StatusDropdown({
  selectedStatuses,
  onStatusChange,
  availableStatuses,
}: {
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  availableStatuses: StatusItem[];
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleClose = useCallback(() => setOpen(false), []);
  const containerRef = useClickOutside<HTMLDivElement>(handleClose, open);

  const handleToggle = useCallback(
    (id: string) => {
      if (selectedStatuses.includes(id)) {
        onStatusChange(selectedStatuses.filter((s) => s !== id));
      } else {
        onStatusChange([...selectedStatuses, id]);
      }
    },
    [selectedStatuses, onStatusChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          setFocusedIndex(0);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < availableStatuses.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : availableStatuses.length - 1,
          );
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (
            focusedIndex >= 0 &&
            focusedIndex < availableStatuses.length
          ) {
            handleToggle(availableStatuses[focusedIndex].id);
          }
          break;
      }
    },
    [open, focusedIndex, availableStatuses, handleToggle],
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-activedescendant={open && focusedIndex >= 0 ? `status-option-${focusedIndex}` : undefined}
        aria-label={`Status filter: ${selectedStatuses.length} of ${availableStatuses.length} selected`}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[var(--radius-md)] border transition-colors"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: open ? 'var(--color-primary)' : 'var(--color-border)',
          color: 'var(--color-text)',
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        Status
        {selectedStatuses.length > 0 &&
          selectedStatuses.length < availableStatuses.length && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-xs font-semibold"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-inverse, #fff)',
                fontSize: '11px',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              {selectedStatuses.length}
            </span>
          )}
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
          aria-label="Select status filters"
          aria-multiselectable="true"
          className="absolute left-0 top-full mt-1 min-w-[200px] rounded-[var(--radius-md)] border py-1 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 'var(--z-dropdown)' as unknown as number,
          }}
        >
          {availableStatuses.map((status, idx) => {
            const isSelected = selectedStatuses.includes(status.id);
            const isFocused = idx === focusedIndex;
            return (
              <li
                key={status.id}
                id={`status-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => handleToggle(status.id)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className="px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: isFocused
                    ? 'var(--color-bg-secondary)'
                    : 'transparent',
                  color: 'var(--color-text)',
                  transitionDuration: 'var(--duration-fast)',
                }}
              >
                {/* Checkbox indicator */}
                <span
                  className="flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 transition-colors"
                  style={{
                    borderColor: isSelected
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                    backgroundColor: isSelected
                      ? 'var(--color-primary)'
                      : 'transparent',
                    color: 'var(--color-text-inverse, #fff)',
                    transitionDuration: 'var(--duration-fast)',
                  }}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>

                {/* Status icon */}
                {status.icon && (
                  <span
                    className="flex-shrink-0 flex items-center"
                    style={{ color: `var(${status.color})` }}
                    aria-hidden="true"
                  >
                    {status.icon}
                  </span>
                )}

                {/* Label */}
                <span className={isSelected ? 'font-medium' : ''}>
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Sub-component: ViewModeToggle (segmented control)
// ============================================================

function ViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: 'current' | 'history';
  onViewModeChange: (mode: 'current' | 'history') => void;
}) {
  return (
    <div
      className="inline-flex rounded-[var(--radius-md)] border overflow-hidden"
      style={{ borderColor: 'var(--color-border)' }}
      role="group"
      aria-label="Benefit period view mode"
    >
      <button
        type="button"
        onClick={() => onViewModeChange('current')}
        aria-pressed={viewMode === 'current'}
        className="px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          backgroundColor:
            viewMode === 'current'
              ? 'var(--color-primary)'
              : 'var(--color-bg)',
          color:
            viewMode === 'current' ? 'var(--color-text-inverse, #fff)' : 'var(--color-text-secondary)',
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        Current
      </button>
      <button
        type="button"
        onClick={() => onViewModeChange('history')}
        aria-pressed={viewMode === 'history'}
        className="px-3 py-1.5 text-sm font-medium transition-colors border-l"
        style={{
          backgroundColor:
            viewMode === 'history'
              ? 'var(--color-primary)'
              : 'var(--color-bg)',
          color:
            viewMode === 'history' ? 'var(--color-text-inverse, #fff)' : 'var(--color-text-secondary)',
          borderColor: 'var(--color-border)',
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        History
      </button>
    </div>
  );
}

// ============================================================
// Filter chip atom
// ============================================================

function FilterChip({
  label,
  onRemove,
  colorVar,
}: {
  label: string;
  onRemove: () => void;
  /** CSS custom property name, e.g. "--color-primary" or "--color-success" */
  colorVar: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium transition-colors"
      style={{
        backgroundColor: `var(${colorVar}-light, var(--color-bg-secondary))`,
        color: `var(${colorVar})`,
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full transition-colors hover:opacity-70"
        style={{ color: `var(${colorVar})` }}
      >
        <X size={10} aria-hidden="true" />
      </button>
    </span>
  );
}

// ============================================================
// Main component
// ============================================================

export function UnifiedFilterBar({
  selectedPeriodId,
  onPeriodChange,
  periods,
  selectedStatuses,
  onStatusChange,
  availableStatuses,
  viewMode,
  onViewModeChange,
  benefitEngineEnabled,
  filteredCount,
  totalCount,
}: UnifiedFilterBarProps) {
  // ----------------------------------------------------------
  // Derive active filter chips
  // ----------------------------------------------------------

  const selectedPeriodLabel =
    periods.find((p) => p.id === selectedPeriodId)?.label ?? null;

  const isPeriodFiltered = selectedPeriodId !== 'all-time';

  const activeStatusChips = availableStatuses.filter((s) =>
    selectedStatuses.includes(s.id),
  );

  // Show chips when at least one filter deviates from "show everything"
  const isStatusFiltered =
    selectedStatuses.length !== availableStatuses.length;

  const hasActiveFilters = isPeriodFiltered || isStatusFiltered;

  // ----------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------

  const handleRemovePeriod = useCallback(() => {
    onPeriodChange('all-time');
  }, [onPeriodChange]);

  const handleRemoveStatus = useCallback(
    (id: string) => {
      onStatusChange(selectedStatuses.filter((s) => s !== id));
    },
    [selectedStatuses, onStatusChange],
  );

  const handleClearAll = useCallback(() => {
    onPeriodChange('all-time');
    onStatusChange(availableStatuses.map((s) => s.id));
  }, [onPeriodChange, onStatusChange, availableStatuses]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div
      role="toolbar"
      aria-label="Benefit filters"
      className="rounded-[var(--radius-lg)] border p-3 md:p-4 space-y-3"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {/* Row 1 — Filter controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period dropdown */}
        <PeriodDropdown
          selectedPeriodId={selectedPeriodId}
          onPeriodChange={onPeriodChange}
          periods={periods}
        />

        {/* Status dropdown */}
        <StatusDropdown
          selectedStatuses={selectedStatuses}
          onStatusChange={onStatusChange}
          availableStatuses={availableStatuses}
        />

        {/* View mode toggle — only when benefit engine is on */}
        {benefitEngineEnabled && (
          <div className="ml-auto">
            <ViewModeToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />
          </div>
        )}
      </div>

      {/* Row 2 — Active filter chips + count */}
      {(hasActiveFilters || filteredCount !== totalCount) && (
        <div
          className="flex flex-wrap items-center gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          {hasActiveFilters && (
            <>
              <span
                className="text-xs font-medium mr-1 flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Active filters:
              </span>

              {/* Period chip */}
              {isPeriodFiltered && selectedPeriodLabel && (
                <FilterChip
                  label={selectedPeriodLabel}
                  onRemove={handleRemovePeriod}
                  colorVar="--color-primary"
                />
              )}

              {/* Status chips — only show when not all statuses are selected */}
              {isStatusFiltered &&
                activeStatusChips.map((status) => (
                  <FilterChip
                    key={status.id}
                    label={status.label}
                    onRemove={() => handleRemoveStatus(status.id)}
                    colorVar={status.color}
                  />
                ))}

              {/* Clear all */}
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-medium ml-1 transition-colors hover:opacity-80"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label="Clear all filters"
              >
                Clear all
              </button>
            </>
          )}

          {/* Benefit count — pushed to the right */}
          <span
            className="text-xs ml-auto flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Showing {filteredCount} of {totalCount} benefit
            {totalCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}