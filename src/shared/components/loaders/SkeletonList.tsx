'use client';

import React from 'react';
import SkeletonCard from './SkeletonCard';
import SkeletonText from './SkeletonText';

interface SkeletonListProps {
  count?: number;        // Number of skeleton items
  itemType?: 'card' | 'row' | 'text';
  className?: string;
}

/**
 * SkeletonList Component - Multiple Loading Placeholders
 * 
 * Renders multiple skeleton items based on type:
 * - 'card': Full card skeletons (dashboard, galleries)
 * - 'row': Compact row skeletons (tables, lists)
 * - 'text': Text paragraph skeletons
 * 
 * WCAG 2.1 Compliance:
 * - Proper semantic structure
 * - Accessible to screen readers
 * - Respects light/dark mode contrast
 */
const SkeletonList = React.forwardRef<HTMLDivElement, SkeletonListProps>(
  (
    {
      count = 3,
      itemType = 'card',
      className = '',
    },
    ref
  ) => {
    const containerClasses = {
      card: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
      row: 'space-y-2',
      text: 'space-y-4',
    };

    return (
      <div
        ref={ref}
        className={`${containerClasses[itemType]} ${className}`}
        role="status"
        aria-busy="true"
        aria-label={`Loading ${itemType} list`}
      >
        {Array.from({ length: count }).map((_, index) => {
          if (itemType === 'card') {
            return (
              <SkeletonCard
                key={index}
                rows={3}
                showImage={true}
              />
            );
          }

          if (itemType === 'row') {
            return (
              <div
                key={index}
                className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
              >
                <SkeletonText lines={1} width="85%" />
              </div>
            );
          }

          // itemType === 'text'
          return (
            <SkeletonText
              key={index}
              lines={3}
              width="100%"
            />
          );
        })}
      </div>
    );
  }
);

SkeletonList.displayName = 'SkeletonList';

export default SkeletonList;
