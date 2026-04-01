'use client';

import { useState } from 'react';
import { toggleBenefit } from '@/actions/benefits';

/**
 * BenefitTable Component
 * 
 * Semantic table displaying all benefits for a card
 * 
 * Columns:
 * - Checkbox (left-most, 20px)
 * - Name (40%)
 * - Value (20%)
 * - Expiration (20%)
 * - Status (20%)
 * 
 * Design:
 * - Header row: gray background, 12px uppercase labels
 * - Body rows: conditional coloring based on expiration + usage
 *   - Expiring < 3 days AND not used: danger-50 / red
 *   - Expiring 3-14 days AND not used: alert-50 / orange
 *   - Used: strikethrough text, 60% opacity
 * - Hover: background color change
 * - Semantic <table> for accessibility
 * 
 * Interactions:
 * - Click checkbox to toggle isUsed via toggleBenefit server action
 * - Optimistic UI update (checkbox flips immediately)
 * - Shows loading state during server sync
 * - Handles errors gracefully (revert and show message)
 */

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string; // Can be 'StatementCredit' | 'UsagePerk'
  resetCadence: string;
  timesUsed: number;
}

interface BenefitTableProps {
  benefits: UserBenefit[];
}

/**
 * Get resolved benefit value
 */
function getResolvedValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * Format currency
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format date as "Jan 15, 2024"
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get days until expiration
 */
