/**
 * CadenceIndicator Component
 *
 * Displays a badge showing the urgency of a benefit claiming deadline.
 * Features:
 * - Color-coded urgency levels (RED/ORANGE/YELLOW/GREEN)
 * - Shows "Expires in X days!" countdown
 * - Animated pulsing for RED (CRITICAL) urgency
 * - Dark mode support
 * - WCAG 2.1 AA compliant with proper ARIA labels
 * - Tooltip with full deadline info
 *
 * @example
 * const limits = {
 *   daysUntilExpiration: 3,
 *   warningLevel: 'CRITICAL',
 *   periodEnd: new Date('2026-03-31'),
 * };
 *
 * <CadenceIndicator limits={limits} />
 */

'use client';

import React, { useMemo } from 'react';
import { UrgencyLevel } from '@/lib/benefit-period-utils';

interface CadenceIndicatorProps {
  daysUntilExpiration: number;
  warningLevel: UrgencyLevel;
  periodEnd: Date;
  claimingCadence?: string;
  className?: string;
}

interface UrgencyStyle {
  bg: string;
  text: string;
  border: string;
  icon: string;
  pulse: boolean;
}

/**
 * Get styling based on urgency level
 */
function getUrgencyStyle(level: UrgencyLevel): UrgencyStyle {
  const styles: Record<UrgencyLevel, UrgencyStyle> = {
    CRITICAL: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      border: 'border-red-200 dark:border-red-700',
      icon: '🔴',
      pulse: true,
    },
    HIGH: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-700 dark:text-orange-300',
      border: 'border-orange-200 dark:border-orange-700',
      icon: '🟠',
      pulse: false,
    },
    MEDIUM: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-700 dark:text-yellow-300',
      border: 'border-yellow-200 dark:border-yellow-700',
      icon: '🟡',
      pulse: false,
    },
    LOW: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      border: 'border-green-200 dark:border-green-700',
      icon: '🟢',
      pulse: false,
    },
  };

  return styles[level];
}

/**
 * Get text label for urgency level
 */
function getUrgencyLabel(level: UrgencyLevel): string {
  const labels: Record<UrgencyLevel, string> = {
    CRITICAL: 'Expires Soon!',
    HIGH: 'Expiring Soon',
    MEDIUM: 'Moderate Urgency',
    LOW: 'Plenty of Time',
  };

  return labels[level];
}

/**
 * Format date for tooltip
 */
function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * CadenceIndicator - Main component
 */
export function CadenceIndicator({
  daysUntilExpiration,
  warningLevel,
  periodEnd,
  claimingCadence,
  className,
}: CadenceIndicatorProps) {
  const urgencyStyle = useMemo(() => getUrgencyStyle(warningLevel), [warningLevel]);
  const urgencyLabel = useMemo(() => getUrgencyLabel(warningLevel), [warningLevel]);

  // Determine if window is closed (0 days left)
  const isWindowClosed = daysUntilExpiration === 0;

  // Create ARIA label with full information
  const ariaLabel = useMemo(() => {
    if (isWindowClosed) {
      return `Deadline has passed. Period ended ${formatDateLong(periodEnd)}`;
    }
    const dayText = daysUntilExpiration === 1 ? 'day' : 'days';
    return `${daysUntilExpiration} ${dayText} remaining. Period ends ${formatDateLong(periodEnd)}. ${urgencyLabel}`;
  }, [daysUntilExpiration, periodEnd, urgencyLabel, isWindowClosed]);

  // Create tooltip text
  const tooltipText = useMemo(() => {
    if (isWindowClosed) {
      return `Deadline passed on ${formatDateLong(periodEnd)}`;
    }
    const dayText = daysUntilExpiration === 1 ? 'day' : 'days';
    return `${daysUntilExpiration} ${dayText} left until ${formatDateLong(periodEnd)}`;
  }, [daysUntilExpiration, periodEnd, isWindowClosed]);

  return (
    <div
      className={`relative inline-flex items-center gap-2 ${className || ''}`}
      aria-label={ariaLabel}
      role="status"
      title={tooltipText}
    >
      {/* Pulsing background for CRITICAL urgency */}
      {urgencyStyle.pulse && !isWindowClosed && (
        <div className="absolute inset-0 rounded-full bg-red-400 opacity-75 animate-pulse" />
      )}

      {/* Badge container */}
      <div
        className={`
          relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          border border-current
          ${urgencyStyle.bg}
          ${urgencyStyle.text}
          text-sm font-semibold
          transition-all duration-200
        `}
      >
        {/* Icon */}
        <span className="text-base" aria-hidden="true">
          {urgencyStyle.icon}
        </span>

        {/* Text content */}
        <div className="flex flex-col items-start">
          {/* Days remaining */}
          <span className="text-xs leading-tight">
            {isWindowClosed ? (
              <span className="font-bold text-red-600 dark:text-red-400">Deadline Passed</span>
            ) : (
              <>
                Expires in{' '}
                <span className="font-bold">
                  {daysUntilExpiration === 1 ? '1 day' : `${daysUntilExpiration} days`}
                </span>
              </>
            )}
          </span>

          {/* Optional: Cadence type */}
          {claimingCadence && (
            <span className="text-xs opacity-75 leading-tight">
              ({formatCadence(claimingCadence)})
            </span>
          )}
        </div>
      </div>

      {/* Accessibility: Hidden live region for announcements */}
      <div className="sr-only" role="alert">
        {tooltipText}
      </div>
    </div>
  );
}

/**
 * Format claiming cadence for display
 */
function formatCadence(cadence: string): string {
  const labels: Record<string, string> = {
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    SEMI_ANNUAL: 'Semi-Annual',
    FLEXIBLE_ANNUAL: 'Flexible Annual',
    ONE_TIME: 'One-Time',
  };

  return labels[cadence] || cadence;
}

export default CadenceIndicator;
