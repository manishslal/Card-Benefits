'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';
import Skeleton from '@/shared/components/ui/Skeleton';
import { formatCurrency } from '@/shared/lib/format-currency';

// ============================================================
// Type Definitions
// ============================================================

interface CalendarEvent {
  date: string;
  type: 'reset' | 'used' | 'expiring';
  benefitId: string;
  benefitName: string;
  cardName: string;
  stickerValue: number;
  isUsed?: boolean;
}

export interface BenefitCalendarProps {
  cardId?: string;
  initialMonth?: string; // "YYYY-MM" format, defaults to current month
}

// ============================================================
// Constants
// ============================================================

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MAX_MONTH_OFFSET = 3;

const EVENT_CONFIG = {
  reset: {
    label: 'Reset',
    icon: RefreshCw,
    color: 'var(--color-success)',
    indicator: '●',
  },
  used: {
    label: 'Used',
    icon: Check,
    color: 'var(--color-success)',
    indicator: '✓',
  },
  expiring: {
    label: 'Expiring',
    icon: AlertTriangle,
    color: 'var(--color-warning)',
    indicator: '⚠',
  },
} as const;

// ============================================================
// Helper Functions
// ============================================================

function parseInitialMonth(month?: string): Date {
  if (month) {
    const match = month.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      return new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1);
    }
  }
  return startOfMonth(new Date());
}

function formatMonthParam(date: Date): string {
  return format(date, 'yyyy-MM');
}

// ============================================================
// Sub-Components
// ============================================================

function CalendarSkeleton() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="status"
      aria-busy="true"
      aria-label="Loading calendar"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="text" width={160} height={24} />
        <Skeleton variant="circular" width={32} height={32} />
      </div>
      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((day) => (
          <Skeleton key={day} variant="text" width="100%" height={16} />
        ))}
      </div>
      {/* Grid cells */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" width="100%" height={44} />
        ))}
      </div>
    </div>
  );
}

