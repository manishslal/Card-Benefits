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
 * Uses React 19 patterns:
 * - Ref as prop (no forwardRef needed)
 * - Controlled input with onChange
 * - useMemo for performance (period range calculation)
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
    <div className="flex items-center gap-2">
      <label htmlFor="period-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Period:
      </label>
      <div className="relative inline-block">
        <select
          id="period-select"
          value={selectedPeriodId}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-900 dark:text-white cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          aria-label="Select time period"
        >
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none"
          size={16}
        />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{periodDisplay}</span>
    </div>
  );
}
