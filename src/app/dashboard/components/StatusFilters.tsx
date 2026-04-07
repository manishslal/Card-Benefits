'use client';

import React, { useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

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
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {availableStatuses.map((status) => (
          <button
            key={status.id}
            onClick={() => handleStatusToggle(status.id)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              border-2 transition-all
              ${
                selectedStatuses.includes(status.id)
                  ? 'bg-blue-100 dark:bg-blue-900 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-100'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
            title={status.description}
            aria-pressed={selectedStatuses.includes(status.id)}
          >
            <span className="mr-1">{status.icon}</span>
            {status.label}
          </button>
        ))}
      </div>

      {/* Clear/Select All Buttons */}
      {selectedStatuses.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
          >
            Clear
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-600">|</span>
          <button
            onClick={handleSelectAll}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
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
