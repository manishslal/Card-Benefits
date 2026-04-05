'use client';

import React from 'react';
import Skeleton from '@/shared/components/ui/Skeleton';

/**
 * CardSkeletons Component - Loading Placeholders for Card Lists
 * 
 * Provides skeleton loaders for different card layouts:
 * - Card Grid: Grid of card placeholders
 * - Card List: List of card placeholders
 * - Card Summary: Summary stats with skeleton loading
 */

interface CardSkeletonsProps {
  variant?: 'grid' | 'list' | 'summary';
  count?: number;
  columns?: number;
}

/**
 * CardGridSkeleton - Skeleton for grid layout cards
 */
export function CardGridSkeleton({ count = 3, columns = 3 }: Omit<CardSkeletonsProps, 'variant'>) {
  return (
    <div className={`grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-${columns} lg:grid-cols-${columns}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 md:p-6 rounded-lg border"
          style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        >
          {/* Card Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <Skeleton variant="text" width="60%" height="24px" className="mb-2" />
              <Skeleton variant="text" width="40%" height="16px" />
            </div>
            <Skeleton variant="circular" width="40px" height="40px" />
          </div>

          {/* Card Details */}
          <div className="space-y-3">
            <div>
              <Skeleton variant="text" width="30%" height="12px" className="mb-2" />
              <Skeleton variant="text" width="100%" height="20px" />
            </div>
            <div>
              <Skeleton variant="text" width="35%" height="12px" className="mb-2" />
              <Skeleton variant="text" width="100%" height="20px" />
            </div>
          </div>

          {/* Card Footer */}
          <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <Skeleton variant="rectangular" width="100%" height="36px" />
            <Skeleton variant="rectangular" width="100%" height="36px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * CardListSkeleton - Skeleton for list layout cards
 */
export function CardListSkeleton({ count = 5 }: Omit<CardSkeletonsProps, 'variant'>) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 md:p-6 rounded-lg border flex items-center justify-between"
          style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        >
          {/* Left: Card Info */}
          <div className="flex-1 flex items-center gap-4">
            <Skeleton variant="circular" width="48px" height="48px" />
            <div className="flex-1">
              <Skeleton variant="text" width="40%" height="20px" className="mb-2" />
              <Skeleton variant="text" width="30%" height="14px" />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex gap-2">
            <Skeleton variant="rectangular" width="40px" height="40px" />
            <Skeleton variant="rectangular" width="40px" height="40px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * SummaryStatsSkeleton - Skeleton for summary statistics
 */
export function SummaryStatsSkeleton({ count = 4 }: Omit<CardSkeletonsProps, 'variant'>) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 rounded-lg border"
          style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        >
          <Skeleton variant="text" width="50%" height="12px" className="mb-3" />
          <Skeleton variant="text" width="70%" height="28px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Main CardSkeletons Component
 */
export function CardSkeletons({
  variant = 'grid',
  count = 3,
  columns = 3,
}: CardSkeletonsProps) {
  switch (variant) {
    case 'list':
      return <CardListSkeleton count={count} />;
    case 'summary':
      return <SummaryStatsSkeleton count={count} />;
    case 'grid':
    default:
      return <CardGridSkeleton count={count} columns={columns} />;
  }
}

export default CardSkeletons;
