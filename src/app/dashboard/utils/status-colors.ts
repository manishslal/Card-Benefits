/**
 * Centralized status color mapping for consistent styling across the dashboard
 * Uses CSS design tokens for light and dark mode support
 */

import { BenefitStatus } from '../components/StatusFilters';

export interface StatusColorConfig {
  icon: string;
  label: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
  progressClass: string;
  borderClass: string;
  style: {
    color: string;
  };
}

export const statusColors: Record<BenefitStatus, StatusColorConfig> = {
  active: {
    icon: '🟢',
    label: 'Active',
    bgClass: 'bg-green-50 dark:bg-green-900/20',
    textClass: 'text-green-700 dark:text-green-300',
    badgeClass: 'bg-green-100 dark:bg-green-900/30',
    progressClass: 'bg-green-500 dark:bg-green-400',
    borderClass: 'border-green-200 dark:border-green-900',
    style: { color: 'var(--color-success)' },
  },
  expiring_soon: {
    icon: '🟠',
    label: 'Expiring Soon',
    bgClass: 'bg-orange-50 dark:bg-orange-900/20',
    textClass: 'text-orange-700 dark:text-orange-300',
    badgeClass: 'bg-orange-100 dark:bg-orange-900/30',
    progressClass: 'bg-orange-500 dark:bg-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-900',
    style: { color: 'var(--color-warning)' },
  },
  used: {
    icon: '✓',
    label: 'Used',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-700 dark:text-gray-300',
    badgeClass: 'bg-gray-100 dark:bg-gray-900/30',
    progressClass: 'bg-gray-500 dark:bg-gray-400',
    borderClass: 'border-gray-200 dark:border-gray-700',
    style: { color: 'var(--color-text-secondary)' },
  },
  expired: {
    icon: '🔴',
    label: 'Expired',
    bgClass: 'bg-red-50 dark:bg-red-900/20',
    textClass: 'text-red-700 dark:text-red-300',
    badgeClass: 'bg-red-100 dark:bg-red-900/30',
    progressClass: 'bg-red-500 dark:bg-red-400',
    borderClass: 'border-red-200 dark:border-red-900',
    style: { color: 'var(--color-error)' },
  },
  pending: {
    icon: '⏳',
    label: 'Pending',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20',
    textClass: 'text-blue-700 dark:text-blue-300',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/30',
    progressClass: 'bg-blue-500 dark:bg-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-900',
    style: { color: 'var(--color-primary)' },
  },
};

/**
 * Get status color configuration by status type
 * @param status - The benefit status
 * @returns StatusColorConfig for the given status
 */
export function getStatusColor(status: BenefitStatus): StatusColorConfig {
  return statusColors[status] || statusColors.pending;
}

/**
 * Get the group color for BenefitGroup component
 * Maps BenefitStatus to color names used by BenefitGroup
 */
export function getGroupColor(
  status: BenefitStatus
): 'green' | 'orange' | 'red' | 'gray' | 'blue' {
  switch (status) {
    case 'active':
      return 'green';
    case 'expiring_soon':
      return 'orange';
    case 'expired':
      return 'red';
    case 'used':
      return 'gray';
    case 'pending':
      return 'blue';
    default:
      return 'gray';
  }
}
