'use client';

import { useMemo } from 'react';

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

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string; // Can be 'StatementCredit' | 'UsagePerk'
  timesUsed: number;
  resetCadence: string;
}

interface UserCard {
  id: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date;
  isOpen: boolean;
  masterCard: {
    id: string;
    issuer: string;
    cardName: string;
    defaultAnnualFee: number;
    cardImageUrl: string;
  };
  userBenefits: UserBenefit[];
}

interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}

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

/**
 * Get resolved benefit value (prefer user-declared over sticker value)
 */
function getResolvedValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * Calculate total benefits captured (used benefits value)
 */
function getTotalCaptured(players: Player[]): number {
  let total = 0;
  for (const player of players) {
    for (const card of player.userCards) {
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          total += getResolvedValue(benefit);
        }
      }
    }
  }
  return total;
}

/**
 * Count total active benefits
 */
function getActiveCount(players: Player[]): number {
  let count = 0;
  const now = new Date();
  for (const player of players) {
    for (const card of player.userCards) {
      count += card.userBenefits.filter(
        (b) => !b.isUsed && b.expirationDate && b.expirationDate > now
      ).length;
    }
  }
  return count;
}

/**
 * Calculate household-level effective ROI
 * ROI = Total benefits captured - Total net annual fees
 */
function calculateHouseholdROI(players: Player[]): number {
  let totalCaptured = 0;
  let totalFees = 0;

  for (const player of players) {
    for (const card of player.userCards) {
      // Add captured benefit value
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          totalCaptured += getResolvedValue(benefit);
        }
      }

      // Subtract net annual fee
      const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
      totalFees += annualFee;
    }
  }

  return totalCaptured - totalFees;
}

export default function SummaryStats({ players }: SummaryStatsProps) {
  // Memoize calculations to avoid recalculating on every render
  const metrics = useMemo(() => {
    const householdROI = calculateHouseholdROI(players);
    const totalCaptured = getTotalCaptured(players);
    const activeCount = getActiveCount(players);

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
