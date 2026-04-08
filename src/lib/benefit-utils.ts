/**
 * Benefit Deduplication Utilities
 *
 * When `BENEFIT_ENGINE_ENABLED` is true the data model stores one
 * `UserBenefit` row **per period** (e.g., Jan → Dec for a monthly benefit).
 * Legacy UI code assumes one-row-per-benefit, so these helpers collapse
 * the period rows back to a single representative row for display and
 * counting purposes.
 *
 * When the engine is **off**, every helper is a no-op passthrough so
 * existing behaviour is preserved.
 */

// ---------------------------------------------------------------------------
// Minimal shape required by the dedup helpers.
// All callers (dashboard, card-detail, calculations) satisfy this interface.
// ---------------------------------------------------------------------------

/** Minimal benefit shape consumed by the deduplication utilities. */
export interface DeduplicatableBenefit {
  id: string;
  userCardId?: string | null;
  masterBenefitId?: string | null;
  periodStatus?: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deduplicate an array of benefits when the benefit engine is enabled.
 *
 * **Engine path:** Groups by `masterBenefitId`, keeping only the row whose
 * `periodStatus === 'ACTIVE'`.  Benefits without a `masterBenefitId` (legacy /
 * user-created) pass through unchanged.
 *
 * **Legacy path (engine off):** Returns the original array untouched.
 *
 * @typeParam T - Any benefit type that satisfies `DeduplicatableBenefit`.
 * @param benefits        - The full list of benefit rows.
 * @param engineEnabled   - Value of `BENEFIT_ENGINE_ENABLED`.
 * @returns A new array with at most one entry per unique benefit.
 */
export function deduplicateBenefits<T extends DeduplicatableBenefit>(
  benefits: T[],
  engineEnabled: boolean,
): T[] {
  if (!engineEnabled) return benefits;

  const seen = new Set<string>();
  const result: T[] = [];

  for (const benefit of benefits) {
    if (benefit.masterBenefitId) {
      // Engine-managed: only keep the ACTIVE period row, dedup by userCardId:masterBenefitId
      // Composite key prevents cross-card dedup (e.g., two spouses with same card type)
      if (benefit.periodStatus === 'ACTIVE') {
        const dedupKey = `${benefit.userCardId ?? ''}:${benefit.masterBenefitId}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          result.push(benefit);
        }
        // Duplicate ACTIVE rows for the same masterBenefitId are defensive-skipped
      }
      // EXPIRED / UPCOMING rows are dropped from the "current" view
    } else {
      // Legacy benefit — no masterBenefitId, show as-is
      result.push(benefit);
    }
  }

  return result;
}

/**
 * Count unique benefits, respecting engine deduplication.
 *
 * When the engine is enabled, benefits with a `masterBenefitId` are counted
 * once (only if they have an ACTIVE period row).  Legacy benefits are counted
 * individually by `id`.
 *
 * An optional `statusFn` can be supplied to further filter by display status
 * (e.g., "active", "expiring", "expired").  When `statusFilter` is `'all'` or
 * omitted the status check is skipped.
 *
 * @param benefits       - Full list of benefit rows.
 * @param engineEnabled  - Value of `BENEFIT_ENGINE_ENABLED`.
 * @param statusFn       - Maps a benefit to a display-status string.
 * @param statusFilter   - If set (and not `'all'`), only benefits whose
 *                          `statusFn` output matches are counted.
 * @returns The count of unique benefits matching the filter.
 */
export function getUniqueBenefitCount<T extends DeduplicatableBenefit>(
  benefits: T[],
  engineEnabled: boolean,
  statusFn?: (b: T) => string,
  statusFilter?: string,
): number {
  if (!engineEnabled) {
    if (!statusFilter || statusFilter === 'all') return benefits.length;
    if (statusFn) return benefits.filter((b) => statusFn(b) === statusFilter).length;
    return benefits.length;
  }

  const seen = new Set<string>();
  let count = 0;

  for (const b of benefits) {
    if (b.masterBenefitId) {
      if (b.periodStatus !== 'ACTIVE') continue;
      const dedupKey = `${b.userCardId ?? ''}:${b.masterBenefitId}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
    }
    // Legacy benefit or first ACTIVE engine benefit
    if (statusFilter && statusFilter !== 'all' && statusFn) {
      if (statusFn(b) !== statusFilter) continue;
    }
    count++;
  }

  return count;
}
