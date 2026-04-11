'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Status filter options available in the dashboard
 * Reduced to 3 visible options: active, expiring_soon, used
 */
export type BenefitStatus = 'active' | 'expiring_soon' | 'used' | 'expired' | 'pending';

export interface StatusOption {
  id: BenefitStatus;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

/**
 * Props for StatusFilters component
 */
interface StatusFiltersProps {
  selectedStatuses: BenefitStatus[];
  onStatusChange: (statuses: BenefitStatus[]) => void;
  availableStatuses: StatusOption[];
}

/**
 * StatusFilters Component
 *
 * Allows users to filter benefits by status using horizontally scrollable buttons.
 * 
 * Features:
 * - Reduced to 3 visible options: Active, Expiring, Used
 * - Horizontally scrollable container with smooth behavior
 * - Navigation arrows appear on overflow
 * - Matches CardSwitcher scrolling pattern
 * - Keyboard support: Arrow keys scroll, Tab navigates through items
 * - Mobile-first responsive design
 * - Dark mode support
 * - WCAG AA accessibility compliance
 *
 * Uses React 19 patterns:
 * - useCallback for memoized handlers
 * - useRef for scroll container management
 * - useState for arrow visibility
 */
export function StatusFilters({
  selectedStatuses,
  onStatusChange,
  availableStatuses,
}: StatusFiltersProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Check if scrolling is needed
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const checkScroll = () => {
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    };

    checkScroll();
    container.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [availableStatuses]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleStatusToggle = useCallback(
    (status: BenefitStatus) => {
      if (selectedStatuses.includes(status)) {
        onStatusChange(selectedStatuses.filter((s) => s !== status));
      } else {
        onStatusChange([...selectedStatuses, status]);
      }
    },
    [selectedStatuses, onStatusChange]
  );

  const handleClearAll = useCallback(() => {
    onStatusChange([]);
  }, [onStatusChange]);

  const handleSelectAll = useCallback(() => {
    onStatusChange(availableStatuses.map((s) => s.id));
  }, [availableStatuses, onStatusChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    }
  };

  // Only show the first 3 status filters (Active, Expiring, Used)
  const visibleStatuses = availableStatuses.slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      {/* Label and action buttons */}
      <div className="flex items-center justify-between">
        <span 
          className="text-sm font-medium"
          style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}
        >
          Status:
        </span>
        
        {/* Clear/Select All Actions */}
        {selectedStatuses.length > 0 && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={handleClearAll}
              className="underline transition-colors hover:text-[var(--color-text)]"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-caption)',
              }}
              aria-label="Clear all status filters"
            >
              Clear
            </button>
            <span style={{ color: 'var(--color-border)' }}>|</span>
            <button
              onClick={handleSelectAll}
              className="underline transition-colors hover:text-[var(--color-text)]"
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-caption)',
              }}
              aria-label="Select all status filters"
            >
              All
            </button>
          </div>
        )}

        {selectedStatuses.length === 0 && (
          <button
            onClick={handleSelectAll}
            className="text-xs underline transition-colors hover:text-[var(--color-text)]"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-caption)',
            }}
            aria-label="Select all status filters"
          >
            All
          </button>
        )}
      </div>

      {/* Horizontal scrollable filters container */}
      <div className="relative flex items-center gap-2">
        {/* Left scroll arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute -left-8 z-10 items-center justify-center w-8 h-8 rounded-full transition-all duration-200 focus-visible:outline-offset-2 hover:bg-[var(--color-bg-secondary)]"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              borderWidth: '1px',
              borderStyle: 'solid',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              color: 'var(--color-text)',
            }}
            aria-label="Scroll status filters left"
            title="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Status Filter Buttons - Horizontally scrollable */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
          onKeyDown={handleKeyDown}
          role="group"
          aria-label="Status filters"
          style={{ scrollBehavior: 'smooth' }}
        >
          {visibleStatuses.map((status) => {
            const isSelected = selectedStatuses.includes(status.id);
            
            return (
              <button
                key={status.id}
                onClick={() => handleStatusToggle(status.id)}
                title={status.description}
                aria-pressed={isSelected}
                className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all duration-200 whitespace-nowrap focus-visible:outline-offset-2 hover:border-[var(--status-color)]"
                style={{
                  '--status-color': `var(${status.color})`,
                  backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  borderColor: isSelected ? `var(${status.color})` : 'var(--color-border)',
                  color: isSelected ? `var(${status.color})` : 'var(--color-text-secondary)',
                  outlineColor: 'var(--color-primary)',
                } as React.CSSProperties}
              >
                <span style={{ display: 'flex', alignItems: 'center', color: `var(${status.color})` }}>
                  {status.icon}
                </span>
                <span className="text-sm font-medium">{status.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute -right-8 z-10 items-center justify-center w-8 h-8 rounded-full transition-all duration-200 focus-visible:outline-offset-2 hover:bg-[var(--color-bg-secondary)]"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              borderWidth: '1px',
              borderStyle: 'solid',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              color: 'var(--color-text)',
            }}
            aria-label="Scroll status filters right"
            title="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

    </div>
  );
}
