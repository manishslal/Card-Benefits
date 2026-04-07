'use client';

import React, { useCallback, useState } from 'react';
import { Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { BenefitStatus } from './StatusFilters';

/**
 * Props for BenefitRow component
 */
export interface BenefitRowProps {
  id: string;
  name: string;
  issuer: string;
  cardName?: string;
  status: BenefitStatus;
  periodStart: Date;
  periodEnd: Date;
  available: number;
  used: number;
  resetCadence: string;
  onMarkUsed?: (benefitId: string) => Promise<void>;
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
}

/**
 * Get the appropriate status color and icon for a benefit
 */
function getStatusDisplay(status: BenefitStatus) {
  switch (status) {
    case 'active':
      return { color: 'text-green-600 dark:text-green-400', icon: '🟢', label: 'Active' };
    case 'expiring_soon':
      return { color: 'text-orange-600 dark:text-orange-400', icon: '🟠', label: 'Expiring Soon' };
    case 'used':
      return { color: 'text-gray-600 dark:text-gray-400', icon: '✓', label: 'Used' };
    case 'expired':
      return { color: 'text-red-600 dark:text-red-400', icon: '🔴', label: 'Expired' };
    case 'pending':
      return { color: 'text-blue-600 dark:text-blue-400', icon: '⏳', label: 'Pending' };
    default:
      return { color: 'text-gray-600 dark:text-gray-400', icon: '○', label: 'Unknown' };
  }
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // If same month, show as "May 1-31"
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}`;
  }

  return `${startStr} - ${endStr}`;
}

/**
 * BenefitRow Component
 *
 * Displays a single benefit with:
 * - Name, issuer, card name
 * - Period dates
 * - Available/used amount
 * - Status indicator
 * - Action buttons (Mark Used, Edit, Delete)
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - useState for loading state
 * - Ref not needed for simple DOM elements
 */
export function BenefitRow({
  id,
  name,
  issuer,
  cardName,
  status,
  periodStart,
  periodEnd,
  available,
  used,
  resetCadence,
  onMarkUsed,
  onEdit,
  onDelete,
}: BenefitRowProps) {
  const [isMarkingUsed, setIsMarkingUsed] = useState(false);
  const statusDisplay = getStatusDisplay(status);
  const dateRange = formatDateRange(periodStart, periodEnd);
  const remaining = available - used;
  const percentage = available > 0 ? (used / available) * 100 : 0;

  const handleMarkUsed = useCallback(async () => {
    if (!onMarkUsed) return;
    setIsMarkingUsed(true);
    try {
      await onMarkUsed(id);
    } finally {
      setIsMarkingUsed(false);
    }
  }, [id, onMarkUsed]);

  const handleEdit = useCallback(() => {
    onEdit?.(id);
  }, [id, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete?.(id);
  }, [id, onDelete]);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow">
      {/* Header: Name, Issuer, Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1">
            {name}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {issuer}
            </span>
            {cardName && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                {cardName}
              </span>
            )}
            <span className={`text-xs font-medium ${statusDisplay.color}`}>
              {statusDisplay.icon} {statusDisplay.label}
            </span>
          </div>
        </div>
      </div>

      {/* Period and Amount Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Period</span>
          <p className="text-gray-900 dark:text-white">{dateRange}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Reset Cadence</span>
          <p className="text-gray-900 dark:text-white capitalize text-sm">
            {resetCadence.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Available</span>
          <p className="text-green-600 dark:text-green-400 font-semibold">${available}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Used</span>
          <p className="text-gray-900 dark:text-white">${used}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {available > 0 && (
        <div className="mb-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${
                percentage < 50
                  ? 'bg-green-500'
                  : percentage < 80
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {status !== 'used' && status !== 'expired' && onMarkUsed && (
          <button
            onClick={handleMarkUsed}
            disabled={isMarkingUsed || status === 'pending'}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            aria-busy={isMarkingUsed}
          >
            <CheckCircle2 size={16} />
            {isMarkingUsed ? 'Marking...' : 'Mark Used'}
          </button>
        )}

        {onEdit && (
          <button
            onClick={handleEdit}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Edit2 size={16} />
            Edit
          </button>
        )}

        {onDelete && (
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
