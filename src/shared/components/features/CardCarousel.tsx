'use client';

/**
 * CardCarousel — Sprint 24: Apple Wallet-style swipeable card carousel
 *
 * Replaces the old CardSwitcher tab bar + Hero Card with a single unified
 * horizontal scroll-snap carousel. Each card renders as a full credit-card
 * face with issuer-specific gradient, chip, network badge, and benefit count.
 *
 * Accessibility: role="tablist" / role="tab", ArrowLeft/Right/Home/End
 * keyboard nav, aria-live announcements, prefers-reduced-motion support.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCardGradient } from '@/app/dashboard/new/components/CardArt';
import type { GradientConfig } from '@/app/dashboard/new/components/CardArt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CarouselCard {
  id: string;
  name: string;
  productName: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour?: string;
  issuer: string;
  customName?: string | null;
}

interface CardCarouselProps {
  cards: CarouselCard[];
  selectedCardId: string;
  onSelectCard: (cardId: string) => void;
  benefitCounts?: Record<string, number>;
  className?: string;
  onEditCard?: (cardId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NETWORK_LABELS: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'MASTERCARD',
  amex: 'AMEX',
  discover: 'DISCOVER',
  other: '',
};

/** Determine if gradient endpoint is light (for text contrast decisions). */
function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isLightGradient(gradient: GradientConfig): boolean {
  return hexLuminance(gradient.to) > 0.35;
}

