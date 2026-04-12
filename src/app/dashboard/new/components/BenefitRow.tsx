'use client';

import React, { useCallback, useState } from 'react';
import { Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { BenefitStatus } from '../../utils/status-colors';

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
 * Get semantic color and icon for status
 */
function getStatusDisplay(status: BenefitStatus): {
  label: string;
  color: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: 'var(--color-success)',
        icon: <span style={{ display: 'inline-block', color: 'var(--color-success)' }}>●</span>,
      };
    case 'expiring_soon':
      return {
        label: 'Expiring',
        color: 'var(--color-warning)',
        icon: <span style={{ display: 'inline-block', color: 'var(--color-warning)' }}>⚠</span>,
      };
    case 'used':
      return {
        label: 'Used',
        color: 'var(--color-info)',
        icon: <span style={{ display: 'inline-block', color: 'var(--color-info)' }}>✓</span>,
      };
    case 'expired':
      return {
        label: 'Expired',
        color: 'var(--color-text-secondary)',
        icon: <span style={{ display: 'inline-block', color: 'var(--color-text-secondary)' }}>✕</span>,
      };
    case 'pending':
      return {
        label: 'Pending',
        color: 'var(--color-text-secondary)',
        icon: <span style={{ display: 'inline-block', color: 'var(--color-text-secondary)' }}>⏳</span>,
      };
  }
}

/**
 * Format date range for display
 */
function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}`;
  }

  return `${startStr} - ${endStr}`;
}

/**
 * BenefitRow Component
 *
 * Displays a single benefit with:
 * - Name, issuer, card name, status badge
 * - Period dates
 * - Available/used amount with tabular figures
 * - Progress bar with percentage text below (8px gap)
 * - Action buttons (Mark Used, Edit, Delete)
 * - Status-appropriate colors (semantic)
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - useState for loading state
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
  const statusDisplay = getStatusDisplay(status);
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
      className="rounded-lg p-4 mb-3 border transition-all hover:shadow-md"
      style={{ 
        backgroundColor: 'var(--color-bg)', 
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header: Name, Issuer, Status Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 
            className="font-bold text-base mb-1"
            style={{ 
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text)',
            }}
          >
            {name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span 
              className="text-xs px-2 py-1 rounded"
              style={{ 
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {issuer}
            </span>
            {cardName && (
              <span 
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                }}
              >
                {cardName}
              </span>
            )}
            {/* Status Badge */}
            <span 
              className="text-xs font-bold px-2 py-1 rounded inline-flex items-center gap-1"
              style={{
                backgroundColor: `${statusDisplay.color}22`,
                color: statusDisplay.color,
              }}
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
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Period
          </span>
          <p style={{ color: 'var(--color-text)' }}>{dateRange}</p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Cadence
          </span>
          <p style={{ color: 'var(--color-text)' }}>
            {resetCadence.toLowerCase().replace(/_/g, ' ')}
          </p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Available
          </span>
          <p 
            className="font-semibold"
            style={{ 
              color: 'var(--color-success)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ${available.toLocaleString()}
          </p>
        </div>
        <div>
          <span 
            className="text-xs font-medium block mb-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Used
          </span>
          <p 
            style={{ 
              color: 'var(--color-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ${used.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress Bar with Percentage Display */}
      {available > 0 && (
        <div className="mb-4">
          <div 
            className="w-full rounded-full h-2 overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-bg-secondary)',
            }}
          >
            <div
              className="h-full transition-all"
              style={{ 
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: status === 'active' || status === 'expiring_soon'
                  ? 'var(--color-success)'
                  : status === 'used'
                  ? 'var(--color-info)'
                  : 'var(--color-text-secondary)',
                transitionDuration: 'var(--duration-base)',
              }}
              role="progressbar"
              aria-valuenow={Math.round(percentage)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {/* Percentage text - 12px, gray, 8px gap */}
          <p
            className="text-xs mt-2"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: '12px',
              marginTop: '8px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {Math.round(percentage)}% used
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {status !== 'used' && status !== 'expired' && onMarkUsed && (
          <button
            onClick={handleMarkUsed}
            disabled={isMarkingUsed || status === 'pending'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'white',
            }}
            aria-busy={isMarkingUsed}
          >
            <CheckCircle2 size={16} />
            {isMarkingUsed ? 'Marking...' : 'Mark Used'}
          </button>
        )}

        {onEdit && (
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all border"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Edit2 size={16} />
            Edit
          </button>
        )}

        {onDelete && (
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-error)',
            }}
          >
            <Trash2 size={16} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
