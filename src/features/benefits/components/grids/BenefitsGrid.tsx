'use client';

import React, { useMemo } from 'react';
import Badge from '@/shared/components/ui/Badge';
import {
  Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2,
  Shield, Music, Tv, Star, Armchair, Hotel, Heart, Car, Landmark,
  Pencil,
} from 'lucide-react';
import { formatPeriodRange } from '@/lib/format-period-range';
import { UsedBenefitsAccordion } from './UsedBenefitsAccordion';

interface Benefit {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string;
  value?: number;
  usage?: number | null; // 0-100 percentage, null = unlimited/multiplier benefit
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

/** Cadence sort priority — lower number = shown first */
const CADENCE_ORDER: Record<string, number> = {
  MONTHLY: 0,
  QUARTERLY: 1,
  SEMI_ANNUAL: 2,
  ANNUAL: 3,
  ONE_TIME: 4,
};

function getCadencePriority(benefit: { resetCadence?: string; claimingCadence?: string | null }): number {
  const cadence = (benefit.claimingCadence || benefit.resetCadence || '').toUpperCase();
  return CADENCE_ORDER[cadence] ?? 5;
}

// ---------------------------------------------------------------------------
// Helper: Cadence info text for benefit cards (Sprint 11b)
// Returns a short human-readable description of the benefit's reset frequency.
// Checks specific benefit name overrides first, then falls back to generic text.
// ---------------------------------------------------------------------------
function getCadenceInfoText(
  name: string,
  resetCadence?: string,
  claimingCadence?: string | null
): string {
  const nameLower = name.toLowerCase();

  // ── Specific benefit name overrides ──
  if (/global entry|tsa precheck/i.test(nameLower)) return 'Once every 4.5 years';
  if (/\bclear\b.*credit|\bclear\+/i.test(nameLower)) return 'Once per year';
  if (/free night award/i.test(nameLower)) return 'Once per cardmember year';
  if (/centurion lounge/i.test(nameLower)) return 'Unlimited access';
  if (/priority pass/i.test(nameLower)) return 'Unlimited access';
  if (/fine hotels\s*&\s*resorts/i.test(nameLower)) return 'Use anytime';

  // ── Generic cadence-based fallback ──
  const cadence = (claimingCadence || resetCadence || '').toUpperCase();
  switch (cadence) {
    case 'MONTHLY':
      return 'Resets monthly';
    case 'QUARTERLY':
      return 'Resets quarterly';
    case 'SEMI_ANNUAL':
      return 'Resets every 6 months';
    case 'ANNUAL':
      return 'Resets annually';
    case 'ONE_TIME':
      return 'One-time benefit';
    case 'FLEXIBLE_ANNUAL':
      return 'Use anytime this year';
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
  usage?: number | null;
  isUsed?: boolean;
}) {
  const size = 40;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // No usage data and not used — don't render
  if (usage === undefined && !isUsed) return null;

  // Infinity mode — unlimited/multiplier benefits
  if (usage === null) {
    // M-1 fix: Dynamic color — green when used, accent when unused
    const infinityColor = isUsed
      ? 'var(--color-success)'
      : 'var(--color-accent, var(--color-primary))';
    return (
      <div
        className="relative flex-shrink-0"
        style={{ width: size, height: size }}
        role="img"
        aria-label="Unlimited benefit"
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Full ring background (faded) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={infinityColor}
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          {/* Full ring foreground */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={infinityColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center leading-none"
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: infinityColor,
          }}
          aria-hidden="true"
        >
          ∞
        </span>
      </div>
    );
  }

  const pct = Math.min(Math.max(usage ?? 0, 0), 100);
  const offset = circumference - (pct / 100) * circumference;
  const ringColor = getProgressRingColor(isUsed);

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
        {...(pct >= 100 ? { 'data-ring-complete': '' } as Record<string, string> : {})}
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
          className="progress-ring-circle animate-ring-fill"
          style={{
            '--ring-circumference': circumference,
            '--ring-offset': offset,
          } as React.CSSProperties}
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

// ---------------------------------------------------------------------------
// Helper: Infer a UI category from the DB benefit type AND the benefit name
// DB types: StatementCredit, TravelPerk, Insurance, Rewards, UsagePerk, Other
// ---------------------------------------------------------------------------
function inferBenefitCategory(type?: string, name?: string): string {
  const nameLower = (name || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();

  // Name-based inference (most specific)
  if (/uber|lyft|ride/.test(nameLower)) return 'rideshare';
  if (/dining|restaurant|resy|grubhub|dunkin|food/.test(nameLower)) return 'dining';
  if (/hotel|hilton|hyatt|marriott|bonvoy|ihg/.test(nameLower)) return 'hotel';
  if (/lounge|priority pass|centurion/.test(nameLower)) return 'lounge';
  if (/travel|flight|airline|tsa|precheck|global entry/.test(nameLower)) return 'travel';
  if (/entertain|spotify|audible|disney|hulu|peacock|sirius/.test(nameLower)) return 'entertainment';
  if (/stream|netflix|hbo|paramount|apple\s*tv/.test(nameLower)) return 'streaming';
  if (/shop|saks|nordstrom|walmart|dell|best buy/.test(nameLower)) return 'shopping';
  if (/fitness|gym|equinox|wellness|peloton|oura/.test(nameLower)) return 'wellness';
  if (/insur|protect|luggage|cancel|delay|medical|dental/.test(nameLower)) return 'insurance';
  if (/point|reward|bonus|earn|multiplier|\dx\b/.test(nameLower)) return 'points';
  if (/cash\s*back|statement\s*credit|annual\s+credit|monthly\s+credit/.test(nameLower)) return 'cashback';
  if (/clear|bag|board|companion|free night/.test(nameLower)) return 'travel';

  // Type-based fallback
  if (typeLower === 'travelperk') return 'travel';
  if (typeLower === 'insurance') return 'insurance';
  if (typeLower === 'rewards') return 'points';
  if (typeLower === 'statementcredit') return 'cashback';
  if (typeLower === 'usageperk') return 'points';

  return 'default';
}

// ---------------------------------------------------------------------------
// Helper: Extract point multiplier from benefit name (e.g., "5x Points on Hotels" → 5)
// ---------------------------------------------------------------------------
function extractMultiplier(name?: string): number | null {
  if (!name) return null;
  const match = name.match(/(\d+\.?\d*)x\b/i);
  return match ? parseFloat(match[1]) : null;
}

// ---------------------------------------------------------------------------
// E-4: Format benefit type name for display
// "STATEMENT_CREDIT" → "Statement Credits", "TRAVEL" → "Travel", etc.
// ---------------------------------------------------------------------------
function formatBenefitTypeName(type: string): string {
  const typeLower = type.toLowerCase();
  // Common DB types
  const typeMap: Record<string, string> = {
    insurance: 'Insurance',
    cashback: 'Cashback',
    travel: 'Travel',
    banking: 'Banking',
    points: 'Points',
    other: 'Other',
    statementcredit: 'Statement Credits',
    travelperk: 'Travel Perks',
    usageperk: 'Usage Perks',
    rewards: 'Rewards',
  };

  if (typeMap[typeLower]) return typeMap[typeLower];

  // Fallback: convert UPPER_SNAKE or camelCase to Title Case
  return type
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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
    // Phase 2 + Sprint 29C — sort: unused first, then by cadence priority
    const sortedBenefits = useMemo(() => {
      return [...benefits].sort((a, b) => {
        // Primary: unused before used (normalize to boolean for antisymmetry)
        const aUsed = !!a.isUsed;
        const bUsed = !!b.isUsed;
        if (aUsed !== bUsed) return aUsed ? 1 : -1;
        // Secondary: cadence priority (Monthly first, then Quarterly, etc.)
        const cadenceA = getCadencePriority(a);
        const cadenceB = getCadencePriority(b);
        if (cadenceA !== cadenceB) return cadenceA - cadenceB;
        return 0;
      });
    }, [benefits]);

    // DASH-G03 + Sprint 29C — Map-based consolidation so same-period benefits
    // are always grouped together regardless of sort position.
    const benefitGroups = useMemo(() => {
      const groupMap = new Map<string, {
        periodKey: string;
        periodLabel: string;
        cadenceLabel: string;
        benefits: Benefit[];
      }>();

      for (const benefit of sortedBenefits) {
        // Used benefits go into a single "Used" group
        const groupKey = benefit.isUsed
          ? '__used__'
          : (benefit.periodStart
              ? formatPeriodRange(benefit.periodStart, benefit.periodEnd)
              : '');

        const existing = groupMap.get(groupKey);
        if (existing) {
          existing.benefits.push(benefit);
        } else {
          groupMap.set(groupKey, {
            periodKey: groupKey,
            periodLabel: groupKey === '__used__' ? 'Used' : groupKey,
            cadenceLabel: groupKey === '__used__'
              ? ''
              : getCadenceLabel(
                  benefit.resetCadence,
                  benefit.claimingCadence
                ),
            benefits: [benefit],
          });
        }
      }

      return Array.from(groupMap.values());
    }, [sortedBenefits]);

    // E-4: Detect if type grouping headers should be shown
    // Only show type headers when 2+ different types exist
    const distinctTypes = useMemo(() => {
      const types = new Set<string>();
      for (const b of benefits) {
        if (b.type) types.add(b.type);
      }
      return types;
    }, [benefits]);
    const showTypeHeaders = distinctTypes.size >= 2;

    // E-4: Sub-group benefits within each group by type
    // Returns an ordered list of { typeLabel, benefits } for a given benefit list
    const getTypeSubgroups = useMemo(() => {
      if (!showTypeHeaders) return null;
      return (groupBenefits: Benefit[]) => {
        const typeMap = new Map<string, Benefit[]>();
        for (const b of groupBenefits) {
          const typeKey = b.type || 'Other';
          const existing = typeMap.get(typeKey);
          if (existing) {
            existing.push(b);
          } else {
            typeMap.set(typeKey, [b]);
          }
        }
        return Array.from(typeMap.entries()).map(([typeKey, typeBenefits]) => ({
          typeLabel: formatBenefitTypeName(typeKey),
          benefits: typeBenefits,
        }));
      };
    }, [showTypeHeaders]);

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

    // Benefit type icons — uses inferred category from DB type + benefit name
    const getBenefitTypeIcon = (type?: string, name?: string) => {
      const category = inferBenefitCategory(type, name);
      const iconProps = { size: 16, className: 'flex-shrink-0' };
      switch (category) {
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

    // ------------------------------------------------------------------
    // Shared card body renderer — used by both inline rendering and the
    // UsedBenefitsAccordion's renderCard prop to avoid JSX duplication.
    // ------------------------------------------------------------------
    const renderCardBody = (benefit: Benefit) => {
      const periodMonth = getPeriodMonth(benefit.periodStart);
      const progressText = getPeriodProgress(
        benefit.periodStart,
        benefit.resetCadence,
        benefit.claimingCadence
      );
      const isUsed = benefit.isUsed === true;
      const cadenceText = getCadenceInfoText(benefit.name, benefit.resetCadence, benefit.claimingCadence);

      return (
        <div
          className="p-2.5 flex-1 flex flex-col"
          style={{
            backgroundColor: isUsed ? 'var(--color-bg-secondary)' : undefined,
            transition: 'background-color 0.2s ease',
          }}
        >
          {/* ── Row 1: Header — Icon + Name + Badge ── */}
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div
                className="flex-shrink-0"
                style={{
                  color: 'var(--color-primary)',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--color-bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getBenefitTypeIcon(benefit.type, benefit.name)}
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

          {/* ── Row 2: Value · Cadence + Progress Ring (merged, Sprint 28B) ── */}
          {(() => {
            const multiplier = extractMultiplier(benefit.name);
            const isUnlimited = benefit.usage === null;
            const hasMonetaryValue = benefit.value != null && benefit.value > 0;
            const showRow = hasMonetaryValue || isUnlimited || multiplier !== null || !!cadenceText;

            if (!showRow) return null;

            return (
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {multiplier !== null ? (
                    <span
                      className="font-mono font-bold text-base px-2 py-0.5 rounded flex-shrink-0"
                      style={{
                        color: 'var(--color-accent, var(--color-primary))',
                        backgroundColor: 'var(--color-accent-subtle, rgba(59, 130, 246, 0.1))',
                      }}
                    >
                      {multiplier}x
                    </span>
                  ) : hasMonetaryValue ? (
                    <span
                      className="font-mono font-semibold text-base flex-shrink-0"
                      style={{ color: 'var(--color-text)' }}
                    >
                      ${(benefit.value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  ) : null}
                  {cadenceText && (hasMonetaryValue || multiplier !== null) && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                  )}
                  {cadenceText && (
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-tertiary)' }}>
                      {cadenceText}
                    </span>
                  )}
                </div>
                <ProgressRing usage={benefit.usage} isUsed={isUsed} />
              </div>
            );
          })()}

          {/* ── Row 3: Description ── */}
          <div className="flex-1 min-h-0">
            {benefit.description && (
              <p
                className="text-xs line-clamp-2 mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
                title={benefit.description}
              >
                {benefit.description}
              </p>
            )}
          </div>

          {/* ── Row 4: Meta — period progress + expiration + inline action icons (Sprint 28B) ── */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="text-xs truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {progressText}
              </span>
              {benefit.expirationDate && (
                <span
                  className="text-xs flex-shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Exp: {formatDate(benefit.expirationDate)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {onMarkUsed && benefit.status === 'active' && (
                isUsed ? (
                  <button
                    type="button"
                    disabled
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-[var(--color-text-tertiary)] opacity-50 cursor-not-allowed${celebratingIds?.has(benefit.id) ? ' animate-toggle-check' : ''}`}
                    aria-label={`${benefit.name} has been used${
                      periodMonth ? ` for ${periodMonth}` : ''
                    }`}
                  >
                    <CheckCircle2 size={16} fill="currentColor" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkUsed(benefit.id);
                    }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors press-feedback"
                    aria-label={`Mark ${benefit.name} as used${
                      periodMonth ? ` for ${periodMonth}` : ''
                    }`}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                  </button>
                )
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(benefit.id);
                  }}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors press-feedback"
                  aria-label={`Edit ${benefit.name}`}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    if (loading) {
      return (
        <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="min-h-[120px] rounded-lg"
              style={{
                background: 'linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary, var(--color-bg)) 50%, var(--color-bg-secondary) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s infinite linear',
              }}
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
        {benefitGroups.map((group, groupIndex) => {
          // ── Used benefits → delegate to UsedBenefitsAccordion ──
          if (group.periodKey === '__used__') {
            return (
              <UsedBenefitsAccordion
                key="used-benefits-accordion"
                benefits={group.benefits}
                gridColsClass={getGridColsClass()}
                renderCard={(benefit) => {
                  return (
                    <div
                      data-benefit-card
                      onClick={() => onEdit?.(benefit.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(benefit.id); } }}
                      className={`rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] hover:border-[var(--color-primary)] flex flex-col cursor-pointer${celebratingIds?.has(benefit.id) ? ' animate-celebrate-used' : ''}`}
                      style={{
                        opacity: 0.85,
                        borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)',
                        borderLeft: `3px solid ${getLeftBorderColor()}`,
                      }}
                    >
                      {/* Card body — shared with inline rendering */}
                      {renderCardBody(benefit as Benefit)}
                    </div>
                  );
                }}
              />
            );
          }

          // ── Regular period groups → render as before ──
          // E-4: Optionally sub-group by benefit type within each period group
          return (
            <React.Fragment key={`group-${groupIndex}`}>
              {/* DASH-G03: Shared period header for consecutive same-period cards */}
              {group.periodKey && (
                <div
                  className="col-span-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg"
                  style={{
                    background: 'var(--color-bg-subtle, var(--color-bg-secondary))',
                    color: 'var(--color-text-secondary)',
                    borderLeft: '3px solid var(--color-primary)',
                    paddingLeft: '0.5rem',
                    borderTopLeftRadius: '2px',
                    borderBottomLeftRadius: '2px',
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

              {/* E-4: Render with or without type sub-grouping */}
              {getTypeSubgroups ? (
                getTypeSubgroups(group.benefits).map((typeGroup, typeIdx) => (
                  <React.Fragment key={`type-${groupIndex}-${typeIdx}`}>
                    {/* Type section header */}
                    <div
                      className="col-span-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium"
                      style={{
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <span>{typeGroup.typeLabel}</span>
                      <span
                        className="flex-1 border-b"
                        style={{ borderColor: 'var(--color-border)' }}
                        aria-hidden="true"
                      />
                    </div>
                    {typeGroup.benefits.map((benefit) => {
                      const isUsed = benefit.isUsed === true;
                      const animIndex = cardAnimationIndices.get(benefit.id) ?? 0;
                      return (
                        <div
                          key={benefit.id}
                          data-benefit-card
                          onClick={() => onEdit?.(benefit.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(benefit.id); } }}
                          className={`rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] hover:border-[var(--color-primary)] flex flex-col cursor-pointer${celebratingIds?.has(benefit.id) ? ' animate-celebrate-used' : ''}`}
                          style={{
                            opacity: isUsed ? 0.85 : 1,
                            animation: celebratingIds?.has(benefit.id)
                              ? undefined
                              : `slideUp 0.3s ease-out both`,
                            animationDelay: celebratingIds?.has(benefit.id)
                              ? undefined
                              : `${Math.min(animIndex * 60, 500)}ms`,
                            borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)',
                            borderLeft: `3px solid ${getLeftBorderColor()}`,
                          }}
                        >
                          {renderCardBody(benefit)}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))
              ) : (
                group.benefits.map((benefit) => {
                  const isUsed = benefit.isUsed === true;
                  const animIndex = cardAnimationIndices.get(benefit.id) ?? 0;

                  return (
                    <div
                      key={benefit.id}
                      data-benefit-card
                      onClick={() => onEdit?.(benefit.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit?.(benefit.id); } }}
                      className={`rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] hover:border-[var(--color-primary)] flex flex-col cursor-pointer${celebratingIds?.has(benefit.id) ? ' animate-celebrate-used' : ''}`}
                      style={{
                        opacity: isUsed ? 0.85 : 1,
                        animation: celebratingIds?.has(benefit.id)
                          ? undefined
                          : `slideUp 0.3s ease-out both`,
                        animationDelay: celebratingIds?.has(benefit.id)
                          ? undefined
                          : `${Math.min(animIndex * 60, 500)}ms`,
                        borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)',
                        borderLeft: `3px solid ${getLeftBorderColor()}`,
                      }}
                    >
                      {/* Card body — shared with accordion rendering */}
                      {renderCardBody(benefit)}
                    </div>
                  );
                })
              )}
            </React.Fragment>
          );
        })}
      </section>
    );
  }
);

BenefitsGrid.displayName = 'BenefitsGrid';

export default BenefitsGrid;
