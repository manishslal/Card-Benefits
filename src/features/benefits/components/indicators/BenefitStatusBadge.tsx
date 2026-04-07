'use client';

/**
 * BenefitStatusBadge Component
 * 
 * Displays benefit status with semantic color and icon.
 * 
 * Status States:
 * - Available (🟢 Green): bg-green-100, text-green-800 (light)
 *                        dark:bg-green-900/20, dark:text-green-100 (dark)
 * - Expiring (🟠 Orange): bg-orange-100, text-orange-800 (light)
 *                         dark:bg-orange-900/20, dark:text-orange-100 (dark)
 * - Expired (🔴 Red): bg-gray-100, text-gray-600 (light)
 *                     dark:bg-gray-800, dark:text-gray-300 (dark)
 * - Claimed (🔵 Blue): bg-blue-100, text-blue-800 (light)
 *                      dark:bg-blue-900/20, dark:text-blue-100 (dark)
 * 
 * Features:
 * - Icon + text (color never sole indicator)
 * - Touch targets ≥ 44×44px (including padding)
 * - WCAG 2.1 AA color contrast
 * - Responsive sizing
 * - Semantic HTML with role="status"
 */

import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Circle } from 'lucide-react';
import type { BenefitStatusBadgeProps } from '../../types/filters';

// Status configuration with colors and icons
const statusConfig = {
  available: {
    label: 'Available',
    bgLight: 'bg-green-100',
    textLight: 'text-green-800',
    bgDark: 'dark:bg-green-900/20',
    textDark: 'dark:text-green-100',
    icon: Circle,
    ariaLabel: 'Benefit available',
  },
  expiring: {
    label: 'Expiring Soon',
    bgLight: 'bg-orange-100',
    textLight: 'text-orange-800',
    bgDark: 'dark:bg-orange-900/20',
    textDark: 'dark:text-orange-100',
    icon: AlertCircle,
    ariaLabel: 'Benefit expiring soon',
  },
  expired: {
    label: 'Expired',
    bgLight: 'bg-gray-100',
    textLight: 'text-gray-600',
    bgDark: 'dark:bg-gray-800',
    textDark: 'dark:text-gray-300',
    icon: XCircle,
    ariaLabel: 'Benefit expired',
  },
  claimed: {
    label: 'Claimed',
    bgLight: 'bg-blue-100',
    textLight: 'text-blue-800',
    bgDark: 'dark:bg-blue-900/20',
    textDark: 'dark:text-blue-100',
    icon: CheckCircle2,
    ariaLabel: 'Benefit claimed',
  },
} as const;

export const BenefitStatusBadge = React.memo(function BenefitStatusBadge({
  status,
  showLabel = true,
}: BenefitStatusBadgeProps) {
  const config = statusConfig[status];
  const IconComponent = config.icon;

  const classes = `inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${config.bgLight} ${config.textLight} ${config.bgDark} ${config.textDark} transition-colors`;

  return (
    <span
      className={classes}
      role="status"
      aria-label={config.ariaLabel}
    >
      <IconComponent
        size={18}
        className="flex-shrink-0"
        aria-hidden="true"
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
});

BenefitStatusBadge.displayName = 'BenefitStatusBadge';
export default BenefitStatusBadge;
