'use client';

// ============================================================
// MobileSummaryStats — compact horizontal stat chips for mobile
// Hidden on md+ screens via Tailwind `md:hidden` on the wrapper
// ============================================================

export interface MobileSummaryStatsProps {
  totalBenefits: number;
  usedBenefits: number;
  unusedBenefits: number;
}

export function MobileSummaryStats({
  totalBenefits,
  usedBenefits,
  unusedBenefits,
}: MobileSummaryStatsProps) {
  return (
    <div
      className="flex gap-2"
      role="group"
      aria-label="Benefit statistics summary"
    >
      {/* Total */}
      <StatChip
        value={totalBenefits}
        label="Total"
        bgVar="--color-bg-secondary"
        textVar="--color-text"
      />

      {/* Used */}
      <StatChip
        value={usedBenefits}
        label="Used"
        bgVar="--color-info-light"
        textVar="--color-info"
      />

      {/* Remaining */}
      <StatChip
        value={unusedBenefits}
        label="Left"
        bgVar="--color-success-light"
        textVar="--color-success"
      />
    </div>
  );
}

// ============================================================
// StatChip — individual rounded-full stat pill
// ============================================================

function StatChip({
  value,
  label,
  bgVar,
  textVar,
}: {
  value: number;
  label: string;
  /** CSS custom property name for background, e.g. "--color-bg-secondary" */
  bgVar: string;
  /** CSS custom property name for text, e.g. "--color-text" */
  textVar: string;
}) {
  return (
    <span
      className="flex-1 text-center px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{
        backgroundColor: `var(${bgVar})`,
        color: `var(${textVar})`,
      }}
      aria-label={`${value} ${label}`}
    >
      {value} {label}
    </span>
  );
}