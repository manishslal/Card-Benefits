'use client';

import React from 'react';

interface ProgressBarProps {
  percent: number;
  urgency: 'urgent' | 'normal' | 'done';
  className?: string;
}

const urgencyColors: Record<ProgressBarProps['urgency'], string> = {
  normal: 'var(--color-primary)',
  urgent: 'var(--color-warning)',
  done: 'var(--color-success)',
};

/**
 * Thin horizontal progress bar showing period elapsed time.
 * Uses design-token CSS custom properties for colors.
 */
export const ProgressBar = React.memo(function ProgressBar({
  percent,
  urgency,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={`h-1.5 rounded-full ${className}`}
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% of period elapsed`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          backgroundColor: urgencyColors[urgency],
          transition: 'width 500ms ease-out',
        }}
      />
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';
export default ProgressBar;
