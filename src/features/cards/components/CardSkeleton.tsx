'use client';

/**
 * CardSkeleton Component
 * 
 * Displays a loading skeleton that mimics the appearance of a card component.
 * Used during data loading to improve perceived performance and user experience.
 * 
 * Accessibility: Includes aria-busy and aria-label to indicate loading state to screen readers
 */
export function CardSkeleton() {
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
      aria-label="Loading card..."
    >
      {/* Card header */}
      <div className="mb-4 space-y-2">
        <div className="h-6 w-3/4 rounded bg-[var(--color-text)] opacity-20" />
        <div className="h-4 w-1/2 rounded bg-[var(--color-text)] opacity-10" />
      </div>

      {/* Card stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="h-3 w-full rounded bg-[var(--color-text)] opacity-15" />
          <div className="h-5 w-2/3 rounded bg-[var(--color-text)] opacity-20" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full rounded bg-[var(--color-text)] opacity-15" />
          <div className="h-5 w-2/3 rounded bg-[var(--color-text)] opacity-20" />
        </div>
      </div>

      {/* Card footer */}
      <div className="mt-4 h-8 rounded bg-[var(--color-primary)] opacity-20" />
    </div>
  );
}

export default CardSkeleton;
