'use client';

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================
// Type Definitions
// ============================================================

export interface ExpiringBenefitItem {
  id: string;
  name: string;
  type: string;
  stickerValue: number; // cents
  periodEnd: string; // ISO
  daysLeft: number;
  cardName: string;
  cardIssuer: string;
  userCardId: string;
}

export interface ExpiringBenefitsBannerProps {
  benefits: ExpiringBenefitItem[];
  totalValue: number; // cents
  onBenefitClick?: (benefitId: string) => void;
  isLoading?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatDaysLeft(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function truncateCardName(name: string, maxLen = 16): string {
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + '…';
}

// ============================================================
// Loading Skeleton
// ============================================================

function BannerSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading expiring benefits"
      style={{
        height: '40px',
        borderRadius: '8px',
        background:
          'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg) 50%, var(--color-bg-secondary) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite linear',
      }}
    />
  );
}

// ============================================================
// Component
// ============================================================

export function ExpiringBenefitsBanner({
  benefits,
  totalValue,
  onBenefitClick,
  isLoading = false,
}: ExpiringBenefitsBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return <BannerSkeleton />;
  }

  // Empty / error — don't render
  if (!benefits || benefits.length === 0) {
    return null;
  }

  const count = benefits.length;
  const valueDisplay = formatDollars(totalValue);

  return (
    <div
      role="alert"
      aria-label={`${count} benefits worth ${valueDisplay} expiring this month`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg))',
        border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
        borderRadius: '10px',
        padding: '0',
        marginBottom: '12px',
      }}
    >
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-warning-text, var(--color-text))',
          borderRadius: '10px',
        }}
      >
        <AlertTriangle
          size={18}
          aria-hidden="true"
          style={{ color: 'var(--color-warning)', flexShrink: 0 }}
        />
        <span className="text-sm font-medium flex-1 text-left">
          <span className="font-mono tabular-nums">{count}</span> benefit
          {count !== 1 ? 's' : ''} (
          <span className="font-mono tabular-nums">{valueDisplay}</span>)
          expiring this month
        </span>
        <span
          className="text-xs font-medium flex items-center gap-1"
          style={{ color: 'var(--color-warning)', flexShrink: 0 }}
        >
          {isExpanded ? (
            <>
              Hide <ChevronUp size={14} aria-hidden="true" />
            </>
          ) : (
            <>
              View <ChevronDown size={14} aria-hidden="true" />
            </>
          )}
        </span>
      </button>

      {/* Expanded Benefit List */}
      {isExpanded && (
        <div
          className="px-4 pb-3"
          style={{
            maxHeight: benefits.length > 5 ? '240px' : 'none',
            overflowY: benefits.length > 5 ? 'auto' : 'visible',
          }}
        >
          <div
            style={{
              borderTop: '1px solid color-mix(in srgb, var(--color-warning) 12%, transparent)',
              paddingTop: '8px',
            }}
          >
            {benefits.map((benefit) => (
              <div
                key={benefit.id}
                role={onBenefitClick ? 'button' : undefined}
                tabIndex={onBenefitClick ? 0 : undefined}
                onClick={() => onBenefitClick?.(benefit.id)}
                onKeyDown={(e) => {
                  if (onBenefitClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onBenefitClick(benefit.id);
                  }
                }}
                className="flex items-center gap-3 py-2 px-2 rounded-md transition-colors"
                style={{
                  cursor: onBenefitClick ? 'pointer' : 'default',
                  color: 'var(--color-text)',
                }}
                onMouseEnter={(e) => {
                  if (onBenefitClick) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'color-mix(in srgb, var(--color-warning) 6%, transparent)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {/* Benefit Name */}
                <span
                  className="text-sm font-medium flex-1 truncate"
                  title={benefit.name}
                >
                  {benefit.name}
                </span>

                {/* Dollar Value */}
                <span
                  className="text-sm font-mono tabular-nums font-semibold"
                  style={{ minWidth: '48px', textAlign: 'right' }}
                >
                  {formatDollars(benefit.stickerValue)}
                </span>

                {/* Days Left */}
                <span
                  className="text-xs font-mono tabular-nums"
                  style={{
                    color: benefit.daysLeft <= 3
                      ? 'var(--color-error, #dc2626)'
                      : 'var(--color-text-secondary)',
                    minWidth: '72px',
                    textAlign: 'right',
                  }}
                >
                  {formatDaysLeft(benefit.daysLeft)}
                </span>

                {/* Card Name (truncated) */}
                <span
                  className="text-xs hidden sm:inline-block truncate"
                  style={{
                    color: 'var(--color-text-tertiary, var(--color-text-secondary))',
                    maxWidth: '100px',
                    textAlign: 'right',
                  }}
                  title={benefit.cardName}
                >
                  {truncateCardName(benefit.cardName)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpiringBenefitsBanner;
