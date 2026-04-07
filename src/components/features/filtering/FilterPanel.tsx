/**
 * FilterPanel - Advanced filtering UI for benefits
 * Mobile responsive with support for multiple filter types
 */

'use client';

import React, { useState } from 'react';
import { FilterCriteria } from '@/types/benefits';

interface FilterPanelProps {
  onFilter: (criteria: FilterCriteria) => void;
  benefitCount?: number;
  filteredCount?: number;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'used', label: 'Used' },
];

const CADENCE_OPTIONS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'CARDMEMBER_YEAR', label: 'Card Member Year' },
  { value: 'ONE_TIME', label: 'One-Time' },
];

export function FilterPanel({
  onFilter,
  benefitCount = 0,
  filteredCount = 0,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({});

  const handleStatusChange = (status: string) => {
    const updated = filters.status || [];
    const newStatus = updated.includes(status)
      ? updated.filter((s) => s !== status)
      : [...updated, status];

    const newFilters = { ...filters, status: newStatus.length > 0 ? newStatus : undefined };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleCadenceChange = (cadence: string) => {
    const updated = filters.resetCadence || [];
    const newCadence = updated.includes(cadence)
      ? updated.filter((c) => c !== cadence)
      : [...updated, cadence];

    const newFilters = { ...filters, resetCadence: newCadence.length > 0 ? newCadence : undefined };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleValueChange = (type: 'min' | 'max', value: string) => {
    const numValue = value ? parseInt(value) : undefined;
    const newFilters = {
      ...filters,
      ...(type === 'min' ? { minValue: numValue } : { maxValue: numValue }),
    };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const handleSearchChange = (search: string) => {
    const newFilters = {
      ...filters,
      searchTerm: search || undefined,
    };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilter({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      {/* Mobile Header */}
      <div className="lg:hidden p-4 flex items-center justify-between border-b border-gray-200 dark:border-slate-700">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 font-medium text-gray-900 dark:text-white"
        >
          🔍 Filters
          {hasActiveFilters && (
            <span className="inline-block px-2 py-1 text-xs bg-blue-500 text-white rounded-full">
              {Object.keys(filters).filter((k) => filters[k as keyof FilterCriteria] !== undefined).length}
            </span>
          )}
        </button>
      </div>

      {/* Filter Content */}
      <div
        className={`${
          isOpen ? 'block' : 'hidden'
        } lg:block p-4 space-y-4 max-h-96 overflow-y-auto`}
      >
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search benefits..."
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Status
          </label>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.status?.includes(option.value) || false}
                  onChange={() => handleStatusChange(option.value)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Cadence Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Reset Cadence
          </label>
          <div className="space-y-2">
            {CADENCE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.resetCadence?.includes(option.value) || false}
                  onChange={() => handleCadenceChange(option.value)}
                  className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Value Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Value Range (cents)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.minValue || ''}
              onChange={(e) => handleValueChange('min', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
            <input
              type="number"
              placeholder="Max"
              value={filters.maxValue || ''}
              onChange={(e) => handleValueChange('max', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="w-full px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Results Count */}
      {benefitCount > 0 && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700/50 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredCount} of {benefitCount} benefits
        </div>
      )}
    </div>
  );
}
