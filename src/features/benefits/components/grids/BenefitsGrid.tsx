'use client';

import React, { useMemo } from 'react';
import Badge from '@/shared/components/ui/Badge';
import Button from '@/shared/components/ui/button';
import {
  Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2,
  Shield, Music, Tv, Star, Armchair, Hotel, Heart, Car, Landmark,
} from 'lucide-react';
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
  onMarkUsed?: (benefitId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  gridColumns?: 'auto' | 2 | 3 | 4;
  celebratingIds?: Set<string>;
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
// Helper: Left border color — neutral for all states (DASH-044)
// Status signaling reduced to 2 signals: badge + progress ring
// ---------------------------------------------------------------------------
function getLeftBorderColor(): string {
  return 'var(--color-border)';
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
function getProgressRingColor(isUsed?: boolean): string {
  if (isUsed) return 'var(--color-success)';
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
  isUsed?: boolean;
}) {
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = isUsed ? 100 : Math.min(Math.max(usage ?? 0, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  const ringColor = getProgressRingColor(isUsed);

  // No usage data and not used — don't render
  if (usage === undefined && !isUsed) return null;

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
      onMarkUsed,
      loading = false,
      emptyMessage = 'No benefits found',
      gridColumns = 3,
      celebratingIds,
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

    // DASH-G03 — Group consecutive benefits by period for shared headers
    const benefitGroups = useMemo(() => {
      const groups: {
        periodKey: string;
        periodLabel: string;
        cadenceLabel: string;
        benefits: Benefit[];
      }[] = [];

      for (const benefit of sortedBenefits) {
        const periodKey = benefit.periodStart
          ? formatPeriodRange(benefit.periodStart, benefit.periodEnd)
          : '';

        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.periodKey === periodKey) {
          lastGroup.benefits.push(benefit);
        } else {
          groups.push({
            periodKey,
            periodLabel: periodKey,
            cadenceLabel: getCadenceLabel(
              benefit.resetCadence,
              benefit.claimingCadence
            ),
            benefits: [benefit],
          });
        }
      }

      return groups;
    }, [sortedBenefits]);

    // Pre-compute animation indices across groups for staggered entry
    const cardAnimationIndices = useMemo(() => {
      const indices = new Map<string, number>();
      let idx = 0;
      for (const group of benefitGroups) {
        for (const b of group.benefits) {
          indices.set(b.id, idx++);
        }
      }
      return indices;
    }, [benefitGroups]);

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
        case 'insurance':
          return <Shield {...iconProps} aria-hidden="true" />;
        case 'entertainment':
          return <Music {...iconProps} aria-hidden="true" />;
        case 'streaming':
          return <Tv {...iconProps} aria-hidden="true" />;
        case 'points':
          return <Star {...iconProps} aria-hidden="true" />;
        case 'lounge':
        case 'airport':
          return <Armchair {...iconProps} aria-hidden="true" />;
        case 'hotel':
          return <Hotel {...iconProps} aria-hidden="true" />;
        case 'wellness':
        case 'fitness':
          return <Heart {...iconProps} aria-hidden="true" />;
        case 'transportation':
        case 'rideshare':
          return <Car {...iconProps} aria-hidden="true" />;
        case 'banking':
          return <Landmark {...iconProps} aria-hidden="true" />;
        default:
          return <Zap {...iconProps} aria-hidden="true" />;
      }
    };

    // Signal 2 of 2 — status badge (kept as a clear status communicator)
    // When isUsed && status === 'active', show "Used" badge instead
    const getStatusBadge = (status: Benefit['status'], isUsed?: boolean) => {
      // Show "Used" badge when the benefit has been claimed for this period
      if (isUsed && status === 'active') {
        return (
          <Badge variant="info" size="sm" className="text-[10px] !px-1.5 !py-0.5">
            Used
          </Badge>
        );
      }

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
        <Badge variant={variants[status]} size="sm" className="text-[10px] !px-1.5 !py-0.5">
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
              className="min-h-[160px] rounded-lg animate-pulse"
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
      <section ref={ref} aria-label="Your benefits" className={`grid ${getGridColsClass()} gap-4`}>
        {benefitGroups.map((group, groupIndex) => (
          <React.Fragment key={`group-${groupIndex}`}>
            {/* DASH-G03: Shared period header for consecutive same-period cards */}
            {group.periodKey && (
              <div
                className="col-span-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Calendar
                  size={14}
                  className="flex-shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-hidden="true"
                />
                <span className="font-medium">{group.periodLabel}</span>
                {group.cadenceLabel && (
                  <>
                    <span
                      className="mx-0.5"
                      style={{ opacity: 0.4 }}
                      aria-hidden="true"
                    >
                      |
                    </span>
                    <span>{group.cadenceLabel}</span>
                  </>
                )}
              </div>
            )}

            {group.benefits.map((benefit) => {
              const periodMonth = getPeriodMonth(benefit.periodStart);
              const progressText = getPeriodProgress(
                benefit.periodStart,
                benefit.resetCadence,
                benefit.claimingCadence
              );
              const isUsed = benefit.isUsed === true;
              const isAnnual = (benefit.claimingCadence || benefit.resetCadence || '').toUpperCase() === 'ANNUAL';
              const showRing = benefit.usage !== undefined || isUsed;
              const animIndex = cardAnimationIndices.get(benefit.id) ?? 0;

              return (
                <div
                  key={benefit.id}
                  data-benefit-card
                  onClick={() => onEdit?.(benefit.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(benefit.id); } }}
                  className={`rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-lg hover:-translate-y-1 flex flex-col min-h-[160px] cursor-pointer${celebratingIds?.has(benefit.id) ? ' animate-celebrate-used' : ''}`}
                  style={{
                    opacity: isUsed ? 0.7 : 1,
                    animation: `scaleIn 0.3s ease-out both`,
                    animationDelay: `${Math.min(animIndex * 50, 500)}ms`,
                    borderLeft: `3px solid ${getLeftBorderColor()}`,
                  }}
                >
                  {/* ── Card Body ── */}
                  <div
                    className="p-3 flex-1 flex flex-col"
                    style={{
                      backgroundColor: isUsed ? 'var(--color-bg-secondary)' : undefined,
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    {/* ── Row 1: Header — Icon + Name + Badge ── */}
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div
                          className="mt-0.5 flex-shrink-0"
                          style={{ color: 'var(--color-primary)' }}
                        >
                          {getBenefitTypeIcon(benefit.type)}
                        </div>
                        <p
                          className="flex-1 font-semibold line-clamp-2 min-w-0"
                          style={{
                            fontSize: 'var(--text-body-sm)',
                            color: 'var(--color-text)',
                          }}
                          title={benefit.name}
                        >
                          {benefit.name}
                        </p>
                      </div>
                      {getStatusBadge(benefit.status, isUsed)}
                    </div>

                    {/* ── Row 2: Value + Progress Ring ── */}
                    {(showRing || (benefit.value != null && benefit.value > 0)) && (
                      <div className="flex items-center justify-between gap-3 mb-2">
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
                        <ProgressRing usage={benefit.usage} isUsed={isUsed} />
                      </div>
                    )}

                    {/* ── Row 3: Description ── */}
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

                    {/* ── Row 4: Meta — period progress + expiration ── */}
                    <div className="flex items-center justify-between gap-2 mb-2">
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

                    {/* ── Row 5: Action buttons — stopPropagation to avoid card click ── */}
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
                            className="flex-1 min-w-0 min-h-[44px]"
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
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkUsed(benefit.id);
                            }}
                            className="flex-1 min-w-0 min-h-[44px]"
                            aria-label={`Mark ${benefit.name} as used${
                              periodMonth ? ` for ${periodMonth}` : ''
                            }`}
                          >
                            {!isAnnual && periodMonth
                              ? `Mark ${periodMonth} Used`
                              : 'Mark Used'}
                          </Button>
                        )
                      )}
                      {onEdit && (
                        <Button
                          variant="tertiary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(benefit.id);
                          }}
                          className="flex-1 min-w-0 min-h-[44px]"
                          aria-label={`Edit ${benefit.name}`}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </section>
    );
  }
);

BenefitsGrid.displayName = 'BenefitsGrid';

export default BenefitsGrid;
