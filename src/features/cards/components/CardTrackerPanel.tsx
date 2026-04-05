'use client';

/**
 * CardTrackerPanel.tsx
 *
 * Displays a single user card's benefits in an interactive table with:
 * - Optimistic checkbox toggling for benefit claim tracking
 * - Expiration colour-coding (critical red, warning orange, normal gray)
 * - Live ROI/summary metrics that update instantly on toggle
 * - Benefit value overrides with visual indicators
 *
 * Architecture:
 * - Local `benefits` state for optimistic updates (instant UI feedback)
 * - `useTransition` for non-blocking async server actions
 * - Benefit-specific `isPending` state for per-checkbox loading indicators
 * - Module-level utilities (getRowClass) for stable references
 * - All calculations derived from live state, no stale values
 *
 * Performance:
 * - useCallback memoization for stable event handlers
 * - Snapshot of `now` per render for consistent expiration logic
 * - Module functions prevent unnecessary re-creation
 */

import { useState, useTransition } from 'react';
import type { UserCard, UserBenefit } from '@prisma/client';
import {
  getEffectiveROI,
  getTotalValueExtracted,
  getUncapturedValue,
  getNetAnnualFee,
  MS_PER_DAY,
} from '@/features/cards/lib/calculations';
import { formatCurrency } from '@/shared/lib';
import { toggleBenefit } from '@/features/benefits';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * CardTrackerPanelProps - Props for the CardTrackerPanel component.
 *
 * Type-safe props using Prisma types. Expects UserCard with relationships:
 * - masterCard: Must be included (with issuer, cardName, defaultAnnualFee)
 * - userBenefits: Must be eagerly loaded for benefits table
 *
 * All other UserCard fields (playerId, masterCardId, createdAt, updatedAt)
 * are required but not used by this component.
 */
export interface CardTrackerPanelProps {
  userCard: UserCard & {
    masterCard: {
      id: string;
      issuer: string;
      cardName: string;
      defaultAnnualFee: number;
      cardImageUrl: string;
    };
    userBenefits: UserBenefit[];
  };
  playerName: string;
}

// ---------------------------------------------------------------------------
// Module-level utilities (pure, stable references)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Module-level utilities (pure, stable references)
// ---------------------------------------------------------------------------

/**
 * Derives the Tailwind background class for a benefit table row with dark mode support.
 *
 * Priority (highest first):
 *  1. Used benefits → muted/strikethrough appearance
 *  2. Unused & expiring within 14 days → critical red background
 *  3. Unused & expiring within 30 days → warning orange background
 *  4. Default background color
 *
 * All colors support both light and dark modes using dark: variants.
 * Hover feedback with smooth transitions is provided in all cases.
 */
