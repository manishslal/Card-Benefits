'use client';

/**
 * BenefitValuePresets Component
 * 
 * NOTE: This is a stub component. The custom values feature is incomplete.
 * Full implementation will be completed in a future phase.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface BenefitValuePresetsProps {
  stickerValue: number;
  currentValue?: number;
  onSelect: (value: number) => void;
  benefitType?: 'StatementCredit' | 'UsagePerk';
  isLoading?: boolean;
  error?: string;
  onError?: (error: string) => void;
}

export const BenefitValuePresets = React.forwardRef<
  HTMLDivElement,
  BenefitValuePresetsProps
>(
  (
    {
      stickerValue,
      currentValue,
      onSelect,
    },
    ref
  ) => {
    return (
      <div ref={ref} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sticker value: ${(stickerValue / 100).toFixed(2)}
        </p>
        {currentValue !== undefined && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Current value: ${(currentValue / 100).toFixed(2)}
          </p>
        )}
        <Button
          onClick={() => onSelect(stickerValue)}
          className="mt-3 w-full"
          size="sm"
        >
          Use Full Value
        </Button>
      </div>
    );
  }
);

BenefitValuePresets.displayName = 'BenefitValuePresets';
