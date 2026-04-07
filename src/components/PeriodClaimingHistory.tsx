/**
 * PeriodClaimingHistory Component
 *
 * Displays historical claiming records organized by period.
 * Features:
 * - Show "Month: $15 claimed (max $15)" format
 * - Indicate losses (e.g., "lost $3" if didn't use full amount)
 * - Filterable by period type
 * - Scrollable list for historical view
 * - Dark mode support
 * - Responsive layout
 *
 * @example
 * const history = [
 *   {
 *     period: 'April 2026',
 *     claimed: 1500,
 *     max: 1500,
 *     status: 'FULLY_CLAIMED',
 *   },
 *   {
 *     period: 'March 2026',
 *     claimed: 1200,
 *     max: 1500,
 *     status: 'PARTIALLY_CLAIMED',
 *     missed: 300,
 *   },
 * ];
 *
 * <PeriodClaimingHistory history={history} />
 */

'use client';

import React, { useMemo, useState } from 'react';
import { ClaimingCadence } from '@/lib/benefit-period-utils';

interface PeriodHistory {
  period: string; // e.g., "April 2026"
  claimed: number; // in cents
  max: number; // in cents
  status: 'FULLY_CLAIMED' | 'PARTIALLY_CLAIMED' | 'MISSED' | 'NOT_AVAILABLE';
  missed?: number; // Amount not claimed
  date: Date; // For sorting
}

interface PeriodClaimingHistoryProps {
  history: PeriodHistory[];
  claimingCadence?: ClaimingCadence;
  maxHeight?: string;
  className?: string;
}

/**
 * Format cents to dollars
 */
function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Get status badge styling
 */
function getStatusStyle(status: string): {
  label: string;
  bg: string;
  text: string;
  icon: string;
} {
  switch (status) {
    case 'FULLY_CLAIMED':
      return {
        label: 'Full',
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-300',
        icon: '✅',
      };
    case 'PARTIALLY_CLAIMED':
      return {
        label: 'Partial',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-300',
        icon: '⚠️',
      };
    case 'MISSED':
      return {
        label: 'Missed',
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-300',
        icon: '❌',
      };
    case 'NOT_AVAILABLE':
      return {
        label: 'N/A',
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        text: 'text-gray-700 dark:text-gray-300',
        icon: '◯',
      };
    default:
      return {
        label: 'Unknown',
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        text: 'text-gray-700 dark:text-gray-300',
        icon: '?',
      };
  }
}

/**
 * Calculate financial impact of missed claiming
 */
function calculateTotalMissed(history: PeriodHistory[]): number {
  return history.reduce((sum, h) => sum + (h.missed || 0), 0);
}

/**
 * PeriodClaimingHistory - Main component
 */
export function PeriodClaimingHistory({
  history,
  maxHeight = 'max-h-96',
  className,
}: PeriodClaimingHistoryProps) {
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  // Sort history by date (most recent first)
  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [history]
  );

  const totalMissed = useMemo(() => calculateTotalMissed(sortedHistory), [sortedHistory]);

  // Empty state
  if (sortedHistory.length === 0) {
    return (
      <div
        className={`
          rounded-lg border border-dashed border-gray-300 dark:border-gray-600
          p-6 text-center text-gray-600 dark:text-gray-400
          ${className || ''}
        `}
      >
        <p className="text-sm">No claiming history available yet.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Summary card */}
      <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 dark:bg-gray-900/30 p-4 border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
            Periods
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {sortedHistory.length}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
            Total Claimed
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatCurrency(sortedHistory.reduce((sum, h) => sum + h.claimed, 0))}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
            Missed
          </p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalMissed)}
          </p>
        </div>
      </div>

      {/* History list */}
      <div
        className={`
          border border-gray-200 dark:border-gray-700 rounded-lg
          overflow-hidden ${maxHeight} overflow-y-auto
        `}
      >
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedHistory.map((item, index) => {
            const statusStyle = getStatusStyle(item.status);
            const isExpanded = expandedPeriod === `${index}-${item.period}`;
            const utilizationPercent = (item.claimed / item.max) * 100;

            return (
              <div
                key={`${index}-${item.period}`}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Period row */}
                <button
                  onClick={() =>
                    setExpandedPeriod(isExpanded ? null : `${index}-${item.period}`)
                  }
                  className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 hover:bg-opacity-100 dark:hover:bg-opacity-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:focus:ring-blue-400"
                  aria-expanded={isExpanded}
                  aria-label={`Period: ${item.period}. Claimed ${formatCurrency(item.claimed)} of ${formatCurrency(item.max)}.`}
                >
                  {/* Left side: Period and amounts */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.period}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatCurrency(item.claimed)} / {formatCurrency(item.max)}
                      </span>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'FULLY_CLAIMED'
                            ? 'bg-green-500'
                            : item.status === 'PARTIALLY_CLAIMED'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Right side: Status badge and expand button */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
                        ${statusStyle.bg} ${statusStyle.text}
                      `}
                    >
                      <span>{statusStyle.icon}</span>
                      {statusStyle.label}
                    </div>

                    {item.missed && item.missed > 0 && (
                      <div className="text-xs font-medium text-red-600 dark:text-red-400">
                        -${(item.missed / 100).toFixed(2)}
                      </div>
                    )}

                    <svg
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-200 dark:border-gray-700">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Amount Claimed:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.claimed)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Period Maximum:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatCurrency(item.max)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">
                          Utilization:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {Math.round(utilizationPercent)}%
                        </span>
                      </div>

                      {item.missed && item.missed > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                            <span className="text-red-700 dark:text-red-300 font-medium">
                              Missed:
                            </span>
                            <span className="text-red-700 dark:text-red-300 font-bold">
                              {formatCurrency(item.missed)}
                            </span>
                          </div>
                        </div>
                      )}

                      {item.status === 'MISSED' && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic mt-2">
                          Period ended without claiming any benefits.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      {totalMissed > 0 && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            <span className="font-semibold">💡 Financial Impact:</span> You missed{' '}
            <span className="font-bold">{formatCurrency(totalMissed)}</span> in benefits across{' '}
            {sortedHistory.filter((h) => h.missed && h.missed > 0).length} period(s). Consider
            setting reminders!
          </p>
        </div>
      )}
    </div>
  );
}

export default PeriodClaimingHistory;
