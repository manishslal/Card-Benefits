'use client';

import React from 'react';
import { CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  type CardROISummary,
  formatDollar,
  formatROIMessage,
} from '@/lib/card-roi';

interface CardROIBannerProps {
  roi: CardROISummary;
  cardName: string;
}

type BannerState = 'strong' | 'breakeven' | 'below' | 'nofee';

function getBannerState(roi: CardROISummary): BannerState {
  if (roi.hasNoFee) return 'nofee';
  if (roi.roiMultiple >= 2) return 'strong';
  if (roi.isWorthIt) return 'breakeven';
  return 'below';
}

const stateConfig: Record<
  BannerState,
  { color: string; Icon: typeof CheckCircle2 }
> = {
  strong: { color: 'var(--color-success)', Icon: CheckCircle2 },
  breakeven: { color: 'var(--color-primary)', Icon: CheckCircle2 },
  below: { color: 'var(--color-warning)', Icon: TrendingUp },
  nofee: { color: 'var(--color-success)', Icon: CheckCircle2 },
};

export function CardROIBanner({ roi, cardName }: CardROIBannerProps) {
  if (roi.benefitCount === 0) return null;

  const state = getBannerState(roi);
  const { color, Icon } = stateConfig[state];

  // No-fee compact variant
  if (state === 'nofee') {
    return (
      <div
        className="rounded-xl border px-4 py-3 flex items-center gap-2"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-bg))`,
          borderColor: `color-mix(in srgb, ${color} 20%, var(--color-border))`,
        }}
        role="status"
        aria-label={`ROI summary for ${cardName}`}
      >
        <Icon size={16} style={{ color, flexShrink: 0 }} aria-hidden="true" />
        <span className="text-sm" style={{ color: 'var(--color-text)' }}>
          No annual fee{' '}
          <span style={{ color: 'var(--color-text-secondary)' }}>·</span>{' '}
          {formatDollar(roi.totalBenefitValue)} in available benefits
        </span>
      </div>
    );
  }

  // Benefits exist but value is $0 — show neutral message
  if (roi.totalBenefitValue === 0) {
    return (
      <div
        className="rounded-xl border px-4 py-3 flex items-center gap-2"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
        role="status"
        aria-label={`ROI summary for ${cardName}`}
      >
        <AlertTriangle
          size={16}
          style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}
          aria-hidden="true"
        />
        <span
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Benefits value not available for this card
        </span>
      </div>
    );
  }

  const progressPct =
    roi.benefitCount > 0
      ? Math.round((roi.usedCount / roi.benefitCount) * 100)
      : 0;

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 8%, var(--color-bg))`,
        borderColor: `color-mix(in srgb, ${color} 20%, var(--color-border))`,
      }}
      role="status"
      aria-label={`ROI summary for ${cardName}`}
    >
      {/* Headline */}
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color, flexShrink: 0 }} aria-hidden="true" />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}
        >
          {formatROIMessage(roi)}
        </span>
      </div>

      {/* Dollar breakdown */}
      <div
        className="text-xs flex flex-wrap gap-x-3 gap-y-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span>
          <span className="font-mono tabular-nums">
            {formatDollar(roi.usedBenefitValue)}
          </span>{' '}
          used
        </span>
        <span>·</span>
        <span>
          <span className="font-mono tabular-nums">
            {formatDollar(roi.remainingBenefitValue)}
          </span>{' '}
          remaining
        </span>
        <span>·</span>
        <span>
          <span className="font-mono tabular-nums">
            {formatDollar(roi.annualFee)}
          </span>{' '}
          annual fee
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${roi.usedCount} of ${roi.benefitCount} benefits used`}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              backgroundColor: color,
              transition: 'width 500ms ease-out',
            }}
          />
        </div>
        <span
          className="text-xs whitespace-nowrap font-mono tabular-nums"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {roi.usedCount} of {roi.benefitCount} used
        </span>
      </div>

      {/* Nudge when below break-even and unclaimed benefits exist */}
      {state === 'below' && roi.remainingBenefitValue > 0 && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="font-mono tabular-nums">
            {formatDollar(roi.remainingBenefitValue)}
          </span>{' '}
          remaining in unclaimed benefits
        </p>
      )}
    </div>
  );
}

export default CardROIBanner;
