'use client';

import React, { useCallback } from 'react';

/**
 * Status filter options available in the dashboard
 */
export type BenefitStatus = 'active' | 'expiring_soon' | 'used' | 'expired' | 'pending';

export interface StatusOption {
  id: BenefitStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
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
 * Allows users to filter benefits by status using Lucide icons.
 * Replaces emoji icons with professional icon set:
 * - Active: CheckCircle (green)
 * - Expiring: AlertCircle (orange)
 * - Used: CheckCircle2 (blue)
 * - Expired: XCircle (gray)
 * - Pending: Clock (gray)
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
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
      <span 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}
      >
        Status:
      </span>

      {/* Status Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {availableStatuses.map((status) => {
          const isSelected = selectedStatuses.includes(status.id);
          
          return (
            <button
              key={status.id}
              onClick={() => handleStatusToggle(status.id)}
              title={status.description}
              aria-pressed={isSelected}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all duration-200"
              style={{
                backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                borderColor: isSelected ? `var(${status.color})` : 'var(--color-border)',
                color: isSelected ? `var(${status.color})` : 'var(--color-text-secondary)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: `var(${status.color})` }}>
                {status.icon}
              </span>
              <span className="text-sm font-medium">{status.label}</span>
            </button>
          );
        })}
      </div>

      {/* Clear/Select All Buttons */}
      {selectedStatuses.length > 0 && (
        <div className="flex gap-2 text-xs ml-auto">
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
            All
          </button>
        </div>
      )}

      {selectedStatuses.length === 0 && (
        <button
          onClick={handleSelectAll}
          className="text-xs underline transition-colors ml-auto"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-caption)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        >
          All statuses
        </button>
      )}
    </div>
  );
}
