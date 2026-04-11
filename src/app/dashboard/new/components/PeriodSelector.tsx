'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PeriodOption {
  id: string;
  label: string;
  displayLabel: string;
  getDateRange: () => { start: Date; end: Date };
}

interface PeriodSelectorProps {
  selectedPeriodId: string;
  onPeriodChange: (periodId: string) => void;
  periods: PeriodOption[];
}

/**
 * PeriodSelector Component
 *
 * Allows users to select a time period for filtering benefits.
 * 
 * Features:
 * - Horizontally scrollable period buttons
 * - Navigation arrows appear on overflow
 * - Matches StatusFilters scrolling pattern
 * - Keyboard support: Arrow keys scroll, Tab navigates
 * - Mobile-first responsive design
 * - No line wrapping on any device size
 * - Dark mode support
 */
export function PeriodSelector({
  selectedPeriodId,
  onPeriodChange,
  periods,
}: PeriodSelectorProps) {
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
  }, [periods]);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scroll('right');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scroll('left');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <span 
        className="text-sm font-medium"
        style={{ color: 'var(--color-text)', fontSize: 'var(--text-body-sm)' }}
      >
        Period:
      </span>

      {/* Horizontal scrollable periods container */}
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
            aria-label="Scroll periods left"
            title="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Period Buttons - Horizontally scrollable */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-2"
          onKeyDown={handleKeyDown}
          role="group"
          aria-label="Time period filters"
          style={{ scrollBehavior: 'smooth' }}
        >
          {periods.map((period) => {
            const isSelected = period.id === selectedPeriodId;
            
            return (
              <button
                key={period.id}
                onClick={() => onPeriodChange(period.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all duration-200 font-medium text-sm whitespace-nowrap focus-visible:outline-offset-2 hover:border-[var(--color-primary)]"
                style={{
                  backgroundColor: isSelected ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                  outlineColor: 'var(--color-primary)',
                }}
              >
                {period.label}
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
            aria-label="Scroll periods right"
            title="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

    </div>
  );
}
