'use client';

import { useEffect, useMemo, useRef } from 'react';

interface CompactCardChipsProps {
  cards: Array<{
    id: string;
    name: string;
    productName: string;
    type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
    lastFour?: string;
    issuer: string;
    customName?: string | null;
  }>;
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
  benefitCounts?: Record<string, number>;
  onEditCard?: (cardId: string) => void;
}

// Simple gradient color extraction — reuse the same logic as CardCarousel
function getChipGradientColor(productName: string, issuer: string): string {
  const name = `${productName} ${issuer}`.toLowerCase();
  if (name.includes('sapphire') && name.includes('reserve')) return '#1a1a2e';
  if (name.includes('sapphire') && name.includes('preferred')) return '#003087';
  if (name.includes('rose gold')) return '#b76e79';
  if (name.includes('gold') || name.includes('premier')) return '#a67c00';
  if (name.includes('platinum')) return '#6b6b6b';
  if (name.includes('green')) return '#2e7d32';
  if (name.includes('venture')) return '#c41230';
  if (name.includes('savor')) return '#8b0000';
  if (name.includes('freedom') || name.includes('flex')) return '#0066b2';
  if (name.includes('discover')) return '#ff6000';
  if (name.includes('citi')) return '#003da5';
  if (name.includes('amex') || name.includes('american express')) return '#006fcf';
  if (name.includes('chase')) return '#0b6efd';
  if (name.includes('capital one')) return '#d03027';
  if (name.includes('wells fargo')) return '#d71e28';
  if (name.includes('bank of america') || name.includes('bofa')) return '#012169';
  return '#4a5568'; // default gray
}

function getChipLabel(card: CompactCardChipsProps['cards'][number]): string {
  if (card.customName) return card.customName;
  const parts = card.name.split(' ');
  const issuerWords = card.issuer.split(' ');
  if (parts.length > issuerWords.length) {
    const namePrefix = parts.slice(0, issuerWords.length).join(' ').toLowerCase();
    if (namePrefix === card.issuer.toLowerCase()) {
      return parts.slice(issuerWords.length).join(' ');
    }
  }
  return card.name;
}

export default function CompactCardChips({
  cards,
  selectedCardId,
  onSelectCard,
  benefitCounts,
  onEditCard,
}: CompactCardChipsProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected chip into view
  useEffect(() => {
    const el = trackRef.current?.querySelector(`[data-chip-id="${selectedCardId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedCardId]);

  const chipColors = useMemo(() => {
    const map: Record<string, string> = {};
    cards.forEach((card) => {
      map[card.id] = getChipGradientColor(card.productName, card.issuer);
    });
    return map;
  }, [cards]);

  if (cards.length === 0) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = cards.findIndex(c => c.id === selectedCardId);
    let newIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % cards.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + cards.length) % cards.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = cards.length - 1;
    }
    if (newIndex !== currentIndex) {
      onSelectCard(cards[newIndex].id);
    }
  };

  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Select card" onKeyDown={handleKeyDown}>
      <div
        ref={trackRef}
        data-compact-chips=""
        className="flex-1 flex gap-1.5 overflow-x-auto py-1"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {cards.map((card) => {
          const isSelected = card.id === selectedCardId;
          const color = chipColors[card.id];
          const count = benefitCounts?.[card.id];
          const label = getChipLabel(card);

          return (
            <button
              key={card.id}
              data-chip-id={card.id}
              role="tab"
              type="button"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelectCard(card.id)}
              className={`
                flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5
                rounded-full text-xs font-medium
                transition-all duration-200 ease-in-out
                outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1
                press-feedback
                ${isSelected
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] ring-2 ring-[var(--color-primary)]'
                  : 'bg-[var(--color-bg-tertiary,var(--color-bg-secondary))] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                }
              `}
              style={{
                scrollSnapAlign: 'center',
                minWidth: 'auto',
                minHeight: '44px',
              }}
              aria-label={`${card.name}${count != null ? `, ${count} benefits` : ''}`}
            >
              {/* Gradient dot */}
              <span
                aria-hidden="true"
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: color,
                  boxShadow: isSelected ? `0 0 0 2px ${color}40` : 'none',
                }}
              />
              {/* Card name — truncated */}
              <span className="truncate" style={{ maxWidth: 'min(140px, 30vw)' }}>
                {label}
              </span>
              {/* Benefit count */}
              {count != null && (
                <span
                  className="flex-shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    color: '#fff',
                    opacity: isSelected ? 1 : 0.6,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Edit button in collapsed bar */}
      {onEditCard && (
        <button
          type="button"
          onClick={() => onEditCard(selectedCardId)}
          className="flex-shrink-0 p-1.5 rounded-md transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Edit card settings"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}
    </div>
  );
}