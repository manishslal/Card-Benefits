/**
 * BenefitUsageProgress Component
 *
 * Visual progress bar showing benefit usage with urgency-based coloring.
 * Features:
 * - Color-coded by urgency (RED if over, ORANGE if >80%, YELLOW if >50%, GREEN if <50%)
 * - Shows "X claimed / Y total" text
 * - Responsive width
 * - Full ARIA support for accessibility
 * - Dark mode support
 * - E-5: Color-blind safe text labels and optional stripe patterns
 *
 * @example
 * <BenefitUsageProgress
 *   used={1000}
 *   limit={1500}
 *   urgencyLevel="MEDIUM"
 * />
 */

'use client';

import React, { useMemo } from 'react';
import { UrgencyLevel } from '@/lib/benefit-period-utils';

interface BenefitUsageProgressProps {
  used: number; // in cents
  limit: number; // in cents
  urgencyLevel?: UrgencyLevel;
  showLabel?: boolean;
  showPercentage?: boolean;
  responsive?: boolean;
  className?: string;
  ariaLabel?: string;
}

interface ProgressStyle {
  barColor: string;
  bgColor: string;
  textColor: string;
  status: string;
  /** E-5: Optional CSS background-image for stripe pattern (color-blind indicator) */
  stripePattern?: string;
}

/**
 * Get styling based on percentage used
 * E-5: Includes text status labels and optional stripe patterns for color-blind safety
 */
function getProgressStyle(percent: number): ProgressStyle {
  if (percent >= 100) {
    return {
      barColor: 'bg-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-300',
      status: 'Over limit',
      stripePattern:
        'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 6px)',
    };
  }
  if (percent >= 80) {
    return {
      barColor: 'bg-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-700 dark:text-orange-300',
      status: 'Nearly full',
      stripePattern:
        'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(255,255,255,0.18) 4px, rgba(255,255,255,0.18) 8px)',
    };
  }
  if (percent >= 50) {
    return {
      barColor: 'bg-yellow-500',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      status: 'Half used',
    };
  }
  return {
    barColor: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    status: 'On Track',
  };
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
 * BenefitUsageProgress - Main component
 */
export function BenefitUsageProgress({
  used,
  limit,
  urgencyLevel,
  showLabel = true,
  showPercentage = true,
  responsive = true,
  className,
  ariaLabel,
}: BenefitUsageProgressProps) {
  // Calculate percentage
  const percentage = useMemo(() => {
    if (limit === 0) return 0;
    return (used / limit) * 100;
  }, [used, limit]);

  // Clamp displayed percentage to 100 for visual display
  const displayPercentage = useMemo(() => Math.min(percentage, 100), [percentage]);

  // Get styling
  const style = useMemo(() => getProgressStyle(percentage), [percentage]);

  // Handle no limit case
  if (!limit || limit === 0) {
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className || ''}`}>
        No limit set for this benefit
      </div>
    );
  }

  return (
    <div className={`w-full ${className || ''}`}>
      {/* Header with label, percentage, and E-5 status label */}
      {(showLabel || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {showLabel && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Usage
            </span>
          )}
          <div className="flex items-center gap-2">
            {/* E-5: Color-blind safe text status label */}
            <span
              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${style.textColor}`}
              style={{
                backgroundColor:
                  percentage >= 100
                    ? 'rgba(239, 68, 68, 0.1)'
                    : percentage >= 80
                      ? 'rgba(249, 115, 22, 0.1)'
                      : percentage >= 50
                        ? 'rgba(234, 179, 8, 0.1)'
                        : 'rgba(34, 197, 94, 0.1)',
              }}
            >
              {style.status}
            </span>
            {showPercentage && (
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {Math.round(displayPercentage)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar container */}
      <div
        className={`
          rounded-full h-3 bg-gray-200 dark:bg-gray-700 overflow-hidden
          ${responsive ? 'w-full' : ''}
          transition-all duration-300
        `}
      >
        {/* Progress bar fill — E-5: optional stripe pattern for warning/danger */}
        <div
          className={`
            h-full ${style.barColor} transition-all duration-300
            ${displayPercentage >= 100 ? 'animate-pulse' : ''}
          `}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={
            ariaLabel ||
            `${Math.round(percentage)}% of ${formatCurrency(limit)} claimed. ${formatCurrency(used)} used. Status: ${style.status}.`
          }
          style={{
            width: `${displayPercentage}%`,
            ...(style.stripePattern ? { backgroundImage: style.stripePattern } : {}),
          }}
        />
      </div>

      {/* Amount text */}
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          {formatCurrency(used)} claimed
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          of {formatCurrency(limit)} total
        </span>
      </div>

      {/* Over limit warning */}
      {percentage > 100 && (
        <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            ⚠️ Over limit by {formatCurrency(used - limit)}
          </p>
        </div>
      )}

      {/* Urgency indicator (optional) */}
      {urgencyLevel && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium capitalize">{formatUrgency(urgencyLevel)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Format urgency level for display
 */
function formatUrgency(level: UrgencyLevel): string {
  const labels: Record<UrgencyLevel, string> = {
    CRITICAL: '🔴 Critical - expires very soon',
    HIGH: '🟠 High - expires soon',
    MEDIUM: '🟡 Medium - expires in 2-4 weeks',
    LOW: '🟢 Low - plenty of time',
  };

  return labels[level] || level;
}

export default BenefitUsageProgress;