const getRowClass = (benefit: UserBenefit, now: Date): string => {
  // Hover state with dark mode support
  const HOVER = 'hover:bg-red-100 dark:hover:bg-red-950 transition-colors';

  if (benefit.isUsed) {
    return `bg-white dark:bg-gray-900 opacity-60 ${HOVER}`;
  }

  if (benefit.expirationDate !== null) {
    const msRemaining = benefit.expirationDate.getTime() - now.getTime();
    const daysRemaining = msRemaining / MS_PER_DAY;

    if (daysRemaining < 14) {
      // Critical red - expires in less than 2 weeks
      return `bg-red-50 dark:bg-red-950 ${HOVER}`;
    }
    if (daysRemaining < 30) {
      // Warning orange - expires in less than 30 days
      return `bg-amber-50 dark:bg-amber-950 transition-colors`;
    }
  }

  return `bg-white dark:bg-gray-900 transition-colors`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CardTrackerPanel({
  userCard,
  playerName,
}: CardTrackerPanelProps) {
  // Local copy of benefits so optimistic updates are instant.
  const [benefits, setBenefits] = useState<UserBenefit[]>(userCard.userBenefits);
  // Tracks which single benefit checkbox is awaiting a server response.
  const [isPending, setIsPending] = useState<string | null>(null);
  // Holds the most recent server-side error message (cleared on next action).
  const [error, setError] = useState<string | null>(null);

  // Non-urgent transition wrapper — lets React deprioritise the async work.
  const [, startTransition] = useTransition();

  // Snapshot `now` once per render so expiration logic is consistent
  // across the header, table rows, and footer within a single paint.
  const now = new Date();

  // ---------------------------------------------------------------------------
  // Derived metrics — computed from live `benefits` state, not stored in state.
  // Re-derives on every render so the header badge and footer stay in sync
  // with optimistic updates without an extra setState.
  // ---------------------------------------------------------------------------
  const roi = getEffectiveROI(userCard, benefits);
  const totalExtracted = getTotalValueExtracted(benefits);
  const uncaptured = getUncapturedValue(benefits);
  const netFee = getNetAnnualFee(userCard, benefits);

  // ROI display helpers
  const roiAbsStr = formatCurrency(Math.abs(roi));
  const roiLabel = roi >= 0 ? `ROI: +${roiAbsStr}` : `ROI: -${roiAbsStr}`;
  const roiBadgeClass =
    roi > 0
      ? 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
      : roi < 0
      ? 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';

  // Annual fee display: prefer the user-set actual fee over the master default.
  const annualFeeDisplay = formatCurrency(
    userCard.actualAnnualFee ?? userCard.masterCard.defaultAnnualFee,
  );

  // Renewal date formatted as "Apr 30, 2025"
  const renewalDisplay = userCard.renewalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // ---------------------------------------------------------------------------
  // Optimistic toggle handler
  // ---------------------------------------------------------------------------

  /**
   * Handles a checkbox change for a benefit row.
   *
   * 1. Immediately flips `isUsed` in local state (optimistic).
   * 2. Fires the server action inside a non-urgent transition.
   * 3. On failure: reverts local state and surfaces the error message.
   *
   * Using the snapshot of `benefit.isUsed` (from the pre-toggle state) as
   * the argument to `toggleBenefit` is intentional — we need to pass the
   * *current* server-side value, not the already-flipped local one.
   */
  const handleToggle = (benefit: UserBenefit): void => {
    const previousIsUsed = benefit.isUsed;

    // Step 1 — optimistic local update
    setBenefits((prev) =>
      prev.map((b) =>
        b.id === benefit.id ? { ...b, isUsed: !b.isUsed } : b,
      ),
    );
    setIsPending(benefit.id);
    setError(null);

    // Step 2 — non-urgent server sync
    startTransition(async () => {
      const result = await toggleBenefit(benefit.id, previousIsUsed);

      setIsPending(null);

      if (!result.success) {
        // Step 3 — revert optimistic update on failure
        setBenefits((prev) =>
          prev.map((b) =>
            b.id === benefit.id ? { ...b, isUsed: previousIsUsed } : b,
          ),
        );
        setError(result.error);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          {/* Left: card identity */}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-gray-900">
              {userCard.customName ?? userCard.masterCard.cardName}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {userCard.masterCard.issuer} · {playerName}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <span>Renewal: {renewalDisplay}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span>Annual Fee: {annualFeeDisplay}</span>
            </p>
          </div>

          {/* Right: live ROI badge */}
          <span
            className={`shrink-0 px-3 py-1 rounded-full text-sm font-semibold ${roiBadgeClass}`}
          >
            {roiLabel}
          </span>
        </div>
      </div>

      {/* ── Benefits Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
              {/* Column 1: Benefit Name - flexible with min-width */}
              <th className="px-4 py-3 text-left font-medium min-w-[150px] flex-1">Benefit Name</th>
              {/* Column 2: Cadence - fixed minimum width */}
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap min-w-[100px]">Cadence</th>
              {/* Column 3: Value - fixed minimum width, right-aligned */}
              <th className="px-4 py-3 text-right font-medium whitespace-nowrap min-w-[80px]">Value</th>
              {/* Column 4: Expires - fixed minimum width, center-aligned */}
              <th className="px-4 py-3 text-center font-medium whitespace-nowrap min-w-[70px]">Expires</th>
              {/* Column 5: Used? - fixed minimum width, center-aligned */}
              <th className="px-4 py-3 text-center font-medium whitespace-nowrap min-w-[60px]">Used?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {benefits.map((benefit) => {
              const rowClass = getRowClass(benefit, now);
              const inFlight = isPending === benefit.id;

              // Pre-compute expiration display and urgency for this row
              const { expirationDisplay, expiresClass } = (() => {
                if (benefit.expirationDate === null) {
                  return { expirationDisplay: '—', expiresClass: 'text-gray-400' };
                }

                const formatted = benefit.expirationDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                const msRemaining =
                  benefit.expirationDate.getTime() - now.getTime();
                const daysRemaining = msRemaining / MS_PER_DAY;

                if (!benefit.isUsed && daysRemaining < 14) {
                  return {
                    expirationDisplay: formatted,
                    expiresClass: 'text-red-600 font-medium',
                  };
                }
                if (!benefit.isUsed && daysRemaining < 30) {
                  return {
                    expirationDisplay: formatted,
                    expiresClass: 'text-orange-600',
                  };
                }
                return { expirationDisplay: formatted, expiresClass: 'text-gray-600' };
              })();

              // Determine which value to show and whether there's an override
              const displayValueCents =
                benefit.userDeclaredValue ?? benefit.stickerValue;
              const hasCustomValue = benefit.userDeclaredValue !== null;

              return (
                <tr key={benefit.id} className={rowClass}>
                  {/* Name */}
                  <td className="px-4 py-3">
                    <span
                      className={
                        benefit.isUsed
                          ? 'font-medium line-through text-gray-400'
                          : 'font-medium text-gray-900'
                      }
                    >
                      {benefit.name}
                    </span>
                  </td>

                  {/* Cadence */}
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {benefit.resetCadence}
                  </td>

                  {/* Value */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-gray-700 dark:text-gray-300">{formatCurrency(displayValueCents)}</span>
                    {hasCustomValue && (
                      <span
                        className="ml-1 text-blue-500 dark:text-blue-400 text-xs cursor-default"
                        title="Custom value"
                      >
                        ✎
                      </span>
                    )}
                  </td>

                  {/* Expires */}
                  <td className={`px-4 py-3 text-center whitespace-nowrap ${expiresClass}`}>
                    {expirationDisplay}
                  </td>

                  {/* Used? */}
                  <td
                    className={`px-4 py-3 text-center ${
                      inFlight ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={benefit.isUsed}
                      disabled={inFlight}
                      onChange={() => handleToggle(benefit)}
                      className="h-4 w-4 rounded accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
                      aria-label={`Mark "${benefit.name}" as ${benefit.isUsed ? 'unclaimed' : 'used'}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Below-table error message with accessibility attributes ──────────────────────────────────────── */}
      {error && (
        <div
          className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600"
          aria-live="polite"
          role="status"
          aria-label="Error notification"
        >
          {error}
        </div>
      )}

      {/* ── Summary footer ───────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-400">
        <span>
          <span className="text-gray-400 dark:text-gray-500">Total Extracted: </span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(totalExtracted)}</span>
        </span>
        <span>
          <span className="text-gray-400 dark:text-gray-500">Uncaptured: </span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(uncaptured)}</span>
        </span>
        <span>
          <span className="text-gray-400 dark:text-gray-500">Net Fee: </span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(netFee)}</span>
        </span>
      </div>
    </div>
  );
}
