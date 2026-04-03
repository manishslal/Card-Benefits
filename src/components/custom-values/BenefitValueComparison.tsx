/**
 * src/components/custom-values/BenefitValueComparison.tsx
 *
 * Side-by-side display of benefit values with comparison metrics.
 * Shows sticker vs custom value, difference amount/percent, ROI impact,
 * and visual indicators for significant differences.
 *
 * Design:
 * - Grid layout: Master value | Custom value | Difference
 * - Visual indicators: Color coding (green = saving, red = higher)
 * - Significant difference highlight: > 10% change
 * - ROI comparison: Before/after ROI change
 * - Responsive: Stacks on mobile, side-by-side on desktop
 * - Accessibility: ARIA labels, semantic HTML, sufficient contrast
 */

'use client';

import React from 'react';
import { formatCurrencyDisplay, calculateDifference, isSignificantlyDifferent } from '@/lib/custom-values/validation';
import type { BenefitValueComparisonProps } from '@/lib/types/custom-values';

/**
 * BenefitValueComparison Component
 * Displays side-by-side comparison of sticker vs custom benefit values
 */
export const BenefitValueComparison: React.FC<BenefitValueComparisonProps> = ({
  benefitName,
  stickerValue,
  customValue,
  effectiveValue,
  benefitROI,
  cardROI,
  previousCardROI,
  showHistory = false,
  onHistoryClick,
}) => {
  // Calculate difference
  const difference = calculateDifference(effectiveValue, stickerValue);
  const isSignificant = isSignificantlyDifferent(effectiveValue, stickerValue);
  const isSavingMoney = difference.amount < 0;

  // ROI change
  const roiChange = previousCardROI ? cardROI - previousCardROI : 0;
  const roiChangeDisplay =
    roiChange > 0
      ? `↑ ${roiChange.toFixed(2)}%`
      : roiChange < 0
        ? `↓ ${Math.abs(roiChange).toFixed(2)}%`
        : '−';

  return (
    <div
      className={`
        p-4 rounded-lg border-2 transition-colors duration-150
        ${
          isSignificant
            ? 'border-yellow-300 bg-yellow-50'
            : 'border-gray-200 bg-white'
        }
      `}
      role="region"
      aria-label={`Value comparison for ${benefitName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{benefitName}</h3>
        {showHistory && (
          <button
            onClick={onHistoryClick}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
            aria-label={`View value history for ${benefitName}`}
          >
            History
          </button>
        )}
      </div>

      {/* Main comparison grid */}
      <div className="grid grid-cols-3 gap-4 mb-4 md:grid-cols-3">
        {/* Master Value */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Master Value
          </label>
          <div className="text-lg font-bold text-gray-900">
            {formatCurrencyDisplay(stickerValue)}
          </div>
          <p className="text-xs text-gray-500">Sticker price</p>
        </div>

        {/* Custom Value */}
        {customValue ? (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Your Value
            </label>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrencyDisplay(customValue)}
            </div>
            <p className="text-xs text-gray-500">Your estimate</p>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Your Value
            </label>
            <div className="text-lg font-bold text-gray-400">Not set</div>
            <p className="text-xs text-gray-500">Using master</p>
          </div>
        )}

        {/* Difference */}
        {customValue && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Difference
            </label>
            <div
              className={`
                text-lg font-bold
                ${isSavingMoney ? 'text-green-600' : 'text-red-600'}
              `}
              role="status"
              aria-label={`Difference: ${isSavingMoney ? 'saving' : 'higher'} ${formatCurrencyDisplay(Math.abs(difference.amount))}`}
            >
              {isSavingMoney ? '−' : '+'}
              {formatCurrencyDisplay(Math.abs(difference.amount))}
            </div>
            <p className="text-xs text-gray-500">
              {difference.percentDisplay}%
            </p>
          </div>
        )}
      </div>

      {/* ROI Impact Section */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          ROI Impact
        </h4>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          {/* Benefit ROI */}
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Benefit ROI</p>
            <p className="text-sm font-bold text-gray-900">
              {benefitROI.toFixed(2)}%
            </p>
          </div>

          {/* Card ROI */}
          <div className="space-y-1">
            <p className="text-xs text-gray-600">Card ROI</p>
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold text-gray-900">
                {cardROI.toFixed(2)}%
              </p>
              {previousCardROI && (
                <p
                  className={`
                    text-xs font-semibold
                    ${roiChange > 0 ? 'text-red-600' : roiChange < 0 ? 'text-green-600' : 'text-gray-500'}
                  `}
                  role="status"
                  aria-label={`ROI changed by ${roiChangeDisplay}`}
                >
                  {roiChangeDisplay}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Significant Difference Alert */}
      {isSignificant && (
        <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-400 rounded">
          <p className="text-xs font-medium text-yellow-800">
            ⚠️ This value differs significantly from the master value. Review to ensure it's accurate.
          </p>
        </div>
      )}

      {/* Value Type Indicator */}
      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-600">
          {customValue ? (
            <span className="text-blue-600 font-medium">
              ✓ Using your custom value
            </span>
          ) : (
            <span className="text-gray-500">Using master value</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default BenefitValueComparison;
