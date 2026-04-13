'use client';

/**
 * BenefitSkeleton Component
 * 
 * Displays a loading skeleton that mimics the appearance of a benefit row/card.
 * Used during data loading to improve perceived performance and user experience.
 * 
 * Accessibility: Includes aria-busy and aria-label to indicate loading state to screen readers
 */
export function BenefitSkeleton() {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear',
        borderColor: 'var(--color-border)',
      }}
      aria-busy="true"
      aria-label="Loading benefit..."
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left side - benefit info */}
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-[var(--color-text)] opacity-20" />
          <div className="h-3 w-1/2 rounded bg-[var(--color-text)] opacity-10" />
        </div>

        {/* Right side - status/actions */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded bg-[var(--color-text)] opacity-15" />
          <div className="h-8 w-8 rounded bg-[var(--color-text)] opacity-15" />
        </div>
      </div>
    </div>
  );
}

export default BenefitSkeleton;
