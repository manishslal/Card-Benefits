'use client';

import React, { useMemo } from 'react';
import Badge from '@/shared/components/ui/Badge';
import Button from '@/shared/components/ui/button';
import { Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2 } from 'lucide-react';
import { formatPeriodRange } from '@/lib/format-period-range';

interface Benefit {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string;
  value?: number;
  usage?: number; // 0-100 percentage
  type?: string; // travel, shopping, dining, cashback, other
  // Period-based fields (present when benefit engine is enabled)
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  // Enhanced period UI fields
  resetCadence?: string;
  claimingCadence?: string | null;
  isUsed?: boolean;
  masterBenefitId?: string | null;
}

interface BenefitsGridProps {
  benefits: Benefit[];
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
  onMarkUsed?: (benefitId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  gridColumns?: 'auto' | 2 | 3 | 4;
}

// ---------------------------------------------------------------------------
// Helper: Format cadence value to human-readable label
// ---------------------------------------------------------------------------
function getCadenceLabel(
  resetCadence?: string,
  claimingCadence?: string | null
): string {
  const cadence = (claimingCadence || resetCadence || '').toUpperCase();
  switch (cadence) {
    case 'MONTHLY':
      return 'Monthly';
    case 'QUARTERLY':
      return 'Quarterly';
    case 'SEMI_ANNUAL':
      return 'Semi-Annual';
    case 'ANNUAL':
      return 'Annual';
    case 'ONE_TIME':
      return 'One-Time';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Helper: Left border color based on period status + used state
// ---------------------------------------------------------------------------
function getLeftBorderColor(benefit: Benefit): string {
  if (benefit.isUsed) {
    return 'color-mix(in srgb, var(--color-text-secondary) 30%, transparent)';
  }
  const status = benefit.periodStatus?.toUpperCase();
  switch (status) {
    case 'ACTIVE':
      return 'var(--color-success)';
    case 'EXPIRED':
      return 'color-mix(in srgb, var(--color-text-secondary) 40%, transparent)';
    case 'UPCOMING':
      return 'var(--color-info)';
    default:
      return 'var(--color-border)';
  }
}

// ---------------------------------------------------------------------------
// Helper: Period banner background + text colors by status
// Uses the design-system *-light / *-dark tokens so dark-mode auto-switches.
// ---------------------------------------------------------------------------
function getPeriodBannerStyles(periodStatus?: string | null): {
  backgroundColor: string;
  color: string;
  iconColor: string;
} {
  const status = periodStatus?.toUpperCase();
  switch (status) {
    case 'ACTIVE':
      return {
        backgroundColor: 'var(--color-success-light)',
        color: 'var(--color-success-dark)',
        iconColor: 'var(--color-success)',
      };
    case 'UPCOMING':
      return {
        backgroundColor: 'var(--color-info-light)',
        color: 'var(--color-info)',
        iconColor: 'var(--color-info)',
      };
    case 'EXPIRED':
    default:
      return {
        backgroundColor: 'var(--color-bg-secondary)',
        color: 'var(--color-text-secondary)',
        iconColor: 'var(--color-text-secondary)',
      };
  }
}

// ---------------------------------------------------------------------------
// Helper: Extract abbreviated month from periodStart for button label
// ---------------------------------------------------------------------------
function getPeriodMonth(periodStart?: string | null): string {
  if (!periodStart) return '';
  return new Date(periodStart).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

// ---------------------------------------------------------------------------
// Helper: Period progress text (Phase 2)
// "Period 4 of 12" for MONTHLY, "Q2 of 4" for QUARTERLY, etc.
// ---------------------------------------------------------------------------
function getPeriodProgress(
  periodStart?: string | null,
  resetCadence?: string,
  claimingCadence?: string | null
): string {
  if (!periodStart) return '';
  const cadence = (claimingCadence || resetCadence || '').toUpperCase();
  const month = new Date(periodStart).getUTCMonth() + 1; // 1-indexed

  switch (cadence) {
    case 'MONTHLY':
      return `Period ${month} of 12`;
    case 'QUARTERLY': {
      const quarter = Math.ceil(month / 3);
      return `Q${quarter} of 4`;
    }
    case 'SEMI_ANNUAL': {
      const half = month <= 6 ? 1 : 2;
      return `H${half} of 2`;
    }
    default:
      return '';
  }
}

/**
 * BenefitsGrid Component - Grid View of Benefits
 *
 * Enhanced with period-based UI:
 * - **Period Banner** — prominent date range + cadence at card top
 * - **Status Stripe** — 3 px color-coded left border
 * - **Period-Aware Actions** — "Mark Apr Used" button labels
 * - **Used State Treatment** — dimmed cards, sorted to bottom
 * - **Period Progress** — "Period 4 of 12" indicator
 *
 * Layout:
 * - Mobile (320 px): 1 column
 * - Tablet (768 px): 2 columns
 * - Desktop (1440 px): 3 columns (default)
 */
const BenefitsGrid = React.forwardRef<HTMLDivElement, BenefitsGridProps>(
  (
    {
      benefits,
      onEdit,
      onDelete,
      onMarkUsed,
      loading = false,
      emptyMessage = 'No benefits found',
      gridColumns = 3,
    },
    ref
  ) => {
    // Phase 2 — sort used benefits to the bottom of the grid
    const sortedBenefits = useMemo(() => {
      return [...benefits].sort((a, b) => {
        if (a.isUsed && !b.isUsed) return 1;
        if (!a.isUsed && b.isUsed) return -1;
        return 0;
      });
    }, [benefits]);

    // Benefit type icons
    const getBenefitTypeIcon = (type?: string) => {
      const iconProps = { size: 20, className: 'flex-shrink-0' };
      switch (type?.toLowerCase()) {
        case 'travel':
          return <Plane {...iconProps} aria-hidden="true" />;
        case 'shopping':
          return <Tag {...iconProps} aria-hidden="true" />;
        case 'dining':
          return <Utensils {...iconProps} aria-hidden="true" />;
        case 'cashback':
          return <DollarSign {...iconProps} aria-hidden="true" />;
        default:
          return <Zap {...iconProps} aria-hidden="true" />;
      }
    };

    const getStatusBadge = (status: Benefit['status']) => {
      const variants = {
        active: 'success',
        expiring: 'warning',
        expired: 'error',
        pending: 'info',
      } as const;

      const labels = {
        active: 'Active',
        expiring: 'Expiring Soon',
        expired: 'Expired',
        pending: 'Pending',
      };

      return (
        <Badge variant={variants[status]} size="sm" showStatusIcon>
          {labels[status]}
        </Badge>
      );
    };

    const formatDate = (date?: Date | string) => {
      if (!date) return 'No exp.';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };

    const getGridColsClass = () => {
      if (gridColumns === 'auto') return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      if (gridColumns === 2) return 'grid-cols-1 md:grid-cols-2';
      if (gridColumns === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      if (gridColumns === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    };

    if (loading) {
      return (
        <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-40 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            />
          ))}
        </div>
      );
    }

    if (benefits.length === 0) {
      return (
        <div
          ref={ref}
          className="p-8 rounded-lg border text-center col-span-full"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {emptyMessage}
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
        {sortedBenefits.map((benefit, index) => {
          const hasPeriodData = Boolean(benefit.periodStart);
          const bannerStyles = hasPeriodData
            ? getPeriodBannerStyles(benefit.periodStatus)
            : null;
          const cadenceLabel = getCadenceLabel(
            benefit.resetCadence,
            benefit.claimingCadence
          );
          const periodMonth = getPeriodMonth(benefit.periodStart);
          const progressText = getPeriodProgress(
            benefit.periodStart,
            benefit.resetCadence,
            benefit.claimingCadence
          );
          const isUsed = benefit.isUsed === true;

          return (
            <div
  key={benefit.id}
  data-benefit-card
  className="rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-lg hover:-translate-y-1"
  style={{
    animation: `scaleIn 0.3s ease-out forwards`,
    animationDelay: `${index * 50}ms`,
    borderLeft: `3px solid ${getLeftBorderColor(benefit)}`,
  }}
>
              {/* ── Period Banner — prominent date range + cadence at card top ── */}
              {hasPeriodData && bannerStyles && (
                <div
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: bannerStyles.backgroundColor,
                    color: bannerStyles.color,
                  }}
                  role="status"
                  aria-label={`Benefit period: ${formatPeriodRange(
                    benefit.periodStart!,
                    benefit.periodEnd
                  )}`}
                >
                  <Calendar
                    size={14}
                    className="flex-shrink-0"
                    style={{ color: bannerStyles.iconColor }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-semibold">
                    {formatPeriodRange(
                      benefit.periodStart!,
                      benefit.periodEnd
                    )}
                  </span>
                  {cadenceLabel && (
                    <>
                      <span
                        className="mx-0.5"
                        style={{ opacity: 0.4 }}
                        aria-hidden="true"
                      >
                        |
                      </span>
                      <span className="truncate">{cadenceLabel}</span>
                    </>
                  )}
                </div>
              )}

              {/* ── Card Content — dimmed when benefit is used (Phase 2) ── */}
              <div
  className="p-4"
  style={{
    backgroundColor: isUsed ? 'var(--color-bg-secondary)' : undefined,
    opacity: 1,
    transition: 'background-color 0.2s ease',
  }}
>
  {/* For used state, text color remains strong for contrast. */}
                <div className="flex flex-col h-full gap-3">
                  {/* Header: Icon + Name + Status Badge */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="mt-0.5 text-[var(--color-primary)] flex-shrink-0">
                        {getBenefitTypeIcon(benefit.type)}
                      </div>
                      <h3
                        className="flex-1 font-semibold text-[var(--color-text)] line-clamp-2"
                        style={{ fontSize: 'var(--text-body-sm)' }}
                        title={benefit.name}
                      >
                        {benefit.name}
                      </h3>
                    </div>
                    {getStatusBadge(benefit.status)}
                  </div>

                  {/* Description (optional) */}
                  {benefit.description && (
                    <p
                      className="text-xs line-clamp-2 flex-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title={benefit.description}
                    >
                      {benefit.description}
                    </p>
                  )}

                  {/* Period Progress Indicator (Phase 2) */}
                  {progressText && (
                    <p
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {progressText}
                    </p>
                  )}

                  {/* Value and Expiration */}
                  <div className="flex items-center justify-between text-xs gap-2">
                    {benefit.value != null && benefit.value > 0 && (
                      <span
                        className="font-mono font-semibold"
                        style={{ color: 'var(--color-success)' }}
                      >
                        ${benefit.value}
                      </span>
                    )}
                    {benefit.expirationDate && (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Exp: {formatDate(benefit.expirationDate)}
                      </span>
                    )}
                  </div>

                  {/* Usage bar — hidden when benefit is already used */}
                  {benefit.usage !== undefined && !isUsed && (
                    <div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                      >
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${benefit.usage}%`,
                            backgroundColor:
                              benefit.usage > 75
                                ? 'var(--color-success)'
                                : benefit.usage > 50
                                  ? 'var(--color-info)'
                                  : 'var(--color-warning)',
                          }}
                        />
                      </div>
                      <span
                        className="text-xs mt-1 block"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {benefit.usage}% used
                      </span>
                    </div>
                  )}

                  {/* Action buttons - compact layout with period-aware labels */}
                  <div className="flex gap-1 mt-auto pt-2 flex-wrap">
                    {onMarkUsed && benefit.status === 'active' && (
                      isUsed ? (
                        /* Used state — disabled button with checkmark */
                        <Button
  variant="secondary"
  size="xs"
  disabled
  aria-disabled="true"
  className="flex-1 min-w-0"
  leftIcon={
    <CheckCircle2
      size={14}
      aria-hidden="true"
    />
  }
  aria-label={`${benefit.name} has been used${
    periodMonth ? ` for ${periodMonth}` : ''
  }`}
>
  Used
</Button>
                      ) : (
                        /* Active state — period-aware "Mark [Month] Used" */
                        <Button
  variant="secondary"
  size="xs"
  onClick={() => onMarkUsed(benefit.id)}
  className="flex-1 min-w-0"
  aria-label={`Mark ${benefit.name} as used${periodMonth ? ` for ${periodMonth}` : ''}`}
>
  {periodMonth
    ? `Mark ${periodMonth} Used`
    : 'Mark Used'}
</Button>
                      )
                    )}
                    {onEdit && (
                      <Button
                        variant="tertiary"
                        size="xs"
                        onClick={() => onEdit(benefit.id)}
                        className="flex-1 min-w-0"
                      >
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="tertiary"
                        size="xs"
                        onClick={() => onDelete(benefit.id)}
                        className="text-[var(--color-error)]"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Animation keyframes */}
        <style jsx>{`
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-benefit-card] {
      animation: none !important;
      transition: none !important;
    }
  }
`}</style>
      </div>
    );
  }
);

BenefitsGrid.displayName = 'BenefitsGrid';

export default BenefitsGrid;
