'use client';

import { useMemo } from 'react';
import type { Player } from '@/features/cards/lib/calculations';
import {
  getHouseholdROI,
  getHouseholdTotalCaptured,
  getHouseholdActiveCount,
} from '@/features/cards/lib/calculations';

/**
 * SummaryStats Component
 *
 * Displays three key metrics in a responsive grid:
 * 1. Total Household ROI - Net value gained/lost across all cards
 * 2. Total Benefits Captured - Value of benefits marked as used
 * 3. All-Time Insights - Count of active benefits
 *
 * Design:
 * - 1 column (mobile), 3 columns (tablet & desktop)
 * - Each card: 200px+ width, 140px height
 * - Responsive grid gap (16px mobile, 24px desktop)
 * - Hover effect: Lift (translateY -2px), shadow increase
 *
 * Data:
 * - Accepts array of players with their cards and benefits
 * - Aggregates household-level metrics
 * - Color-codes ROI based on positive/negative value
 */

interface SummaryStatsProps {
  players: Player[];
}

/**
 * Format currency as USD with proper sign
 */
function formatCurrency(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  const isNegative = cents < 0;
  return isNegative ? `-$${Math.abs(Number(dollars))}` : `$${dollars}`;
}

export default function SummaryStats({ players }: SummaryStatsProps) {
  // Memoize calculations to avoid recalculating on every render
  const metrics = useMemo(() => {
    const householdROI = getHouseholdROI(players);
    const totalCaptured = getHouseholdTotalCaptured(players);
    const activeCount = getHouseholdActiveCount(players);

    return {
      householdROI,
      totalCaptured,
      activeCount,
    };
  }, [players]);

  const isPositiveROI = metrics.householdROI >= 0;

  return (
    <section className="my-lg md:my-xl">
      {/* Responsive grid: 1 column mobile, 3 columns tablet+ */}
      <div
        className="grid gap-md md:gap-lg grid-cols-1 md:grid-cols-3"
      >
        {/* Stat Card 1: Total Household ROI */}
        <StatCard
          title="Total Household ROI"
          value={formatCurrency(metrics.householdROI)}
          subtitle="Net value across all cards"
          isPositive={isPositiveROI}
        />

        {/* Stat Card 2: Total Benefits Captured */}
        <StatCard
          title="Benefits Captured"
          value={formatCurrency(metrics.totalCaptured)}
          subtitle="Value of benefits marked used"
          isPositive={true}
        />

        {/* Stat Card 3: All-Time Insights */}
        <StatCard
          title="Active Benefits"
          value={metrics.activeCount.toString()}
          subtitle="Unclaimed benefits awaiting use"
          isPositive={true}
        />
      </div>
    </section>
  );
}

/**
 * Individual stat card component
 * Reusable card showing metric title, value, and subtitle
 */
function StatCard({
  title,
  value,
  subtitle,
  isPositive,
}: {
  title: string;
  value: string;
  subtitle: string;
  isPositive: boolean;
}) {
  // Determine color based on ROI sign
  const valueColor = isPositive
    ? 'var(--color-success-500)'
    : 'var(--color-danger-500)';

  return (
    <div
      className="rounded-lg border p-lg transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Title - 12px uppercase label */}
      <div
        className="uppercase tracking-wide font-semibold mb-md"
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </div>

      {/* Value - 32px bold number with color */}
      <div
        className="font-bold mb-sm"
        style={{
          fontSize: '32px',
          color: valueColor,
          lineHeight: '1.2',
        }}
      >
        {value}
      </div>

      {/* Subtitle - Small text additional context */}
      <div
        style={{
          fontSize: '12px',
          color: 'var(--color-text-secondary)',
          lineHeight: '1.4',
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}
