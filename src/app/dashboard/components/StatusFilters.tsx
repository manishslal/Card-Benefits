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
    <div className="flex flex-wrap items-center gap-3" style={{ gap: 'var(--space-md)' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}>
        Filters:
      </span>

      {/* Status Filter Buttons - Using DashboardButton for consistency */}
      <div className="flex flex-wrap gap-2" style={{ gap: 'var(--space-sm)' }}>
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
        <div className="flex gap-2 text-xs" style={{ gap: 'var(--space-sm)' }}>
          <button
            onClick={handleClearAll}
            className="underline transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Clear
          </button>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <button
            onClick={handleSelectAll}
            className="underline transition-colors"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Select All
          </button>
        </div>
      )}

      {selectedStatuses.length === 0 && (
        <button
          onClick={handleSelectAll}
          className="text-xs underline transition-colors"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-caption)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
          Select filters
        </button>
      )}
    </div>
  );
}
