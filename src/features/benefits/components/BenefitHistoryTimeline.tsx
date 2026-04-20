'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Check, X, Clock, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Skeleton from '@/shared/components/ui/Skeleton';
import { formatCurrency } from '@/shared/lib/format-currency';

// ============================================================
// Type Definitions
// ============================================================

interface HistoryBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  isUsed: boolean;
  timesUsed: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodStatus: string;
  masterBenefitId: string | null;
  claimingCadence: string | null;
  userCardId: string;
  cardName: string;
  cardIssuer: string;
  claimedAt?: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface MonthGroup {
  key: string; // 'yyyy-MM'
  label: string; // 'March 2026'
  recoveredCents: number;
  entries: HistoryBenefit[];
}

export interface BenefitHistoryTimelineProps {
  cardId?: string;
  compact?: boolean;
  limit?: number;
}

// ============================================================
// Helpers
// ============================================================

function getCadenceLabel(cadence: string): string {
  switch (cadence) {
    case 'MONTHLY':
      return 'Monthly';
    case 'QUARTERLY':
      return 'Quarterly';
    case 'SEMI_ANNUAL':
      return 'Semi-Annual';
    case 'ANNUAL':
      return 'Annual';
    case 'ONE_TIME':
      return 'One-time';
    default:
      return cadence ? cadence.charAt(0) + cadence.slice(1).toLowerCase() : 'Unknown';
  }
}

function groupByMonth(benefits: HistoryBenefit[]): MonthGroup[] {
  const groups = new Map<string, HistoryBenefit[]>();

  for (const benefit of benefits) {
    const dateStr = benefit.periodEnd;
    if (!dateStr) continue;
    const date = parseISO(dateStr);
    const key = format(date, 'yyyy-MM');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(benefit);
  }

  // Sort keys descending (most recent first)
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    const entries = groups.get(key)!;
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const label = format(date, 'MMMM yyyy');

    const recoveredCents = entries.reduce((sum, b) => {
      if (b.isUsed) {
        return sum + (b.userDeclaredValue ?? b.stickerValue);
      }
      return sum;
    }, 0);

    return { key, label, recoveredCents, entries };
  });
}

// ============================================================
// Sub-Components
// ============================================================

function TimelineSkeleton({ compact }: { compact?: boolean }) {
  const itemCount = compact ? 3 : 5;
  return (
    <div role="status" aria-busy="true" aria-label="Loading benefit history">
      {/* Month header skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="text" width="35%" height={20} />
        <div style={{ flex: 1, height: 1, backgroundColor: 'var(--color-border)' }} />
        <Skeleton variant="text" width="20%" height={16} />
      </div>
      {/* Timeline entries skeleton */}
      <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--color-border)' }}>
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} className="mb-4" style={{ paddingLeft: 16 }}>
            <div className="flex items-center gap-2 mb-1">
              <Skeleton variant="circular" width={20} height={20} />
              <Skeleton variant="text" width="50%" height={16} />
              <div style={{ flex: 1 }} />
              <Skeleton variant="text" width="15%" height={16} />
            </div>
            <div style={{ paddingLeft: 28 }}>
              <Skeleton variant="text" width="40%" height={12} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 rounded-xl"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <Clock
        size={32}
        style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}
        className="mb-3"
        aria-hidden="true"
      />
      <p
        className="text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        No benefit history yet
      </p>
      <p
        className="text-xs mt-1 text-center max-w-xs"
        style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}
      >
        As your benefit periods expire, they&apos;ll appear here so you can track your value recovered over time.
      </p>
    </div>
  );
}

