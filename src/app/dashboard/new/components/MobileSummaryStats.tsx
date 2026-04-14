'use client';

// ============================================================
// MobileSummaryStats — compact horizontal stat chips for mobile
// Shares the same stats array as DashboardSummary (DASH-041)
// Hidden on md+ screens via Tailwind `md:hidden` on the wrapper
// ============================================================

export interface MobileSummaryStatsProps {
  stats: Array<{ label: string; value: string | number }>;
}

export function MobileSummaryStats({ stats }: MobileSummaryStatsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
      role="group"
      aria-label="Benefit statistics summary"
    >
      {stats.map((stat) => (
        <span
          key={stat.label}
          className="flex-shrink-0 text-center px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            color: 'var(--color-text)',
          }}
          aria-label={`${stat.value} ${stat.label}`}
        >
          <span className="font-mono tabular-nums">{stat.value}</span>{' '}
          <span>{stat.label}</span>
        </span>
      ))}
    </div>
  );
}