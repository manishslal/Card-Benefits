'use client';

import React from 'react';

export interface PeriodOption {
  id: string;
  label: string;
  displayLabel: string;
  getDateRange: () => { start: Date; end: Date };
}

interface PeriodSelectorProps {
  selectedPeriodId: string;
  onPeriodChange: (periodId: string) => void;
  periods: PeriodOption[];
}

/**
 * PeriodSelector Component
 *
 * Allows users to select a time period for filtering benefits.
 * Displays period options as selectable buttons.
 */
export function PeriodSelector({
  selectedPeriodId,
  onPeriodChange,
  periods,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}
      >
        Period:
      </span>

      {periods.map((period) => {
        const isSelected = period.id === selectedPeriodId;
        
        return (
          <button
            key={period.id}
            onClick={() => onPeriodChange(period.id)}
            className="px-3 py-1.5 rounded-lg border-2 transition-all duration-200 font-medium text-sm"
            style={{
              backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
              borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
            }}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