/** Build CSS gradient string from a GradientConfig. */
function buildGradientCSS(gradient: GradientConfig): string {
  return gradient.via
    ? `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.via} 50%, ${gradient.to} 100%)`
    : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`;
}

/** Get display label for a card. */
function getCardLabel(card: CarouselCard): string {
  const cleanName = card.customName?.trim();
  if (cleanName && cleanName.length > 0) return cleanName;
  const issuer = card.issuer || 'Card';
  if (card.lastFour && card.lastFour !== '0000')
    return `${issuer} \u2022\u2022\u2022\u2022 ${card.lastFour}`;
  return issuer;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CardCarousel = React.forwardRef<HTMLDivElement, CardCarouselProps>(
  ({ cards, selectedCardId, onSelectCard, benefitCounts, className, onEditCard }, ref) => {
    // ---- Refs ----
    const trackRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isProgrammaticScrollRef = useRef(false);
    const isInternalScrollRef = useRef(false);

    // ---- State ----
    const [activeIndex, setActiveIndex] = useState(() =>
      Math.max(0, cards.findIndex((c) => c.id === selectedCardId)),
    );
    const [liveAnnouncement, setLiveAnnouncement] = useState('');

    const isSingleCard = cards.length <= 1;

    // ---- Memoised gradient map ----
    const gradientMap = useMemo(() => {
      const map = new Map<string, GradientConfig>();
      cards.forEach((card) => {
        map.set(card.id, getCardGradient(card.productName, card.issuer));
      });
      return map;
    }, [cards]);

    // ---- Reduced motion (reactive to system changes) ----
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }, []);

    // ---- Announce card for screen readers ----
    const announceCard = useCallback(
      (index: number) => {
        const card = cards[index];
        if (!card) return;
        const count = benefitCounts?.[card.id];
        const countText =
          count != null ? ` ${count} benefit${count !== 1 ? 's' : ''}.` : '';
        setLiveAnnouncement(
          `Card ${index + 1} of ${cards.length}, ${card.name}.${countText}`,
        );
      },
      [cards, benefitCounts],
    );

    // ---- Programmatic scroll when selectedCardId changes externally ----
    useEffect(() => {
      if (isInternalScrollRef.current) {
        isInternalScrollRef.current = false;
        return;
      }
      const idx = cards.findIndex((c) => c.id === selectedCardId);
      if (idx === -1) return;
      setActiveIndex(idx);

      const el = cardRefs.current.get(selectedCardId);
      if (el) {
        isProgrammaticScrollRef.current = true;
        el.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        const timerId = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 500);
        return () => clearTimeout(timerId);
      }
    }, [selectedCardId, cards, prefersReducedMotion]);

    // ---- Scroll-end detection to fire onSelectCard ----
    const handleScrollEnd = useCallback(() => {
      if (isProgrammaticScrollRef.current) return;

      const track = trackRef.current;
      if (!track) return;

      const trackRect = track.getBoundingClientRect();
      const trackCenter = trackRect.left + trackRect.width / 2;

      let closestId: string | null = null;
      let closestDist = Infinity;

      cardRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const dist = Math.abs(cardCenter - trackCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });

      if (closestId) {
        const idx = cards.findIndex((c) => c.id === closestId);
        if (idx !== -1) {
          setActiveIndex(idx); // Always sync visual state
          if (closestId !== selectedCardId) {
            onSelectCard(closestId);
          }
          announceCard(idx);
        }
      }
    }, [cards, selectedCardId, onSelectCard, announceCard]);

    // ---- Scroll listener with debounced fallback for scrollend ----
    useEffect(() => {
      const track = trackRef.current;
      if (!track || isSingleCard) return;

      const onScroll = () => {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = setTimeout(() => {
          handleScrollEnd();
        }, 150);
      };

      const onScrollEnd = () => {
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
        handleScrollEnd();
      };

      track.addEventListener('scroll', onScroll, { passive: true });
      track.addEventListener('scrollend', onScrollEnd);

      return () => {
        track.removeEventListener('scroll', onScroll);
        track.removeEventListener('scrollend', onScrollEnd);
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      };
    }, [handleScrollEnd, isSingleCard]);

    // ---- IntersectionObserver for active card styling during scroll ----
    useEffect(() => {
      const track = trackRef.current;
      if (!track || isSingleCard) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (isProgrammaticScrollRef.current) return;
          entries.forEach((entry) => {
            if (entry.intersectionRatio >= 0.75) {
              const id = entry.target.getAttribute('data-card-id');
              if (id) {
                const idx = cards.findIndex((c) => c.id === id);
                if (idx !== -1) setActiveIndex(idx);
              }
            }
          });
        },
        { root: track, threshold: [0.5, 0.75, 1.0] },
      );

      cardRefs.current.forEach((el) => observer.observe(el));
      return () => observer.disconnect();
    }, [cards, isSingleCard]);

    // ---- Arrow navigation helpers ----
    const scrollToIndex = useCallback(
      (index: number) => {
        const card = cards[index];
        if (!card) return;
        setActiveIndex(index);
        isInternalScrollRef.current = true;
        onSelectCard(card.id);
        announceCard(index);

        const el = cardRefs.current.get(card.id);
        if (el) {
          isProgrammaticScrollRef.current = true;
          el.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            inline: 'center',
            block: 'nearest',
          });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 500);
        }
      },
      [cards, onSelectCard, announceCard, prefersReducedMotion],
    );

    const goLeft = useCallback(() => {
      scrollToIndex((activeIndex - 1 + cards.length) % cards.length);
    }, [activeIndex, cards.length, scrollToIndex]);

    const goRight = useCallback(() => {
      scrollToIndex((activeIndex + 1) % cards.length);
    }, [activeIndex, cards.length, scrollToIndex]);

    // ---- Keyboard navigation ----
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        let nextIndex: number | null = null;

        if (e.key === 'ArrowRight') {
          nextIndex = (activeIndex + 1) % cards.length;
        } else if (e.key === 'ArrowLeft') {
          nextIndex = (activeIndex - 1 + cards.length) % cards.length;
        } else if (e.key === 'Home') {
          nextIndex = 0;
        } else if (e.key === 'End') {
          nextIndex = cards.length - 1;
        }

        if (nextIndex !== null) {
          e.preventDefault();
          scrollToIndex(nextIndex);
          const el = cardRefs.current.get(cards[nextIndex].id);
          el?.focus();
        }
      },
      [activeIndex, cards, scrollToIndex],
    );

    // ---- Render ----
    return (
      <div ref={ref} className={`relative ${className ?? ''}`}>
        {/* Screen reader live region */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {liveAnnouncement}
        </div>

        {/* Carousel wrapper with arrows */}
        <div className="relative flex items-center">
          {/* Left arrow — desktop only */}
          {!isSingleCard && (
            <button
              onClick={goLeft}
              className="hidden sm:flex absolute -left-1 z-10 items-center justify-center rounded-full border carousel-arrow transition-transform duration-200 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] hover:scale-105"
              style={{
                width: 44,
                height: 44,
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
                opacity: 'var(--carousel-arrow-opacity)',
                boxShadow: 'var(--shadow-sm)',
              }}
              aria-label="Previous card"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Scroll track */}
          <div
            ref={trackRef}
            role="tablist"
            aria-label="Credit cards"
            onKeyDown={handleKeyDown}
            data-carousel-track=""
            className="flex w-full overflow-x-auto py-3"
            style={{
              scrollSnapType: 'x mandatory',
              scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              gap: 'var(--carousel-card-gap)',
              paddingLeft: isSingleCard
                ? '0'
                : 'calc(50% - var(--carousel-card-width) / 2)',
              paddingRight: isSingleCard
                ? '0'
                : 'calc(50% - var(--carousel-card-width) / 2)',
              justifyContent: isSingleCard ? 'center' : undefined,
            }}
          >
            {/* Hide scrollbar for webkit + reduced motion override */}
            <style>{`
              [data-carousel-track]::-webkit-scrollbar { display: none; }
              [data-carousel-card][data-active="false"] {
                opacity: var(--carousel-inactive-opacity);
              }
              [data-carousel-card][data-active="true"] {
                opacity: 1;
              }
              @media (prefers-reduced-motion: reduce) {
                [data-carousel-card],
                .carousel-arrow,
                .carousel-dot {
                  transition-duration: 0.01ms !important;
                }
              }
            `}</style>

            {cards.map((card, index) => {
              const isActive = index === activeIndex;
              const gradient = gradientMap.get(card.id) ?? {
                from: '#6B7280',
                to: '#9CA3AF',
                chipColor: 'silver' as const,
              };
              const gradientCSS = buildGradientCSS(gradient);
              const light = isLightGradient(gradient);
              const textColor = light
                ? 'rgba(0,0,0,0.8)'
                : 'rgba(255,255,255,0.95)';
              const subtleColor = light
                ? 'rgba(0,0,0,0.5)'
                : 'rgba(255,255,255,0.65)';
              const networkLabel = NETWORK_LABELS[card.type] ?? '';
              const benefitCount = benefitCounts?.[card.id];
              const chipBg =
                gradient.chipColor === 'gold'
                  ? 'linear-gradient(135deg, #D4AF37 0%, #F5D060 50%, #C5A028 100%)'
                  : 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #A8A8A8 100%)';

              return (
                <div
                  key={card.id}
                  ref={(el) => {
                    if (el) {
                      cardRefs.current.set(card.id, el);
                    } else {
                      cardRefs.current.delete(card.id);
                    }
                  }}
                  data-card-id={card.id}
                  data-carousel-card=""
                  data-active={isActive ? 'true' : 'false'}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${card.name}${benefitCount != null ? `, ${benefitCount} benefits` : ''}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => scrollToIndex(index)}
                  className="flex-shrink-0 relative rounded-xl overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                  style={{
                    width: 'var(--carousel-card-width)',
                    height: 'var(--carousel-card-height)',
                    background: gradientCSS,
                    scrollSnapAlign: 'center',
                    transform: isSingleCard
                      ? 'scale(1)'
                      : isActive
                        ? 'scale(var(--carousel-active-scale))'
                        : 'scale(var(--carousel-inactive-scale))',
                    willChange: 'transform, opacity',
                    boxShadow: isActive
                      ? 'var(--carousel-active-shadow)'
                      : 'var(--carousel-inactive-shadow)',
                    transitionProperty: 'transform, opacity, box-shadow',
                    transitionDuration: 'var(--carousel-transition-duration)',
                    transitionTimingFunction:
                      'var(--carousel-transition-easing)',
                    borderTop: '1px solid rgba(255,255,255,0.25)',
                    borderLeft: '1px solid rgba(255,255,255,0.10)',
                    borderRight: '1px solid rgba(0,0,0,0.08)',
                    borderBottom: '1px solid rgba(0,0,0,0.12)',
                  }}
                >
                  {/* Decorative chip — top-left */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '20%',
                      left: '8%',
                      width: 36,
                      height: 26,
                      borderRadius: 4,
                      background: chipBg,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                    }}
                  />

                  {/* Benefit count badge — top-right pill */}
                  {benefitCount != null && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 24,
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 700,
                        backgroundColor: light
                          ? 'rgba(0,0,0,0.15)'
                          : 'rgba(255,255,255,0.2)',
                        color: textColor,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {benefitCount}
                    </span>
                  )}

                  {/* Card name — bottom-left */}
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 32,
                      left: 16,
                      right: 80,
                      fontSize: 13,
                      fontWeight: 600,
                      color: textColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.01em',
                      fontFamily: 'var(--font-primary)',
                    }}
                  >
                    {getCardLabel(card)}
                  </span>

                  {/* Last four digits — bottom-left below card name */}
                  {card.lastFour && card.lastFour !== '0000' && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 14,
                        left: 16,
                        fontSize: 11,
                        fontWeight: 500,
                        color: subtleColor,
                        letterSpacing: '0.08em',
                        fontFamily: 'var(--font-mono, monospace)',
                      }}
                    >
                      {'\u2022\u2022\u2022\u2022 ' + card.lastFour}
                    </span>
                  )}

                  {/* Network type — bottom-right */}
                  {networkLabel && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        bottom: 14,
                        right: 14,
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: light
                          ? 'rgba(0,0,0,0.55)'
                          : 'rgba(255,255,255,0.75)',
                        textShadow: light
                          ? '0 0.5px 1px rgba(255,255,255,0.5)'
                          : '0 0.5px 1px rgba(0,0,0,0.4)',
                        fontFamily: 'var(--font-primary)',
                        userSelect: 'none',
                      }}
                    >
                      {networkLabel}
                    </span>
                  )}

                  {/* Edit button — only on active card */}
                  {isActive && onEditCard && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditCard(card.id);
                      }}
                      className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
                      style={{
                        top: 10,
                        left: 10,
                        padding: 4,
                        backgroundColor: light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        color: textColor,
                        cursor: 'pointer',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(4px)',
                        transition: 'background-color 200ms',
                        minWidth: 'auto',
                        minHeight: 'auto',
                      }}
                      aria-label="Edit card settings"
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right arrow — desktop only */}
          {!isSingleCard && (
            <button
              onClick={goRight}
              className="hidden sm:flex absolute -right-1 z-10 items-center justify-center rounded-full border carousel-arrow transition-transform duration-200 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] hover:scale-105"
              style={{
                width: 44,
                height: 44,
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
                opacity: 'var(--carousel-arrow-opacity)',
                boxShadow: 'var(--shadow-sm)',
              }}
              aria-label="Next card"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Dot indicators / card counter */}
        {!isSingleCard && (
          <div
            className="flex items-center justify-center gap-1.5 mt-3"
            aria-hidden="true"
          >
            {cards.length < 8 ? (
              cards.map((card, index) => (
                <button
                  key={card.id}
                  onClick={() => scrollToIndex(index)}
                  aria-label={`Go to card ${index + 1}`}
                  tabIndex={-1}
                  className="carousel-dot rounded-full transition-[width,background-color] duration-200 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  style={{
                    width:
                      index === activeIndex
                        ? 'var(--carousel-dot-active-width)'
                        : 'var(--carousel-dot-size)',
                    height: 'var(--carousel-dot-size)',
                    backgroundColor:
                      index === activeIndex
                        ? 'var(--carousel-dot-active-color)'
                        : 'var(--carousel-dot-color)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    minWidth: 'auto',
                    minHeight: 'auto',
                  }}
                />
              ))
            ) : (
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {activeIndex + 1} of {cards.length}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);

CardCarousel.displayName = 'CardCarousel';

export default CardCarousel;