function DayPopoverContent({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-2" style={{ maxHeight: '240px', overflowY: 'auto' }}>
      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.type];
        const Icon = config.icon;
        return (
          <div
            key={`${event.benefitId}-${event.type}-${idx}`}
            className="flex items-start gap-2 p-2 rounded-md"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 50%, var(--color-bg))',
            }}
          >
            <Icon
              size={14}
              style={{ color: config.color, marginTop: '2px', flexShrink: 0 }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate"
                style={{ color: 'var(--color-text)' }}
              >
                {event.benefitName}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {event.cardName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-xs font-semibold"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                <span
                  className="text-xs font-mono tabular-nums"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {formatCurrency(event.stickerValue)}
                </span>
              </div>
              {event.type === 'expiring' && event.isUsed !== undefined && (
                <span
                  className="text-xs"
                  style={{
                    color: event.isUsed ? 'var(--color-success)' : 'var(--color-error)',
                  }}
                >
                  {event.isUsed ? 'Already claimed' : 'Not yet used'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function BenefitCalendar({ cardId, initialMonth }: BenefitCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => parseInitialMonth(initialMonth));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedDayIndex, setFocusedDayIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => new Date(), []);
  const minMonth = useMemo(() => subMonths(startOfMonth(today), MAX_MONTH_OFFSET), [today]);
  const maxMonth = useMemo(() => addMonths(startOfMonth(today), MAX_MONTH_OFFSET), [today]);

  // ── Data Fetching ──────────────────────────────────────────────
  const fetchCalendarData = useCallback(async (month: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ month: formatMonthParam(month) });
      if (cardId) params.set('cardId', cardId);

      const response = await fetch(`/api/benefits/calendar?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar data: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setEvents(data.events || []);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load calendar');
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchCalendarData(currentMonth);
  }, [currentMonth, fetchCalendarData]);

  // ── Navigation ─────────────────────────────────────────────────
  const canGoBack = useMemo(
    () => startOfMonth(subMonths(currentMonth, 1)) >= minMonth,
    [currentMonth, minMonth]
  );
  const canGoForward = useMemo(
    () => startOfMonth(addMonths(currentMonth, 1)) <= maxMonth,
    [currentMonth, maxMonth]
  );

  const goToPreviousMonth = useCallback(() => {
    if (canGoBack) setCurrentMonth((prev) => subMonths(prev, 1));
  }, [canGoBack]);

  const goToNextMonth = useCallback(() => {
    if (canGoForward) setCurrentMonth((prev) => addMonths(prev, 1));
  }, [canGoForward]);

  // ── Calendar Grid Calculation ──────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ── Events lookup by date ──────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const existing = map.get(event.date) || [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [events]);

  // ── Keyboard Navigation ────────────────────────────────────────
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (focusedDayIndex === null) return;

      let nextIndex = focusedDayIndex;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = Math.min(focusedDayIndex + 1, calendarDays.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(focusedDayIndex - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(focusedDayIndex + 7, calendarDays.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(focusedDayIndex - 7, 0);
          break;
        default:
          return;
      }

      e.preventDefault();
      setFocusedDayIndex(nextIndex);

      // Focus the button in the target cell
      const grid = gridRef.current;
      if (grid) {
        const buttons = grid.querySelectorAll<HTMLButtonElement>('[data-day-index]');
        const target = Array.from(buttons).find(
          (btn) => btn.getAttribute('data-day-index') === String(nextIndex)
        );
        target?.focus();
      }
    },
    [focusedDayIndex, calendarDays.length]
  );

  // ── Loading State ──────────────────────────────────────────────
  if (isLoading && events.length === 0) {
    return <CalendarSkeleton />;
  }

  // ── Error State ────────────────────────────────────────────────
  if (error && events.length === 0) {
    return (
      <div
        className="rounded-xl border p-4 flex flex-col items-center justify-center py-8"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        <AlertTriangle size={24} style={{ color: 'var(--color-warning)' }} className="mb-2" />
        <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => fetchCalendarData(currentMonth)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse, #fff)',
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  // ── Render Calendar ────────────────────────────────────────────
  return (
    <div
      className="rounded-xl border"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg)',
      }}
      role="region"
      aria-label="Benefit calendar"
    >
      {/* Header with month navigation */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <button
          type="button"
          onClick={goToPreviousMonth}
          disabled={!canGoBack}
          className="inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            width: '32px',
            height: '32px',
            color: 'var(--color-text-secondary)',
          }}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
            aria-live="polite"
            aria-atomic="true"
          >
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          {isLoading && (
            <span
              className="inline-block w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-primary)' }}
              aria-label="Loading"
            />
          )}
        </div>

        <button
          type="button"
          onClick={goToNextMonth}
          disabled={!canGoForward}
          className="inline-flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            width: '32px',
            height: '32px',
            color: 'var(--color-text-secondary)',
          }}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day name headers */}
      <div
        className="grid grid-cols-7 px-2 pt-2"
        role="row"
        aria-label="Days of the week"
      >
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium py-1"
            style={{ color: 'var(--color-text-secondary)' }}
            role="columnheader"
            aria-label={day}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-7 gap-0.5 px-2 pb-2"
        role="grid"
        aria-label={`Calendar for ${format(currentMonth, 'MMMM yyyy')}`}
        onKeyDown={handleGridKeyDown}
      >
        {calendarDays.map((day, index) => {
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const isCurrentDay = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) || [];
          const hasEvents = dayEvents.length > 0;

          // Determine which indicator types are present
          const hasReset = dayEvents.some((e) => e.type === 'reset');
          const hasUsed = dayEvents.some((e) => e.type === 'used');
          const hasExpiring = dayEvents.some(
            (e) => e.type === 'expiring' && !e.isUsed
          );

          const cellContent = (
            <div
              className="relative flex flex-col items-center justify-center"
              style={{
                minHeight: '44px',
                minWidth: '44px',
                borderRadius: '8px',
                backgroundColor: isCurrentDay
                  ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))'
                  : 'transparent',
                border: isCurrentDay ? '2px solid var(--color-primary)' : '2px solid transparent',
                opacity: inCurrentMonth ? 1 : 0.3,
              }}
            >
              <span
                className="text-xs font-medium"
                style={{
                  color: inCurrentMonth ? 'var(--color-text)' : 'var(--color-text-secondary)',
                }}
              >
                {format(day, 'd')}
              </span>

              {/* Event indicators */}
              {hasEvents && inCurrentMonth && (
                <div
                  className="flex items-center gap-0.5 mt-0.5"
                  style={{ fontSize: '8px', lineHeight: 1 }}
                >
                  {hasReset && (
                    <span
                      style={{ color: 'var(--color-success)' }}
                      aria-hidden="true"
                      title="Benefit reset"
                    >
                      ●
                    </span>
                  )}
                  {hasUsed && (
                    <span
                      style={{ color: 'var(--color-success)' }}
                      aria-hidden="true"
                      title="Benefit used"
                    >
                      ✓
                    </span>
                  )}
                  {hasExpiring && (
                    <span
                      style={{ color: 'var(--color-warning)' }}
                      aria-hidden="true"
                      title="Benefit expiring (unused)"
                    >
                      ⚠
                    </span>
                  )}
                </div>
              )}
            </div>
          );

          // Non-interactive cell for days outside the month
          if (!inCurrentMonth) {
            return (
              <div
                key={dateKey}
                className="flex items-center justify-center"
                role="gridcell"
                aria-disabled="true"
              >
                {cellContent}
              </div>
            );
          }

          // Interactive day cell with popover
          if (hasEvents) {
            return (
              <Popover key={dateKey}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2"
                    style={{
                      cursor: 'pointer',
                    }}
                    data-day-index={index}
                    onFocus={() => setFocusedDayIndex(index)}
                    aria-label={`${format(day, 'MMMM d, yyyy')}: ${dayEvents.length} benefit event${dayEvents.length > 1 ? 's' : ''}`}
                    role="gridcell"
                  >
                    {cellContent}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  sideOffset={8}
                  className="w-64 p-3"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  <p
                    className="text-xs font-semibold mb-2"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {format(day, 'EEEE, MMMM d')}
                  </p>
                  <DayPopoverContent events={dayEvents} />
                </PopoverContent>
              </Popover>
            );
          }

          // Day with no events — still focusable for keyboard nav
          return (
            <button
              key={dateKey}
              type="button"
              className="flex items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2"
              style={{ cursor: 'default' }}
              data-day-index={index}
              onFocus={() => setFocusedDayIndex(index)}
              aria-label={format(day, 'MMMM d, yyyy')}
              role="gridcell"
              tabIndex={-1}
            >
              {cellContent}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex items-center justify-center gap-4 px-4 py-2"
        style={{ borderTop: '1px solid var(--color-border)' }}
        aria-label="Calendar legend"
      >
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>●</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Reset
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--color-success)', fontSize: '10px' }}>✓</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Used
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--color-warning)', fontSize: '10px' }}>⚠</span>
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Expiring
          </span>
        </div>
      </div>
    </div>
  );
}

export default BenefitCalendar;
