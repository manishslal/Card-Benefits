'use client';

import React, { useCallback, useState } from 'react';
import { Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { BenefitStatus } from './StatusFilters';
import { DashboardButton } from './DashboardButton';
import { getStatusColor } from '../utils/status-colors';

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
 * - Status indicator using semantic colors
 * - Action buttons (Mark Used, Edit, Delete)
 * - Progress bar with status-appropriate colors
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - useState for loading state
 * - Status colors from centralized utility
 * - CSS variables for consistent styling
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
  const statusDisplay = getStatusColor(status);
  const dateRange = formatDateRange(periodStart, periodEnd);
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
    <div 
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3 hover:shadow-md transition-shadow"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {/* Header: Name, Issuer, Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 
            className="font-semibold text-gray-900 dark:text-white text-base mb-1"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {name}
          </h3>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <span 
              className="text-xs px-2 py-1 rounded"
              style={{ 
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)' 
              }}
            >
              {issuer}
            </span>
            {cardName && (
              <span 
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--color-primary)' 
                }}
              >
                {cardName}
              </span>
            )}
            <span 
              className="text-xs font-medium flex items-center gap-1"
              style={statusDisplay.style}
            >
              {statusDisplay.icon} {statusDisplay.label}
            </span>
          </div>
        </div>
      </div>

      {/* Period and Amount Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <span 
            className="text-xs font-medium block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Period
          </span>
          <p style={{ color: 'var(--color-text)' }}>{dateRange}</p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Reset Cadence
          </span>
          <p style={{ color: 'var(--color-text)' }} className="text-sm">
            {resetCadence.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Available
          </span>
          <p 
            className="font-semibold"
            style={{ color: 'var(--color-success)' }}
          >
            ${available}
          </p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Used
          </span>
          <p style={{ color: 'var(--color-text)' }}>${used}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {available > 0 && (
        <div className="mb-4">
          <div 
            className="w-full rounded-full h-2 overflow-hidden"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
          >
            <div
              className="h-full transition-all"
              style={{ 
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: statusDisplay.progressClass.includes('bg-green') 
                  ? 'var(--color-success)'
                  : statusDisplay.progressClass.includes('bg-orange')
                  ? 'var(--color-warning)'
                  : statusDisplay.progressClass.includes('bg-red')
                  ? 'var(--color-error)'
                  : 'var(--color-text-secondary)'
              }}
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
          <DashboardButton
            variant="primary"
            size="md"
            onClick={handleMarkUsed}
            disabled={isMarkingUsed || status === 'pending'}
            isLoading={isMarkingUsed}
            icon={<CheckCircle2 size={16} />}
            aria-busy={isMarkingUsed}
          >
            {isMarkingUsed ? 'Marking...' : 'Mark Used'}
          </DashboardButton>
        )}

        {onEdit && (
          <DashboardButton
            variant="secondary"
            size="md"
            onClick={handleEdit}
            icon={<Edit2 size={16} />}
          >
            Edit
          </DashboardButton>
        )}

        {onDelete && (
          <DashboardButton
            variant="danger"
            size="md"
            onClick={handleDelete}
            icon={<Trash2 size={16} />}
          >
            Delete
          </DashboardButton>
        )}
      </div>
    </div>
  );
}
