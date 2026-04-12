'use client';

import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CardArt, getCardGradient } from '@/app/dashboard/new/components/CardArt';

interface Card {
  id: string;
  name: string;
  productName: string; // Original card product name for gradient lookup
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour?: string;
  issuer: string;
  customName?: string | null;
}

interface CardSwitcherProps {
  cards: Card[];
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
  /** Optional map of cardId → active benefit count for badge display */
  benefitCounts?: Record<string, number>;
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
  ({ cards, selectedCardId, onSelectCard, benefitCounts }, ref) => {
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

    // ARIA tablist keyboard navigation (ArrowLeft/Right, Home, End)
    const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
      let nextIndex: number | null = null;
      if (e.key === 'ArrowRight') nextIndex = (index + 1) % cards.length;
      else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + cards.length) % cards.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = cards.length - 1;

      if (nextIndex !== null) {
        e.preventDefault();
        onSelectCard(cards[nextIndex].id);
        // Focus the newly selected tab button
        const container = scrollContainerRef.current;
        const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
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
      // Only show last four if available and not a generated placeholder
      if (card.lastFour && card.lastFour !== '0000') {
        return `${issuer} •••• ${card.lastFour}`;
      }
      return issuer;
    };

    return (
      <div
        ref={ref}
        className="relative flex items-start gap-3"
        role="tablist"
      >
        {/* Left scroll arrow - visible on mobile where overflow is common */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="flex sm:hidden absolute -left-2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-bg-secondary)] transition-all duration-200 focus-visible:outline-offset-2"
            aria-label="Scroll cards left"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Cards scroll container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-3"
          style={{ scrollBehavior: 'smooth' }}
        >
          {cards.map((card, index) => {
            const isSelected = card.id === selectedCardId;
            // Derive a subtle glow shadow from the card's own gradient colour
            const cardGradient = getCardGradient(card.productName, card.issuer);
            const glowShadow = isSelected
              ? `0 0 8px ${cardGradient.from}40, var(--shadow-sm)`
              : undefined;

            return (
              <button
                key={card.id}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelectCard(card.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                style={glowShadow ? { boxShadow: glowShadow } : undefined}
                className={`
                  relative flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg h-14 min-h-14
                  border-2 transition-all duration-200 whitespace-nowrap
                  focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]
                  ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]'
                  }
                `}
              >
                {/* Card art visual — issuer-specific gradient mini-card */}
                <CardArt
                  cardName={card.productName}
                  issuer={card.issuer}
                  type={card.type}
                  size="sm"
                  className={`transition-transform duration-200 transform-gpu ${
                    isSelected ? 'scale-[1.02]' : ''
                  }`}
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

                {/* Benefit count badge */}
                {benefitCounts && benefitCounts[card.id] != null && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-primary)'
                        : 'var(--color-bg-secondary)',
                      color: isSelected
                        ? 'var(--color-text-inverse)'
                        : 'var(--color-text-secondary)',
                    }}
                    aria-label={`${benefitCounts[card.id]} benefits`}
                  >
                    {benefitCounts[card.id]}
                  </span>
                )}

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

        {/* Right scroll arrow - visible on mobile where overflow is common */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="flex sm:hidden absolute -right-2 z-10 items-center justify-center w-8 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-bg-secondary)] transition-all duration-200 focus-visible:outline-offset-2"
            aria-label="Scroll cards right"
          >
            <ChevronRight size={16} />
          </button>
        )}

      </div>
    );
  }
);

CardSwitcher.displayName = 'CardSwitcher';

export default CardSwitcher;
