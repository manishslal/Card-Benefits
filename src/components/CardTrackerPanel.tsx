'use client';

/**
 * CardTrackerPanel.tsx
 *
 * Displays a single user card's benefits in a table with optimistic checkbox
 * toggling, expiration colour-coding, and live ROI/summary metrics.
 *
 * Design notes:
 * - All monetary calculations are derived from live `benefits` state so the
 *   header ROI badge and footer stats update instantly on toggle without a
 *   server round-trip.
 * - `useTransition` wraps the server action to keep it non-blocking; React
 *   can interrupt it for higher-priority updates (e.g. hover states).
 * - A separate `isPending` string tracks *which* benefit is in-flight so each
 *   checkbox can independently show a loading state, unlike the boolean
 *   `isPending` that `useTransition` returns.
 * - `getRowClass` and `formatCents` live outside the component to avoid
 *   re-creation on every render and to keep JSX readable.
 */

import { useState, useTransition } from 'react';
import type { UserCard, UserBenefit } from '@prisma/client';
import {
  getEffectiveROI,
  getTotalValueExtracted,
  getUncapturedValue,
  getNetAnnualFee,
  MS_PER_DAY,
} from '@/lib/calculations';
import { toggleBenefit } from '@/actions/benefits';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CardTrackerPanelProps {
  userCard: UserCard & {
    masterCard: { issuer: string; cardName: string; defaultAnnualFee: number };
    userBenefits: UserBenefit[];
  };
  playerName: string;
}

// ---------------------------------------------------------------------------
// Module-level utilities (pure, stable references)
// ---------------------------------------------------------------------------

/**
 * Converts an integer cent value to a locale-formatted currency string.
 * e.g. 30000 → "$300.00"
 */
const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/**
 * Derives the Tailwind background class for a benefit table row.
 *
 * Priority (highest first):
 *  1. Used benefits → muted/strikethrough appearance
 *  2. Unused & expiring within 14 days → critical red
 *  3. Unused & expiring within 30 days → warning orange
 *  4. Default white
 *
 * `hover:bg-gray-50 transition-colors` is appended in all cases so hover
 * feedback is never suppressed.
 */
const getRowClass = (benefit: UserBenefit, now: Date): string => {
  const HOVER = 'hover:bg-gray-50 transition-colors';

  if (benefit.isUsed) {
    return `bg-white opacity-60 ${HOVER}`;
  }

  if (benefit.expirationDate !== null) {
    const msRemaining = benefit.expirationDate.getTime() - now.getTime();
    const daysRemaining = msRemaining / MS_PER_DAY;

    if (daysRemaining < 14) {
      return `bg-red-100 ${HOVER}`;
    }
    if (daysRemaining < 30) {
      return `bg-orange-50 ${HOVER}`;
    }
  }

  return `bg-white ${HOVER}`;
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
  const roiAbsStr = formatCents(Math.abs(roi));
  const roiLabel = roi >= 0 ? `ROI: +${roiAbsStr}` : `ROI: -${roiAbsStr}`;
  const roiBadgeClass =
    roi > 0
      ? 'bg-green-100 text-green-800'
      : roi < 0
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-700';

  // Annual fee display: prefer the user-set actual fee over the master default.
  const annualFeeDisplay = formatCents(
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
                    <span className="text-gray-700">{formatCents(displayValueCents)}</span>
                    {hasCustomValue && (
                      <span
                        className="ml-1 text-blue-400 text-xs cursor-default"
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
      <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-6 text-sm text-gray-600">
        <span>
          <span className="text-gray-400">Total Extracted: </span>
          <span className="font-semibold text-gray-800">{formatCents(totalExtracted)}</span>
        </span>
        <span>
          <span className="text-gray-400">Uncaptured: </span>
          <span className="font-semibold text-gray-800">{formatCents(uncaptured)}</span>
        </span>
        <span>
          <span className="text-gray-400">Net Fee: </span>
          <span className="font-semibold text-gray-800">{formatCents(netFee)}</span>
        </span>
      </div>
    </div>
  );
}