function TimelineEntry({
  benefit,
  compact,
}: {
  benefit: HistoryBenefit;
  compact?: boolean;
}) {
  const periodEndDate = benefit.periodEnd ? parseISO(benefit.periodEnd) : null;
  const claimedDate = benefit.claimedAt ? parseISO(benefit.claimedAt) : null;
  const displayValue = formatCurrency(benefit.userDeclaredValue ?? benefit.stickerValue);
  const cadenceLabel = getCadenceLabel(benefit.resetCadence);

  const dateLabel = periodEndDate ? format(periodEndDate, 'MMM d') : '—';

  const subText = benefit.isUsed
    ? `${cadenceLabel} · Used${claimedDate ? ` on ${format(claimedDate, 'MMM d')}` : ''}`
    : `${cadenceLabel} · Expired unused`;

  return (
    <div
      className="relative flex items-start gap-3 py-2"
      style={{ paddingLeft: 16 }}
    >
      {/* Timeline dot */}
      <div
        className="absolute flex items-center justify-center shrink-0"
        style={{
          left: -9,
          top: 12,
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: benefit.isUsed
            ? 'var(--color-success)'
            : 'var(--color-error, #ef4444)',
        }}
        aria-hidden="true"
      >
        {benefit.isUsed ? (
          <Check size={10} style={{ color: '#fff' }} strokeWidth={3} />
        ) : (
          <X size={10} style={{ color: '#fff' }} strokeWidth={3} />
        )}
      </div>

      {/* Date */}
      <span
        className="shrink-0 text-xs font-mono tabular-nums"
        style={{
          color: 'var(--color-text-secondary)',
          width: compact ? 46 : 52,
          paddingTop: 2,
        }}
      >
        {dateLabel}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ color: 'var(--color-text)' }}
          >
            {benefit.name}
          </span>
          <span
            className="text-sm font-semibold font-mono tabular-nums shrink-0"
            style={{
              color: benefit.isUsed ? 'var(--color-success)' : 'var(--color-text-secondary)',
            }}
          >
            {displayValue}
          </span>
          {!compact && (
            <span
              className="text-xs truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {benefit.cardName}
            </span>
          )}
        </div>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {subText}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function BenefitHistoryTimeline({
  cardId,
  compact = false,
  limit: externalLimit,
}: BenefitHistoryTimelineProps) {
  const [benefits, setBenefits] = useState<HistoryBenefit[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = externalLimit ?? (compact ? 5 : 20);
  const showPagination = !externalLimit && !compact;

  const fetchHistory = useCallback(
    async (page: number, append: boolean = false) => {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (cardId) {
          params.set('cardId', cardId);
        }

        const response = await fetch(`/api/benefits/history?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch history: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
          const newBenefits: HistoryBenefit[] = data.benefits ?? [];
          setBenefits((prev) => (append ? [...prev, ...newBenefits] : newBenefits));
          setPagination(data.pagination ?? null);
          setCurrentPage(page);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load benefit history');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [cardId, pageSize]
  );

  useEffect(() => {
    fetchHistory(1, false);
  }, [fetchHistory]);

  const handleLoadMore = useCallback(() => {
    if (pagination?.hasMore) {
      fetchHistory(currentPage + 1, true);
    }
  }, [pagination, currentPage, fetchHistory]);

  const monthGroups = useMemo(() => groupByMonth(benefits), [benefits]);

  // ── Loading State ──────────────────────────────────────────────
  if (isLoading) {
    return <TimelineSkeleton compact={compact} />;
  }

  // ── Error State ────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 px-4 rounded-xl"
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
          aria-hidden="true"
        />
        <p
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Unable to load benefit history
        </p>
        <button
          type="button"
          onClick={() => fetchHistory(1, false)}
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

  // ── Empty State ────────────────────────────────────────────────
  if (benefits.length === 0) {
    return <EmptyState />;
  }

  // ── Normal Render ──────────────────────────────────────────────
  return (
    <div
      role="feed"
      aria-label="Benefit usage history timeline"
      className="space-y-6"
    >
      {monthGroups.map((group) => (
        <section key={group.key} aria-label={`${group.label} benefits`}>
          {/* Month header */}
          <div
            className="flex items-center gap-3 mb-3"
            role="heading"
            aria-level={3}
          >
            <span
              className="text-sm font-semibold whitespace-nowrap"
              style={{ color: 'var(--color-text)' }}
            >
              {group.label}
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                backgroundColor: 'var(--color-border)',
              }}
              aria-hidden="true"
            />
            {group.recoveredCents > 0 && (
              <span
                className="text-xs font-medium font-mono tabular-nums whitespace-nowrap"
                style={{ color: 'var(--color-success)' }}
              >
                {formatCurrency(group.recoveredCents)} recovered
              </span>
            )}
          </div>

          {/* Timeline entries */}
          <div
            style={{
              marginLeft: 8,
              paddingLeft: 16,
              borderLeft: '2px solid var(--color-border)',
            }}
          >
            {group.entries.map((entry) => (
              <TimelineEntry
                key={entry.id}
                benefit={entry}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Load More Button */}
      {showPagination && pagination?.hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            aria-label="Load more benefit history"
          >
            {isLoadingMore ? (
              <>
                <div
                  className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: 'var(--color-border)', borderTopColor: 'transparent' }}
                />
                Loading…
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                Load More
              </>
            )}
          </button>
        </div>
      )}

      {/* Pagination info */}
      {showPagination && pagination && (
        <p
          className="text-center text-xs font-mono tabular-nums pt-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Showing {benefits.length} of {pagination.total} expired benefits
        </p>
      )}
    </div>
  );
}

export default BenefitHistoryTimeline;
