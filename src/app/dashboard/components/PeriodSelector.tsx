'use client';

import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Period option for the dashboard view
 */
export interface PeriodOption {
  id: string;
  label: string;
  displayLabel: string; // What user sees (e.g., "May 2026")
  getDateRange: () => { start: Date; end: Date };
}

/**
 * Props for PeriodSelector component
 */
interface PeriodSelectorProps {
  selectedPeriodId: string;
  onPeriodChange: (periodId: string) => void;
  periods: PeriodOption[];
}

/**
 * PeriodSelector Component
 *
 * Allows users to select the time period for viewing benefits.
 * Options include: This Month, This Quarter, This Half, Full Year, All Time
 *
 * Features:
 * - Custom styled select with semantic colors
 * - Dark mode support
 * - Accessible ARIA labels
 * - Responsive design
 *
 * Uses React 19 patterns:
 * - Ref as prop (no forwardRef needed)
 * - Controlled input with onChange
 * - useMemo for performance (period range calculation)
 * - CSS variables for styling
 */
export function PeriodSelector({
  selectedPeriodId,
  onPeriodChange,
  periods,
}: PeriodSelectorProps) {
  // Memoize period display to avoid recalculation
  const periodDisplay = useMemo(() => {
    const selected = periods.find((p) => p.id === selectedPeriodId);
    return selected?.displayLabel || 'Loading...';
  }, [selectedPeriodId, periods]);

  return (
    <div className="flex items-center gap-2" style={{ gap: 'var(--space-sm)' }}>
      <label 
        htmlFor="period-select" 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}
      >
        Period:
      </label>
      <div className="relative inline-block">
        <select
          id="period-select"
          value={selectedPeriodId}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="appearance-none border rounded-lg text-sm font-medium cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 px-3 py-2 pr-10"
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            fontSize: 'var(--text-body-sm)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: 'var(--radius-md)',
          }}
          aria-label="Select time period"
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-primary-light)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute pointer-events-none"
          size={16}
          style={{ 
            color: 'var(--color-text-secondary)',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </div>
      <span 
        className="text-sm ml-2"
        style={{ 
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-body-sm)',
          marginLeft: 'var(--space-sm)',
        }}
      >
        {periodDisplay}
      </span>
    </div>
  );
}
