'use client';

/**
 * ResetIndicator Component
 * 
 * Displays when a benefit resets/expires with color-coded urgency.
 * 
 * Features:
 * - Shows reset date in "Month Day" format
 * - Appends day count when < 7 days remain
 * - Color-coded by urgency:
 *   - 7+ days: Gray (text-gray-600 / dark:text-gray-400)
 *   - 3-7 days: Orange warning (text-orange-600 / dark:text-orange-400)
 *   - < 3 days: Red urgent (text-red-600 / dark:text-red-400)
 * - Icon + text (never color alone)
 * - Renders nothing for OneTime benefits or null expiration
 * - WCAG 2.1 AA compliant
 */

import React from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import {
  getDaysUntilExpiration,
  isExpired,
  formatDateForUser,
} from '../../lib/benefitDates';
import { isUrgent, isWarning } from '../../lib/benefitFilters';
import type { ResetIndicatorProps } from '../../types/filters';

export const ResetIndicator = React.memo(function ResetIndicator({
  resetCadence,
  expirationDate,
  isExpired: expiredProp,
}: ResetIndicatorProps) {
  // OneTime benefits don't reset, render nothing
  if (resetCadence === 'OneTime' || !expirationDate) {
    return null;
  }

  // Convert string date to Date object if needed
  const expDate = typeof expirationDate === 'string' ? new Date(expirationDate) : expirationDate;

  // Check if the benefit has expired
  const hasExpired = expiredProp ?? isExpired(expDate);

  // If already expired, render nothing (should be handled by status badge)
  if (hasExpired) {
    return null;
  }

  // Get days remaining
  const daysRemaining = getDaysUntilExpiration(expDate);

  // If perpetual (Infinity days), render nothing
  if (!isFinite(daysRemaining)) {
    return null;
  }

  // Format the reset date
  const formattedDate = formatDateForUser(expDate);

  // Determine urgency level
  const urgent = isUrgent(daysRemaining);
  const warning = isWarning(daysRemaining);

  // Determine colors based on urgency
  const getColors = () => {
    if (urgent) {
      return {
        text: 'text-red-600 dark:text-red-400',
        icon: 'text-red-600 dark:text-red-400',
        aria: 'Urgent: ',
      };
    }
    if (warning) {
      return {
        text: 'text-orange-600 dark:text-orange-400',
        icon: 'text-orange-600 dark:text-orange-400',
        aria: 'Warning: ',
      };
    }
    return {
      text: 'text-gray-600 dark:text-gray-400',
      icon: 'text-gray-600 dark:text-gray-400',
      aria: '',
    };
  };

  const colors = getColors();
  const IconComponent = urgent ? AlertCircle : Clock;

  // Build aria label for screen readers
  const ariaLabel = `${colors.aria}Resets ${formattedDate}${
    daysRemaining < 7 ? ` in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}` : ''
  }`;

  return (
    <div
      className={`flex items-center gap-2 text-sm ${colors.text}`}
      role="status"
      aria-label={ariaLabel}
    >
      <IconComponent
        size={16}
        className={`flex-shrink-0 ${colors.icon}`}
        aria-hidden="true"
      />
      <span>
        Resets <span className="font-medium">{formattedDate}</span>
        {daysRemaining < 7 && (
          <>
            {' '}
            <span className={urgent ? 'font-bold' : 'font-medium'}>
              ({daysRemaining} day{daysRemaining === 1 ? '' : 's'})
            </span>
          </>
        )}
      </span>
    </div>
  );
});

ResetIndicator.displayName = 'ResetIndicator';
export default ResetIndicator;
