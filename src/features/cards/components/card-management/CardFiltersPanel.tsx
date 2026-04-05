/**
 * CardFiltersPanel Component
 *
 * Collapsible panel for advanced filtering by:
 * - Status (checkboxes: Active, Pending, Archived)
 * - Issuer (dropdown + autocomplete)
 * - Annual Fee (range slider)
 * - Renewal Date (date range picker)
 * - Benefits (toggle: has/no benefits)
 * - Saved Filters (dropdown for quick access)
 *
 * TODO: Implement full filter logic in Phase 1
 */

'use client';

import React, { useState } from 'react';
import { CardFilters, SavedFilter } from '@/features/cards/types';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface CardFiltersPanelProps {
  filters: CardFilters;
  savedFilters: SavedFilter[];
  activeFilterCount: number;
  onFiltersChange: (filters: CardFilters) => void;
  onSaveFilter: (name: string) => void;
  onLoadFilter: (filterId: string) => void;
  onClearFilters: () => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

/**
 * CardFiltersPanel Component
 *
 * Advanced filtering interface with multiple filter types
 * and persistence via saved filters.
 *
 * TODO: Complete implementation in Phase 1
 * - Status filter with checkboxes
 * - Issuer filter with autocomplete
 * - Annual fee range slider
 * - Renewal date range picker
 * - Benefits filter toggle
 * - Saved filters management
 */
export function CardFiltersPanel({
  savedFilters,
  activeFilterCount,
  onClearFilters,
  isOpen = true,
  onToggle
}: Partial<CardFiltersPanelProps> & { 
  savedFilters: any[];
  activeFilterCount: number;
  onClearFilters: () => void;
}): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(isOpen);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Header with toggle */}
      <div
        className={clsx(
          'flex items-center justify-between p-4 cursor-pointer',
          'hover:bg-gray-50 dark:hover:bg-gray-800',
          'border-b border-gray-200 dark:border-gray-700'
        )}
        onClick={() => {
          setIsExpanded(!isExpanded);
          onToggle?.();
        }}
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-4 w-4 transition-transform duration-200',
            isExpanded ? 'transform rotate-180' : ''
          )}
        />
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Status Filter - TODO */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Status
            </p>
            <div className="text-sm text-gray-500">
              [Status filter controls coming in Phase 1]
            </div>
          </div>

          {/* Issuer Filter - TODO */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Issuer
            </p>
            <div className="text-sm text-gray-500">
              [Issuer autocomplete coming in Phase 1]
            </div>
          </div>

          {/* Annual Fee Range - TODO */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Annual Fee Range
            </p>
            <div className="text-sm text-gray-500">
              [Fee range slider coming in Phase 1]
            </div>
          </div>

          {/* Renewal Date Range - TODO */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Renewal Date Range
            </p>
            <div className="text-sm text-gray-500">
              [Date range picker coming in Phase 1]
            </div>
          </div>

          {/* Benefits Filter - TODO */}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Benefits
            </p>
            <div className="text-sm text-gray-500">
              [Benefits toggle coming in Phase 1]
            </div>
          </div>

          {/* Saved Filters - TODO */}
          {savedFilters.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Saved Filters
              </p>
              <div className="text-sm text-gray-500">
                [Saved filters dropdown coming in Phase 1]
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              disabled={activeFilterCount === 0}
              className="flex-1"
            >
              Clear All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardFiltersPanel;
