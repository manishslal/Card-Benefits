'use client';

import React, { useCallback } from 'react';
import { DashboardButton } from './DashboardButton';

/**
 * Status filter options available in the dashboard
 */
export type BenefitStatus = 'active' | 'expiring_soon' | 'used' | 'expired' | 'pending';

export interface StatusOption {
  id: BenefitStatus;
  label: string;
  icon: string;
  description: string;
}

/**
 * Props for StatusFilters component
 */
interface StatusFiltersProps {
  selectedStatuses: BenefitStatus[];
  onStatusChange: (statuses: BenefitStatus[]) => void;
  availableStatuses: StatusOption[];
}

/**
 * StatusFilters Component
 *
 * Allows users to filter benefits by status (Active, Expiring, Used, etc.)
 * Supports multi-select with AND logic combining multiple filters.
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - Controlled checkboxes with onChange
 * - Accessible ARIA labels
 * - DashboardButton component for consistent styling
 */
export function StatusFilters({
  selectedStatuses,
  onStatusChange,
  availableStatuses,
}: StatusFiltersProps) {
  const handleStatusToggle = useCallback(
    (status: BenefitStatus) => {
      if (selectedStatuses.includes(status)) {
        onStatusChange(selectedStatuses.filter((s) => s !== status));
      } else {
        onStatusChange([...selectedStatuses, status]);
      }
    },
    [selectedStatuses, onStatusChange]
  );

  const handleClearAll = useCallback(() => {
    onStatusChange([]);
  }, [onStatusChange]);

  const handleSelectAll = useCallback(() => {
    onStatusChange(availableStatuses.map((s) => s.id));
  }, [availableStatuses, onStatusChange]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        Filters:
      </span>

      {/* Status Filter Buttons - Using DashboardButton for consistency */}
      <div className="flex flex-wrap gap-2">
        {availableStatuses.map((status) => (
          <DashboardButton
            key={status.id}
            variant={selectedStatuses.includes(status.id) ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleStatusToggle(status.id)}
            title={status.description}
            aria-pressed={selectedStatuses.includes(status.id)}
          >
            <span className="mr-1">{status.icon}</span>
            {status.label}
          </DashboardButton>
        ))}
      </div>

      {/* Clear/Select All Buttons */}
      {selectedStatuses.length > 0 && (
        <div className="flex gap-2 text-xs">
          <button
            onClick={handleClearAll}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
          >
            Clear
          </button>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <button
            onClick={handleSelectAll}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
          >
            Select All
          </button>
        </div>
      )}

      {selectedStatuses.length === 0 && (
        <button
          onClick={handleSelectAll}
          className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
        >
          Select filters
        </button>
      )}
    </div>
  );
}
