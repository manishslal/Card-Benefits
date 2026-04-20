'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import Skeleton from '@/shared/components/ui/Skeleton';
import { formatCurrency } from '@/shared/lib/format-currency';
import { BenefitCalendar } from './BenefitCalendar';
import { BenefitHistoryTimeline } from './BenefitHistoryTimeline';

// ============================================================
// Type Definitions
// ============================================================

interface TodayBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number; // cents
  isUsed: boolean;
  periodEnd: string | null;
  periodStart: string | null;
  resetCadence: string;
  claimedAt: string | null;
  daysLeft: number | null;
  cardName: string;
  cardIssuer: string;
  userCardId: string;
}

interface TodaySections {
  urgent: TodayBenefit[];
  availableThisMonth: TodayBenefit[];
  upcomingResets: TodayBenefit[];
  recentlyUsed: TodayBenefit[];
}

export interface TodayViewProps {
  onMarkUsed: (benefitId: string) => void | Promise<void>;
  onNavigateToBenefit: (benefitId: string, cardId: string) => void;
}

// ============================================================
// Section Configuration
// ============================================================

interface SectionConfig {
  key: keyof TodaySections;
  emoji: string;
  title: string;
  subtitle: string;
  showMarkUsed: boolean;
  showDaysLeft: boolean;
  bgStyle: React.CSSProperties;
  emptyMessage: string;
}

const SECTION_CONFIGS: SectionConfig[] = [
  {
    key: 'urgent',
    emoji: '🔴',
    title: 'Needs Attention',
    subtitle: 'Benefits expiring in the next 7 days',
    showMarkUsed: true,
    showDaysLeft: true,
    bgStyle: {
      backgroundColor: 'color-mix(in srgb, var(--color-error) 5%, var(--color-bg))',
    },
    emptyMessage: 'All caught up! No urgent benefits.',
  },
  {
    key: 'availableThisMonth',
    emoji: '💰',
    title: 'Available This Month',
    subtitle: 'Unclaimed benefits you can use now',
    showMarkUsed: true,
    showDaysLeft: true,
    bgStyle: {
      backgroundColor: 'color-mix(in srgb, var(--color-success) 5%, var(--color-bg))',
    },
    emptyMessage: 'Nothing here — you\'ve claimed everything this month!',
  },
  {
    key: 'upcomingResets',
    emoji: '🔄',
    title: 'Resetting Soon',
    subtitle: 'Used benefits that will reset this month',
    showMarkUsed: false,
    showDaysLeft: true,
    bgStyle: {
      backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-bg))',
    },
    emptyMessage: 'No benefits resetting this month.',
  },
  {
    key: 'recentlyUsed',
    emoji: '✅',
    title: 'Recently Used',
    subtitle: 'Benefits marked used in the last 7 days',
    showMarkUsed: false,
    showDaysLeft: false,
    bgStyle: {},
    emptyMessage: 'No recent activity.',
  },
];

// ============================================================
// Sub-Components
// ============================================================

function BenefitCard({
  benefit,
  showMarkUsed,
  showDaysLeft,
  isMarkingUsed,
  onMarkUsed,
  onNavigate,
}: {
  benefit: TodayBenefit;
  showMarkUsed: boolean;
  showDaysLeft: boolean;
  isMarkingUsed: boolean;
  onMarkUsed: (id: string) => void;
  onNavigate: (id: string, cardId: string) => void;
}) {
  const displayValue = formatCurrency(benefit.stickerValue);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border transition-colors"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {/* Benefit info */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={() => onNavigate(benefit.id, benefit.userCardId)}
          className="text-sm font-medium truncate block text-left w-full hover:underline"
          style={{ color: 'var(--color-text)' }}
          title={`View ${benefit.name} on ${benefit.cardName}`}
        >
          {benefit.name}
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs font-mono tabular-nums font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            {displayValue}
          </span>
          <span
            className="text-xs truncate"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            · {benefit.cardName}
          </span>
        </div>
        {showDaysLeft && benefit.daysLeft !== null && (
          <span
            className="text-xs mt-0.5 inline-block"
            style={{
              color: benefit.daysLeft <= 3 ? 'var(--color-error)' : 'var(--color-text-secondary)',
            }}
          >
            {benefit.daysLeft === 0
              ? 'Expires today'
              : benefit.daysLeft === 1
                ? '1 day left'
                : `${benefit.daysLeft} days left`}
          </span>
        )}
      </div>

      {/* Action button */}
      {showMarkUsed && !benefit.isUsed && (
        <button
          type="button"
          onClick={() => onMarkUsed(benefit.id)}
          disabled={isMarkingUsed}
          className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse, #fff)',
          }}
        >
          {isMarkingUsed ? 'Marking…' : 'Mark Used'}
        </button>
      )}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton variant="text" width={24} height={24} />
        <Skeleton variant="text" width="40%" height={20} />
      </div>
      <Skeleton variant="text" width="60%" height={14} className="mb-4" />
      <div className="space-y-2">
        <Skeleton variant="rectangular" width="100%" height={64} />
        <Skeleton variant="rectangular" width="100%" height={64} />
      </div>
    </div>
  );
}

function CalendarSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section
      className="rounded-xl border overflow-hidden"
      style={{
        borderColor: 'var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}
      aria-label="Benefit Calendar"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-4 transition-colors"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-bg))',
        }}
        aria-expanded={isExpanded}
        aria-controls="calendar-panel"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Calendar
          </h3>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} aria-hidden="true" />
        )}
      </button>
      {isExpanded && (
        <div id="calendar-panel" className="px-0">
          <BenefitCalendar />
        </div>
      )}
    </section>
  );
}

// ============================================================
// Main Component
// ============================================================

export function TodayView({ onMarkUsed, onNavigateToBenefit }: TodayViewProps) {
  const [sections, setSections] = useState<TodaySections | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingUsed, setMarkingUsed] = useState<Set<string>>(new Set());

  const fetchTodayActions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/benefits/today-actions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setSections(data.sections);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load today\'s actions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayActions();
  }, [fetchTodayActions]);

  const handleMarkUsed = useCallback(async (benefitId: string) => {
    setMarkingUsed(prev => new Set(prev).add(benefitId));
    try {
      await onMarkUsed(benefitId);
      // Give the API time to process, then refresh sections
      await new Promise(resolve => setTimeout(resolve, 800));
      await fetchTodayActions();
    } finally {
      setMarkingUsed(prev => {
        const next = new Set(prev);
        next.delete(benefitId);
        return next;
      });
    }
  }, [onMarkUsed, fetchTodayActions]);

  // ── Loading State ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 px-4 rounded-xl mt-4"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <AlertCircle
          size={32}
          style={{ color: 'var(--color-error)' }}
          className="mb-3"
        />
        <p
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Unable to load today&apos;s actions
        </p>
        <button
          type="button"
          onClick={fetchTodayActions}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-text-inverse, #fff)',
          }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  // ── All-empty State ────────────────────────────────────────────
  if (sections) {
    const totalItems =
      sections.urgent.length +
      sections.availableThisMonth.length +
      sections.upcomingResets.length +
      sections.recentlyUsed.length;

    if (totalItems === 0) {
      return (
        <div className="space-y-4 mt-4">
          <CalendarSection />
          <div
            className="flex flex-col items-center justify-center py-16 px-4 rounded-xl"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <span className="text-4xl mb-4" role="img" aria-label="celebration">
              🎉
            </span>
            <p
              className="text-lg font-semibold mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              You&apos;re all caught up!
            </p>
            <p
              className="text-sm text-center max-w-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              No benefits need your attention right now. Check back later or switch to the My Cards tab to explore all your benefits.
            </p>
          </div>
        </div>
      );
    }
  }

  // ── Normal Render ──────────────────────────────────────────────
  return (
    <div className="space-y-4 mt-4">
      {/* Collapsible Calendar Section */}
      <CalendarSection />

      {SECTION_CONFIGS.map((config) => {
        const items = sections?.[config.key] ?? [];

        return (
          <section
            key={config.key}
            className="p-4 rounded-xl border"
            style={{
              ...config.bgStyle,
              borderColor: 'var(--color-border)',
              borderRadius: 'var(--radius-lg)',
            }}
            aria-label={config.title}
          >
            {/* Section header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base" role="img" aria-hidden="true">
                {config.emoji}
              </span>
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--color-text)' }}
              >
                {config.title}
                {items.length > 0 && (
                  <span
                    className="ml-1.5 text-xs font-normal font-mono tabular-nums"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    ({items.length})
                  </span>
                )}
              </h3>
            </div>
            <p
              className="text-xs mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {config.subtitle}
            </p>

            {/* Section content */}
            {items.length === 0 ? (
              <p
                className="text-xs py-3 text-center"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {config.emptyMessage}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((benefit) => (
                  <BenefitCard
                    key={benefit.id}
                    benefit={benefit}
                    showMarkUsed={config.showMarkUsed}
                    showDaysLeft={config.showDaysLeft}
                    isMarkingUsed={markingUsed.has(benefit.id)}
                    onMarkUsed={handleMarkUsed}
                    onNavigate={onNavigateToBenefit}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Section: Recent History (compact timeline showing last 5 expired benefits) */}
      <section
        className="p-4 rounded-xl border"
        style={{
          borderColor: 'var(--color-border)',
          borderRadius: 'var(--radius-lg)',
        }}
        aria-label="Recent History"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base" role="img" aria-hidden="true">
            📜
          </span>
          <h3
            className="text-sm font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Recent History
          </h3>
        </div>
        <p
          className="text-xs mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Last expired benefit periods
        </p>
        <BenefitHistoryTimeline compact limit={5} />
      </section>
    </div>
  );
}

export default TodayView;
