'use client';

import { useState, useRef } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/format-currency';

// ---------------------------------------------------------------------------
// Minimal shape the accordion needs to read from each benefit.
// The full Benefit type from BenefitsGrid is a superset, so the generic
// constraint keeps things compatible without duplicating the full interface.
// ---------------------------------------------------------------------------
interface BaseBenefit {
  id: string;
  value?: number;
}

export interface UsedBenefitsAccordionProps<T extends BaseBenefit> {
  /** The __used__ group benefits */
  benefits: T[];
  /** Grid column classes, e.g. "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" */
  gridColsClass: string;
  /** Card render function owned by the parent — avoids duplicating card JSX */
  renderCard: (benefit: T, staggerIndex: number) => React.ReactNode;
}

/**
 * UsedBenefitsAccordion
 *
 * Collapses used benefit cards into a summary header bar,
 * expandable on click. Collapsed by default.
 *
 * Follows the accordion pattern from BenefitGroup.tsx and
 * PastPeriodsSection.tsx (collapsed-by-default precedent).
 *
 * Sprint: Dashboard Polish
 */
export function UsedBenefitsAccordion<T extends BaseBenefit>({
  benefits,
  gridColsClass,
  renderCard,
}: UsedBenefitsAccordionProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const headerRef = useRef<HTMLButtonElement>(null);

  // 0 used benefits → don't render
  if (benefits.length === 0) return null;

  // Sum of stickerValue across all used benefits (stored as integer cents)
  const totalValueCents = benefits.reduce(
    (sum, b) => sum + (b.value != null ? Number(b.value) : 0),
    0,
  );

  const handleToggle = () => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);

    // On collapse: scroll header into view if it scrolled off-screen
    if (!nextState && headerRef.current) {
      requestAnimationFrame(() => {
        const rect = headerRef.current!.getBoundingClientRect();
        if (rect.top < 0) {
          headerRef.current!.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      });
    }
  };

  // Cap stagger delay at 8 items (320 ms max total)
  const maxStaggerItems = 8;

  return (
    <div className="col-span-full">
      {/* ── Summary Header Bar ── */}
      <button
        ref={headerRef}
        id="used-benefits-accordion-trigger"
        onClick={handleToggle}
        className="w-full flex items-center justify-between rounded-lg transition-colors"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          minHeight: 'var(--touch-target-min, 44px)',
          cursor: 'pointer',
          transition:
            'background-color var(--duration-fast, 100ms) ease, transform var(--duration-fast, 100ms) ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            'var(--color-bg-tertiary, var(--color-bg-secondary))';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            'color-mix(in srgb, var(--color-bg) 80%, transparent)';
        }}
        aria-expanded={isExpanded}
        aria-controls="used-benefits-accordion-content"
        aria-label={`Used Benefits section, ${benefits.length} item${benefits.length !== 1 ? 's' : ''}, ${isExpanded ? 'expanded' : 'collapsed'}`}
      >
        {/* Left side: icon + label + count */}
        <div
          className="flex items-center gap-2"
          style={{ gap: 'var(--space-sm)' }}
        >
          <CheckCircle2
            size={16}
            className="flex-shrink-0"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-hidden="true"
          />
          <h2
            id="used-benefits-accordion-heading"
            className="font-semibold"
            style={{
              fontSize: 'var(--text-body-sm, 14px)',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Used Benefits
            <span
              className="font-normal ml-1 inline-flex items-center justify-center rounded-full font-mono tabular-nums"
              style={{
                opacity: 0.7,
                marginLeft: 'var(--space-xs, 4px)',
                fontSize: 'var(--text-body-xs, 12px)',
              }}
            >
              ({benefits.length})
            </span>
          </h2>
        </div>

        {/* Right side: value captured + chevron */}
        <div
          className="flex items-center gap-3"
          style={{ gap: 'var(--space-md)' }}
        >
          {totalValueCents > 0 && (
            <span
              className="font-mono tabular-nums text-xs font-medium hidden sm:inline"
              style={{ color: 'var(--color-success)' }}
            >
              {formatCurrency(totalValueCents)} captured
            </span>
          )}
          <ChevronDown
            size={20}
            className="flex-shrink-0"
            style={{
              color: 'var(--color-text-secondary)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition:
                'transform var(--used-accordion-expand-duration, 250ms) var(--used-accordion-expand-easing, ease-out)',
            }}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* ── Expandable Card Grid ── */}
      {isExpanded && (
        <div
          id="used-benefits-accordion-content"
          role="region"
          aria-labelledby="used-benefits-accordion-heading"
          className={`grid ${gridColsClass} gap-4 used-accordion-content`}
          style={{
            paddingTop: 'var(--space-md, 16px)',
          }}
        >
          {benefits.map((benefit, index) => (
            <div
              key={benefit.id}
              className="used-card-stagger"
              style={{
                animationDelay: `${Math.min(index, maxStaggerItems) * 40}ms`,
              }}
            >
              {renderCard(benefit, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}