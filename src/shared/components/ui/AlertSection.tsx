'use client';

import { useState, useMemo } from 'react';
import { deduplicateBenefits } from '@/lib/benefit-utils';
import { featureFlags } from '@/lib/feature-flags';

/**
 * AlertSection Component
 * 
 * Displays alerts for expiring benefits organized by severity:
 * - Critical: Expires < 3 days (red background)
 * - Warning: Expires 3-14 days (orange background)
 * - Info: Expires 14-30 days (blue background)
 * 
 * Features:
 * - Sticky positioning (top: header height)
 * - Dismissible alerts (user can hide via state)
 * - Empty state when no expirations in next 30 days
 * - Responsive layout (full-width mobile, flexible desktop)
 * - Deduplicates period rows when benefit engine is enabled (fe-5)
 * 
 * Design:
 * - Left border: 4px solid color (red/orange/blue)
 * - Padding: 16px
 * - Margin-bottom: 16px
 * - Icon + text + optional actions
 * - Smooth transitions and hover effects
 */

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string; // Can be 'StatementCredit' | 'UsagePerk'
  resetCadence: string;
  // Period dedup fields — required by deduplicateBenefits()
  masterBenefitId?: string | null;
  userCardId?: string | null;
  periodStatus?: string | null;
}

interface UserCard {
  userBenefits: UserBenefit[];
}

interface Player {
  userCards: UserCard[];
}

interface AlertSectionProps {
  players: Player[];
}

type AlertLevel = 'critical' | 'warning' | 'info';

interface ExpiringBenefit {
  benefit: UserBenefit;
  daysUntilExpiration: number;
  level: AlertLevel;
}

/**
 * Get resolved benefit value
 */
function getResolvedValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * Format currency
 */
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Find all expiring benefits organized by urgency.
 *
 * When BENEFIT_ENGINE_ENABLED is true, deduplicates period rows so each
 * unique benefit generates at most one alert (fe-5 fix).
 */
function getExpiringBenefits(players: Player[]): ExpiringBenefit[] {
  const now = new Date();
  const engineEnabled = featureFlags.BENEFIT_ENGINE_ENABLED;
  const expiringBenefits: ExpiringBenefit[] = [];

  for (const player of players) {
    for (const card of player.userCards) {
      // Deduplicate period rows — keeps only the ACTIVE period row per
      // unique benefit when engine is enabled; no-op when engine is OFF.
      const benefits = deduplicateBenefits(card.userBenefits, engineEnabled);

      for (const benefit of benefits) {
        // Skip if no expiration date
        if (!benefit.expirationDate) continue;
        
        // Only alert for unused benefits
        if (benefit.isUsed) continue;

        const daysUntilExpiration = Math.floor(
          (benefit.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Only include if expiring within 30 days and not expired
        if (daysUntilExpiration < 30 && daysUntilExpiration >= 0) {
          const level: AlertLevel =
            daysUntilExpiration < 3
              ? 'critical'
              : daysUntilExpiration < 14
              ? 'warning'
              : 'info';

          expiringBenefits.push({
            benefit,
            daysUntilExpiration,
            level,
          });
        }
      }
    }
  }

  // Sort by days until expiration (most urgent first)
  expiringBenefits.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  return expiringBenefits;
}

/**
 * Get color config for alert level
 */
function getAlertColors(
  level: AlertLevel
): {
  bg: string;
  border: string;
  text: string;
  borderLeft: string;
  icon: string;
} {
  switch (level) {
    case 'critical':
      return {
        bg: 'var(--color-danger-50)',
        border: 'var(--color-danger-500)',
        text: 'var(--color-danger-600)',
        borderLeft: 'var(--color-danger-500)',
        icon: '🔴',
      };
    case 'warning':
      return {
        bg: 'var(--color-alert-50)',
        border: 'var(--color-alert-500)',
        text: 'var(--color-alert-600)',
        borderLeft: 'var(--color-alert-500)',
        icon: '⚠️',
      };
    case 'info':
      return {
        bg: 'var(--color-bg-tertiary)',
        border: 'var(--color-border)',
        text: 'var(--color-text-secondary)',
        borderLeft: 'var(--color-primary-500)',
        icon: 'ℹ️',
      };
  }
}

export default function AlertSection({ players }: AlertSectionProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const expiringBenefits = useMemo(
    () => getExpiringBenefits(players),
    [players]
  );

  // Filter out dismissed alerts
  const visibleAlerts = expiringBenefits.filter(
    (alert) => !dismissedAlerts.has(alert.benefit.id)
  );

  const handleDismiss = (benefitId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(benefitId));
  };

  // Empty state
  if (visibleAlerts.length === 0) {
    return (
      <section
        className="sticky z-40 px-md md:px-tablet lg:px-desktop py-md"
        style={{
          top: 'var(--height-header)',
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          className="rounded-md p-md text-center"
          style={{
            backgroundColor: 'var(--color-success-50)',
            color: 'var(--color-success-600)',
            border: '1px solid var(--color-success-500)',
          }}
        >
          <p className="text-sm font-medium">
            ✓ No expirations in the next 30 days. You're all set!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="sticky z-40 px-md md:px-tablet lg:px-desktop py-md space-y-md"
      style={{
        top: 'var(--height-header)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {visibleAlerts.map((alert) => {
        const colors = getAlertColors(alert.level);
        const value = formatCurrency(getResolvedValue(alert.benefit));
        const daysText =
          alert.daysUntilExpiration === 0
            ? 'Today'
            : alert.daysUntilExpiration === 1
            ? 'Tomorrow'
            : `in ${alert.daysUntilExpiration} days`;

        return (
          <AlertBox
            key={alert.benefit.id}
            icon={colors.icon}
            title={alert.benefit.name}
            value={value}
            daysText={daysText}
            colors={colors}
            onDismiss={() => handleDismiss(alert.benefit.id)}
          />
        );
      })}
    </section>
  );
}

/**
 * Individual alert box component
 */
function AlertBox({
  icon,
  title,
  value,
  daysText,
  colors,
  onDismiss,
}: {
  icon: string;
  title: string;
  value: string;
  daysText: string;
  colors: ReturnType<typeof getAlertColors>;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-md p-md border flex items-start justify-between gap-md transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderLeft: `4px solid ${colors.borderLeft}`,
        color: colors.text,
      }}
    >
      {/* Content */}
      <div className="flex items-start gap-md flex-1 min-w-0">
        <span className="text-lg flex-shrink-0 pt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm mb-xs">{title}</p>
          <p className="text-xs opacity-75">
            {value} • expires {daysText}
          </p>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 rounded-md p-xs hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: 'transparent',
          color: 'inherit',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Dismiss alert"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}
