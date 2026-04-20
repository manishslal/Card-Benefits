'use client';

import React from 'react';
import { Armchair, ArrowRight } from 'lucide-react';
import Button from '@/shared/components/ui/button';

interface LoungeBenefitCardProps {
  benefit: {
    id: string;
    name: string;
    description?: string;
    value?: number;
  };
  onFindLounges: () => void;
}

/**
 * Specialized card for lounge-access benefits.
 * Shows a "Find lounges" CTA instead of used/unused toggle.
 */
export const LoungeBenefitCard = React.memo(function LoungeBenefitCard({
  benefit,
  onFindLounges,
}: LoungeBenefitCardProps) {
  const hasValue = benefit.value != null && benefit.value > 0;

  return (
    <div
      data-benefit-card
      className="rounded-lg border overflow-hidden flex flex-col"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)',
        borderLeft: '3px solid var(--color-primary)',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div className="p-2.5 flex-1 flex flex-col">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2">
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-primary)',
            }}
          >
            <Armchair size={16} aria-hidden="true" />
          </div>
          <p
            className="flex-1 font-semibold line-clamp-2"
            style={{
              fontSize: 'var(--text-body-sm)',
              color: 'var(--color-text)',
            }}
            title={benefit.name}
          >
            {benefit.name}
          </p>
        </div>

        {/* Subtitle */}
        <p
          className="text-xs mb-1"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Unlimited access · Worldwide
        </p>

        {/* Value */}
        {hasValue && (
          <p
            className="text-xs mb-2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Est. ${(benefit.value ?? 0).toLocaleString('en-US')}/yr value
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        <Button
          variant="outline"
          size="sm"
          fullWidth
          rightIcon={<ArrowRight size={14} aria-hidden="true" />}
          onClick={(e) => {
            e.stopPropagation();
            onFindLounges();
          }}
        >
          Find lounges at your airport
        </Button>
      </div>
    </div>
  );
});

LoungeBenefitCard.displayName = 'LoungeBenefitCard';
export default LoungeBenefitCard;
