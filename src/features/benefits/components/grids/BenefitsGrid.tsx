'use client';

import React, { useMemo } from 'react';
import Badge from '@/shared/components/ui/Badge';
import Button from '@/shared/components/ui/button';
import { Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2, Check } from 'lucide-react';
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
// Signal 1 of 2 — kept as a subtle status indicator
// ---------------------------------------------------------------------------
function getLeftBorderColor(benefit: Benefit): string {
  if (benefit.isUsed) {
    return 'rgba(107, 114, 128, 0.3)';
  }
  const status = benefit.periodStatus?.toUpperCase();
  switch (status) {
    case 'ACTIVE':
      return 'var(--color-success)';
    case 'EXPIRED':
      return 'rgba(107, 114, 128, 0.4)';
    case 'UPCOMING':
      return 'var(--color-info)';
    default:
      return 'var(--color-border)';
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

// ---------------------------------------------------------------------------
// Helper: Progress ring stroke color by percentage
// green >75%, blue >50%, amber ≤50%
// ---------------------------------------------------------------------------
function getProgressRingColor(_usage: number): string {
  return 'var(--color-primary)';
}

// ---------------------------------------------------------------------------
// Sub-component: SVG Circular Progress Ring
// 40px diameter, stroke-dasharray/offset for percentage, center text
// ---------------------------------------------------------------------------
function ProgressRing({
  usage,
  isUsed,
}: {
  usage?: number;
  isUsed: boolean;
}) {
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(usage ?? 0, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  const ringColor = getProgressRingColor(pct);

  // When used — show a checkmark icon instead of the ring
  if (isUsed) {
    return (
      <div
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{
          width: size,
          height: size,
          backgroundColor: 'var(--color-success-light)',
        }}
        role="img"
        aria-label="Benefit used"
      >
        <Check
          size={18}
          strokeWidth={2.5}
          style={{ color: 'var(--color-success)' }}
          aria-hidden="true"
        />
      </div>
    );
  }

  // No usage data — don't render
  if (usage === undefined) return null;

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% used`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="progress-ring-svg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-circle"
        />
        )}
      </svg>
      {/* Center percentage */}
      <span
        className="absolute inset-0 flex items-center justify-center font-mono leading-none"
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
        aria-hidden="true"
      >
        {pct}%
      </span>
    </div>
  );
}

/**
 * BenefitsGrid Component - Grid View of Benefits
 *
 * Sprint 4 Redesign — polished, professional, visually clean.
 *
 * Design principles:
 * - **MAX 2 color signals**: left border stripe + status badge only
 * - **Circular progress ring**: SVG ring replaces flat progress bar
 * - **Uniform card heights**: min-h, flex layout, actions pinned to bottom
 * - **Clear info hierarchy**: name → value → description/meta → actions
 * - **Neutral period banner**: no per-status color variation
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
      const iconProps = { size: 16, className: 'flex-shrink-0' };
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

    // Signal 2 of 2 — status badge (kept as a clear status communicator)
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
              className="min-h-[200px] rounded-lg animate-pulse"
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
      <>
      <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
        {sortedBenefits.map((benefit, index) => {
          const hasPeriodData = Boolean(benefit.periodStart);
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
          const showRing = benefit.usage !== undefined || isUsed;

          return (
            <div
              key={benefit.id}
              data-benefit-card
              className="rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-lg hover:-translate-y-1 flex flex-col min-h-[200px]"
              style={{
                animation: `scaleIn 0.3s ease-out forwards`,
                animationDelay: `${Math.min(index * 50, 500)}ms`,
                borderLeft: `3px solid ${getLeftBorderColor(benefit)}`,
              }}
            >
              {/* ── Period Banner — neutral bg, no per-status color variation ── */}
              {hasPeriodData && (
                <div
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-secondary)',
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
                    style={{ color: 'var(--color-text-secondary)' }}
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

              {/* ── Card Body — flex-1 fills remaining height for uniform cards ── */}
              <div
                className="p-4 flex-1 flex flex-col"
                style={{
                  backgroundColor: isUsed ? 'var(--color-bg-secondary)' : undefined,
                  transition: 'background-color 0.2s ease',
                }}
              >
                {/* ── Row 1: Header — Icon + Name + Badge ── */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {getBenefitTypeIcon(benefit.type)}
                    </div>
                    {/* Primary: Benefit name */}
                    <h3
                      className="flex-1 font-semibold line-clamp-2 min-w-0"
                      style={{
                        fontSize: 'var(--text-body-sm)',
                        color: 'var(--color-text)',
                      }}
                      title={benefit.name}
                    >
                      {benefit.name}
                    </h3>
                  </div>
                  {/* Signal 2: Status badge */}
                  {getStatusBadge(benefit.status)}
                </div>

                {/* ── Row 2: Value + Progress Ring — secondary info ── */}
                {(showRing || (benefit.value != null && benefit.value > 0)) && (
                  <div className="flex items-center justify-between gap-3 mb-3">
                    {/* Secondary: Value amount — neutral color, not green */}
                    {benefit.value != null && benefit.value > 0 ? (
                      <span
                        className="font-mono font-semibold text-base"
                        style={{ color: 'var(--color-text)' }}
                      >
                        ${benefit.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span />
                    )}
                    {/* SVG progress ring or used-checkmark */}
                    <ProgressRing usage={benefit.usage} isUsed={isUsed} />
                  </div>
                )}

                {/* ── Row 3: Description — tertiary, flex-1 absorbs variable height ── */}
                <div className="flex-1 min-h-0">
                  {benefit.description && (
                    <p
                      className="text-xs line-clamp-2 mb-2"
                      style={{ color: 'var(--color-text-secondary)' }}
                      title={benefit.description}
                    >
                      {benefit.description}
                    </p>
                  )}
                </div>

                {/* ── Row 4: Meta — period progress + expiration (tertiary) ── */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {progressText}
                  </span>
                  {benefit.expirationDate && (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Exp: {formatDate(benefit.expirationDate)}
                    </span>
                  )}
                </div>

                {/* ── Row 5: Action buttons — pinned to bottom via mt-auto ── */}
                <div
                  className="flex gap-2 mt-auto pt-3 flex-wrap"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  {onMarkUsed && benefit.status === 'active' && (
                    isUsed ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        disabled
                        aria-disabled="true"
                        className="flex-1 min-w-0"
                        leftIcon={
                          <CheckCircle2 size={14} aria-hidden="true" />
                        }
                        aria-label={`${benefit.name} has been used${
                          periodMonth ? ` for ${periodMonth}` : ''
                        }`}
                      >
                        Used
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => onMarkUsed(benefit.id)}
                        className="flex-1 min-w-0"
                        aria-label={`Mark ${benefit.name} as used${
                          periodMonth ? ` for ${periodMonth}` : ''
                        }`}
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
                      aria-label={`Edit ${benefit.name}`}
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
                      aria-label={`Delete ${benefit.name}`}
                    >
                      ×
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

        {/* Animation keyframes + progress ring transition */}
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
          .progress-ring-circle {
            transition: stroke-dashoffset 0.6s ease;
          }
          @media (prefers-reduced-motion: reduce) {
            [data-benefit-card] {
              animation: none !important;
              transition: none !important;
            }
            .progress-ring-circle {
              transition: none !important;
            }
          }
        `}</style>
      </>
    );
  }
);

BenefitsGrid.displayName = 'BenefitsGrid';

export default BenefitsGrid;
