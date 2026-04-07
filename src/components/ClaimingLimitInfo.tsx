/**
 * ClaimingLimitInfo Component
 *
 * Displays detailed information about a benefit's claiming limit for the current period.
 * Shows:
 * - Available amount and period label (e.g., "April 2026")
 * - Period boundaries (start/end dates)
 * - Progress indicator
 * - Warning if near/at limit
 *
 * Used in modals and detail views.
 *
 * @example
 * const limits = {
 *   maxClaimableAmount: 1500,
 *   alreadyClaimedAmount: 1000,
 *   remainingAmount: 500,
 *   periodStart: new Date('2026-04-01'),
 *   periodEnd: new Date('2026-04-30'),
 *   periodLabel: 'April 2026',
 *   percentUtilized: 66.67,
 * };
 *
 * <ClaimingLimitInfo limits={limits} />
 */

'use client';

import React, { useMemo } from 'react';

interface ClaimingLimitsInfo {
  maxClaimableAmount: number;
  alreadyClaimedAmount: number;
  remainingAmount: number;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  percentUtilized: number;
  claimingCadence?: string;
}

interface ClaimingLimitInfoProps {
  limits: ClaimingLimitsInfo;
  showBoundaries?: boolean;
  showCadence?: boolean;
  compact?: boolean;
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
 * Format date to short format
 */
function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Get warning level based on utilization percentage
 */
function getUtilizationStatus(
  percent: number
): {
  label: string;
  color: string;
  bg: string;
  icon: string;
} {
  if (percent >= 100) {
    return {
      label: 'Fully Used',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      icon: '⛔',
    };
  }
  if (percent >= 80) {
    return {
      label: 'Almost Full',
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      icon: '⚠️',
    };
  }
  if (percent >= 50) {
    return {
      label: 'Half Used',
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: '📊',
    };
  }
  return {
    label: 'Available',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: '✅',
  };
}

/**
 * Get progress bar color based on utilization
 */
function getProgressBarColor(percent: number): string {
  if (percent >= 100) return 'bg-red-500';
  if (percent >= 80) return 'bg-orange-500';
  if (percent >= 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * ClaimingLimitInfo - Main component
 */
export function ClaimingLimitInfo({
  limits,
  showBoundaries = true,
  showCadence = true,
  compact = false,
  className,
}: ClaimingLimitInfoProps) {
  const utilizationStatus = useMemo(
    () => getUtilizationStatus(limits.percentUtilized),
    [limits.percentUtilized]
  );

  const progressColor = useMemo(
    () => getProgressBarColor(limits.percentUtilized),
    [limits.percentUtilized]
  );

  const displayPercentage = Math.min(limits.percentUtilized, 100);

  if (compact) {
    // Compact view (single line, suitable for cards)
    return (
      <div className={`flex items-center justify-between gap-2 ${className || ''}`}>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatCurrency(limits.remainingAmount)} available
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {limits.periodLabel}
          </p>
        </div>

        {/* Mini progress bar */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColor} transition-all duration-300`}
              style={{ width: `${displayPercentage}%` }}
              role="progressbar"
              aria-valuenow={Math.round(displayPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${Math.round(displayPercentage)}% of ${formatCurrency(limits.maxClaimableAmount)} claimed`}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-8 text-right">
            {Math.round(displayPercentage)}%
          </span>
        </div>
      </div>
    );
  }

  // Full view (for modals and detail pages)
  return (
    <div
      className={`
        rounded-lg border border-gray-200 dark:border-gray-700
        p-4 space-y-4 ${className || ''}
      `}
    >
      {/* Header with status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Claiming Details
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Current period: {limits.periodLabel}
          </p>
        </div>

        {/* Utilization status badge */}
        <div
          className={`
            inline-flex items-center gap-2 px-3 py-1 rounded-full
            text-sm font-medium ${utilizationStatus.bg} ${utilizationStatus.color}
          `}
        >
          <span>{utilizationStatus.icon}</span>
          {utilizationStatus.label}
        </div>
      </div>

      {/* Available amounts section */}
      <div className="grid grid-cols-3 gap-4">
        {/* Available */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Available
          </p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
            {formatCurrency(limits.remainingAmount)}
          </p>
        </div>

        {/* Used */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Used
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(limits.alreadyClaimedAmount)}
          </p>
        </div>

        {/* Total */}
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Total
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(limits.maxClaimableAmount)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Usage Progress
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {Math.round(displayPercentage)}%
          </span>
        </div>

        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-300`}
            role="progressbar"
            aria-valuenow={Math.round(displayPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(displayPercentage)}% of ${formatCurrency(limits.maxClaimableAmount)} claimed`}
            style={{ width: `${displayPercentage}%` }}
          />
        </div>
      </div>

      {/* Period boundaries */}
      {showBoundaries && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
            Period Dates
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Starts</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDateShort(limits.periodStart)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ends</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDateShort(limits.periodEnd)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cadence info */}
      {showCadence && limits.claimingCadence && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Claiming Cadence
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
            {formatClaimingCadence(limits.claimingCadence)}
          </p>
        </div>
      )}

      {/* Warning message if near/at limit */}
      {limits.percentUtilized >= 80 && (
        <div
          className={`
            rounded-lg p-3 border border-current
            ${
              limits.percentUtilized >= 100
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300'
            }
          `}
        >
          <p className="text-sm font-medium">
            {limits.percentUtilized >= 100
              ? '⛔ You have fully used this period\'s limit.'
              : '⚠️ You\'re approaching this period\'s limit.'}
          </p>
          {limits.percentUtilized < 100 && limits.remainingAmount > 0 && (
            <p className="text-xs mt-1 opacity-90">
              Only {formatCurrency(limits.remainingAmount)} remaining.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Format claiming cadence for display
 */
function formatClaimingCadence(cadence: string): string {
  const labels: Record<string, string> = {
    MONTHLY: 'Monthly - Resets on the 1st of each month',
    QUARTERLY: 'Quarterly - Resets at the start of each quarter',
    SEMI_ANNUAL: 'Semi-Annual - Resets twice per year',
    FLEXIBLE_ANNUAL: 'Flexible Annual - Available throughout the year',
    ONE_TIME: 'One-Time - Can only be claimed once',
  };

  return labels[cadence] || cadence;
}

export default ClaimingLimitInfo;
