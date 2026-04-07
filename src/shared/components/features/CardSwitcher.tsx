'use client';

import React, { useRef, useState } from 'react';
import { CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';

interface Card {
  id: string;
  name: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string | null;  // Enhancement 3: User's custom nickname (optional)
}

interface CardSwitcherProps {
  cards: Card[];
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
}

/**
 * CardSwitcher Component - Premium Tab Interface
 * 
 * Displays credit cards as a beautiful tab interface with:
 * - Card type icons using Lucide React
 * - Last 4 digits
 * - Smooth transitions
 * - Mobile: horizontal scroll
 * - Desktop: all visible
 * 
 * Uses design system colors and tokens for consistency
 */
const CardSwitcher = React.forwardRef<HTMLDivElement, CardSwitcherProps>(
  ({ cards, selectedCardId, onSelectCard }, ref) => {
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
    }, [cards]);

    const scroll = (direction: 'left' | 'right') => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollAmount = 300;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    };

    // Enhancement 3: Display customName if set, otherwise fallback to issuer + last 4 digits
    const getCardLabel = (card: Card) => {
      // If customName is set and not empty after trimming, use it
      const cleanName = card.customName?.trim();
      if (cleanName && cleanName.length > 0) {
        return cleanName;
      }
      // Fallback with null safety: default to 'Card' if issuer is missing
      const issuer = card.issuer || 'Card';
      return `${issuer} •••• ${card.lastFour}`;
    };

    return (
      <div
        ref={ref}
        className="relative flex items-center gap-3 mb-8"
        role="tablist"
      >
        {/* Left scroll arrow - hidden on desktop */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="hidden sm:flex absolute -left-2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-bg-secondary)] transition-all duration-200 focus-visible:outline-offset-2"
            aria-label="Scroll cards left"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Cards scroll container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollBehavior: 'smooth' }}
        >
          {cards.map((card) => {
            const isSelected = card.id === selectedCardId;

            return (
              <button
                key={card.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectCard(card.id)}
                className={`
                  flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg
                  border-2 transition-all duration-200 whitespace-nowrap
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]
                  ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]'
                  }
                `}
              >
                {/* Card type icon */}
                <CreditCard
                  size={20}
                  className={isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}
                  aria-hidden="true"
                />

                {/* Card label */}
                <span
                  className={`
                    font-medium text-sm
                    ${
                      isSelected
                        ? 'text-[var(--color-text)]'
                        : 'text-[var(--color-text-secondary)]'
                    }
                  `}
                >
                  {getCardLabel(card)}
                </span>

                {/* Active indicator underline */}
                {isSelected && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-primary)] rounded-t-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right scroll arrow - hidden on desktop */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="hidden sm:flex absolute -right-2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-bg-secondary)] transition-all duration-200 focus-visible:outline-offset-2"
            aria-label="Scroll cards right"
          >
            <ChevronRight size={16} />
          </button>
        )}

        {/* Hide scrollbar styles globally */}
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    );
  }
);

CardSwitcher.displayName = 'CardSwitcher';

export default CardSwitcher;
