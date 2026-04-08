'use client';

import React, { useState } from 'react';
import { BenefitRow, BenefitRowProps } from './BenefitRow';

/**
 * Props for a past period entry
 */
export interface PastPeriodEntry {
  id: string;
  startDate: Date;
  endDate: Date;
  benefits: BenefitRowProps[];
}

/**
 * Props for PastPeriodsSection component
 */
interface PastPeriodsSectionProps {
  periods: PastPeriodEntry[];
  onMarkUsed?: (benefitId: string) => Promise<void>;
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
}

/**
 * Format a past period for display
 */
function formatPeriodLabel(startDate: Date, endDate: Date): string {
  const startStr = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

/**
 * PastPeriodsSection Component
 *
 * Displays historical periods in a collapsed state by default.
 * Each period is expandable to show all benefits from that period.
 *
 * Features:
 * - Individual expandable period groups
 * - Can mark old benefits as used (backfill functionality)
 * - Edit/Delete actions for historical data
 * - Clean visual separation from current period
 */
export function PastPeriodsSection({
  periods,
  onMarkUsed,
  onEdit,
  onDelete,
}: PastPeriodsSectionProps) {
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);

  if (periods.length === 0) {
    return null;
  }

  const handleTogglePeriod = (periodId: string) => {
    setExpandedPeriodId(expandedPeriodId === periodId ? null : periodId);
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        📜 PAST PERIODS
      </h2>

      <div className="space-y-2">
        {periods.map((period) => (
          <div
            key={period.id}
            className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900/30"
          >
            {/* Period Header - Expandable */}
            <button
              onClick={() => handleTogglePeriod(period.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-expanded={expandedPeriodId === period.id}
              aria-controls={`past-period-${period.id}`}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl">📅</span>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {formatPeriodLabel(period.startDate, period.endDate)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {period.benefits.length} benefit{period.benefits.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 transform transition-transform ${
                  expandedPeriodId === period.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>

            {/* Period Content - Expandable */}
            {expandedPeriodId === period.id && (
              <div
                id={`past-period-${period.id}`}
                className="px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600"
              >
                <div className="space-y-2">
                  {period.benefits.length > 0 ? (
                    period.benefits.map((benefit) => (
                      <BenefitRow
                        key={benefit.id}
                        {...benefit}
                        onMarkUsed={onMarkUsed}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
                      No benefits in this period
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
