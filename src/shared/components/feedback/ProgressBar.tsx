'use client';

import React from 'react';

interface ProgressBarProps {
  progress: number;       // 0-100
  label?: string;        // "Step 2 of 5"
  showPercentage?: boolean;
  animated?: boolean;
  className?: string;
}

/**
 * ProgressBar Component - Multi-Step Form Progress Indicator
 * 
 * Displays horizontal progress bar with optional label and percentage.
 * Used in multi-step forms to show completion status.
 * 
 * WCAG 2.1 Compliance:
 * - role="progressbar" for semantic meaning
 * - aria-valuenow, aria-valuemin, aria-valuemax for screen readers
 * - aria-label for descriptive text
 * - Proper contrast in light and dark modes
 * - Clear visual indication of progress
 */
const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      progress,
      label,
      showPercentage = true,
      animated = true,
      className = '',
    },
    ref
  ) => {
    // Clamp progress between 0-100
    const validProgress = Math.min(Math.max(progress, 0), 100);

    return (
      <div
        ref={ref}
        className={className}
        aria-label={label || 'Progress'}
      >
        {/* Label Row */}
        {(label || showPercentage) && (
          <div className="flex justify-between items-center mb-2">
            {label && (
              <span className="text-sm font-medium text-[var(--color-text)]">
                {label}
              </span>
            )}
            {showPercentage && (
              <span
                className="text-sm font-semibold text-[var(--color-primary)]"
                aria-label={`${validProgress} percent complete`}
              >
                {validProgress}%
              </span>
            )}
          </div>
        )}

        {/* Progress Bar Track */}
        <div
          className="w-full h-2 rounded-full bg-[var(--color-border)] overflow-hidden"
          role="progressbar"
          aria-valuenow={validProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || 'Progress bar'}
        >
          {/* Progress Bar Fill */}
          <div
            className={`h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] ${
              animated ? 'transition-all duration-500 ease-out' : ''
            }`}
            style={{
              width: `${validProgress}%`,
            }}
            aria-hidden="true"
          />
        </div>

        {/* Optional Steps Indicator */}
        {label && label.includes('of') && (
          <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
            {label}
          </div>
        )}
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

export default ProgressBar;