function getDaysUntilExpiration(date: Date | null): number {
  if (!date) return 999; // No expiration date = far in future
  const now = new Date();
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get status badge color and text
 */
function getStatusBadge(benefit: UserBenefit): {
  text: string;
  color: string;
  bgColor: string;
} {
  if (benefit.isUsed) {
    return {
      text: '✓ Used',
      color: 'var(--color-success-600)',
      bgColor: 'var(--color-success-50)',
    };
  }

  if (!benefit.expirationDate) {
    return {
      text: 'No Expiry',
      color: 'var(--color-text-secondary)',
      bgColor: 'var(--color-bg-tertiary)',
    };
  }

  const daysUntilExpiration = getDaysUntilExpiration(benefit.expirationDate);
  if (daysUntilExpiration < 0) {
    return {
      text: 'Expired',
      color: 'var(--color-danger-600)',
      bgColor: 'var(--color-danger-50)',
    };
  }

  return {
    text: 'Unclaimed',
    color: 'var(--color-text-secondary)',
    bgColor: 'var(--color-bg-tertiary)',
  };
}

/**
 * Get row background color based on expiration + usage
 */
function getRowBackgroundColor(benefit: UserBenefit): string {
  if (benefit.isUsed) {
    return 'var(--color-bg-primary)';
  }

  if (!benefit.expirationDate) {
    return 'var(--color-bg-primary)';
  }

  const daysUntilExpiration = getDaysUntilExpiration(benefit.expirationDate);

  // Critical expiration (< 3 days)
  if (daysUntilExpiration < 3 && daysUntilExpiration >= 0) {
    return 'var(--color-danger-50)';
  }

  // Warning expiration (3-14 days)
  if (daysUntilExpiration < 14) {
    return 'var(--color-alert-50)';
  }

  return 'var(--color-bg-primary)';
}

export default function BenefitTable({ benefits }: BenefitTableProps) {
  const [localBenefits, setLocalBenefits] = useState<UserBenefit[]>(benefits);
  const [loadingBenefitId, setLoadingBenefitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle checkbox toggle
   * - Optimistically update UI
   * - Sync with server
   * - Revert on error
   */
  const handleToggleBenefit = async (benefit: UserBenefit) => {
    const previousBenefits = localBenefits;
    const newIsUsed = !benefit.isUsed;

    // Optimistic update
    setLocalBenefits((prev) =>
      prev.map((b) =>
        b.id === benefit.id ? { ...b, isUsed: newIsUsed } : b
      )
    );
    setLoadingBenefitId(benefit.id);
    setError(null);

    try {
      // Call server action
      const result = await toggleBenefit(benefit.id, benefit.isUsed);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update benefit');
      }
    } catch (err) {
      // Revert on error
      setLocalBenefits(previousBenefits);
      setError(err instanceof Error ? err.message : 'Failed to update benefit');
    } finally {
      setLoadingBenefitId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table
        className="w-full border-collapse"
        style={{
          fontSize: 'var(--font-body-sm)',
        }}
      >
        {/* Table Header */}
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {/* Checkbox column header */}
            <th
              className="p-md text-left font-semibold"
              style={{
                width: '44px',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <input
                type="checkbox"
                disabled
                aria-label="Select all benefits"
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'default',
                  accentColor: 'var(--color-primary-500)',
                }}
              />
            </th>

            {/* Name column */}
            <th
              className="p-md text-left font-semibold"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Benefit
            </th>

            {/* Value column */}
            <th
              className="p-md text-right font-semibold"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Value
            </th>

            {/* Expiration column */}
            <th
              className="p-md text-center font-semibold"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Expires
            </th>

            {/* Status column */}
            <th
              className="p-md text-center font-semibold"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-label)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Status
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {localBenefits.map((benefit) => {
            const daysUntilExpiration = getDaysUntilExpiration(
              benefit.expirationDate
            );
            const statusBadge = getStatusBadge(benefit);
            const rowBgColor = getRowBackgroundColor(benefit);
            const isLoading = loadingBenefitId === benefit.id;

            return (
              <tr
                key={benefit.id}
                style={{
                  backgroundColor: rowBgColor,
                  borderBottom: '1px solid var(--color-border)',
                  opacity: benefit.isUsed ? 0.6 : 1,
                  transition: 'all var(--transition-base)',
                }}
                className="hover:bg-opacity-50"
              >
                {/* Checkbox */}
                <td className="p-md text-center">
                  <input
                    type="checkbox"
                    checked={benefit.isUsed}
                    onChange={() => handleToggleBenefit(benefit)}
                    disabled={isLoading}
                    aria-label={`Mark "${benefit.name}" as ${
                      benefit.isUsed ? 'unused' : 'used'
                    }`}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      accentColor: 'var(--color-primary-500)',
                      opacity: isLoading ? 0.5 : 1,
                    }}
                  />
                </td>

                {/* Benefit Name */}
                <td
                  className="p-md text-left"
                  style={{
                    color: 'var(--color-text-primary)',
                    textDecoration: benefit.isUsed ? 'line-through' : 'none',
                  }}
                >
                  {benefit.name}
                </td>

                {/* Value */}
                <td
                  className="p-md text-right font-medium"
                  style={{
                    color: 'var(--color-text-primary)',
                    textDecoration: benefit.isUsed ? 'line-through' : 'none',
                  }}
                >
                  {formatCurrency(getResolvedValue(benefit))}
                </td>

                {/* Expiration Date */}
                <td
                  className="p-md text-center"
                  style={{
                    color:
                      daysUntilExpiration < 3
                        ? 'var(--color-danger-600)'
                        : daysUntilExpiration < 14
                        ? 'var(--color-alert-600)'
                        : 'var(--color-text-secondary)',
                    fontWeight:
                      daysUntilExpiration < 14 ? '600' : 'normal',
                    textDecoration: benefit.isUsed ? 'line-through' : 'none',
                  }}
                >
                  {formatDate(benefit.expirationDate)}
                </td>

                {/* Status Badge */}
                <td className="p-md text-center">
                  <span
                    className="inline-block px-sm py-xs rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: statusBadge.bgColor,
                      color: statusBadge.color,
                    }}
                  >
                    {statusBadge.text}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Error message */}
      {error && (
        <div
          className="p-md mt-md rounded-md text-sm"
          style={{
            backgroundColor: 'var(--color-danger-50)',
            color: 'var(--color-danger-600)',
            border: '1px solid var(--color-danger-500)',
          }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {localBenefits.length === 0 && (
        <div
          className="p-lg text-center"
          style={{
            color: 'var(--color-text-secondary)',
          }}
        >
          <p className="text-sm">No benefits tracked for this card.</p>
        </div>
      )}
    </div>
  );
}
