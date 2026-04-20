/**
 * benefit-period-display.ts
 *
 * Pure utility for computing period timing context shown on every benefit card.
 * No React imports — consumed by BenefitsGrid.
 */

export interface PeriodDisplayInfo {
  /** Human-readable period label, e.g. "Resets Sep 1", "Expires in 3 days" */
  label: string;
  /** Visual urgency classification */
  urgency: 'urgent' | 'normal' | 'done';
  /** 0-100 percent of period elapsed, null for ONE_TIME */
  progressPercent: number | null;
  /** Days until periodEnd, null if no periodEnd */
  remainingDays: number | null;
  /** e.g. "Resets monthly", null for ONE_TIME */
  resetLabel: string | null;
}

/** Map cadence strings to human-readable reset labels */
export function getCadenceResetLabel(
  resetCadence: string,
  claimingCadence?: string | null
): string | null {
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
    case 'FLEXIBLE_ANNUAL':
      return 'Resets annually';
    case 'ONE_TIME':
      return null;
    default:
      return null;
  }
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getPeriodDisplayInfo(benefit: {
  isUsed: boolean;
  claimedAt?: Date | string | null;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  resetCadence?: string;
  claimingCadence?: string | null;
  stickerValue?: number;
}): PeriodDisplayInfo {
  const cadence = (benefit.claimingCadence || benefit.resetCadence || '').toUpperCase();
  const isOneTime = cadence === 'ONE_TIME';
  const resetLabel = getCadenceResetLabel(
    benefit.resetCadence || '',
    benefit.claimingCadence
  );

  // ONE_TIME benefits
  if (isOneTime) {
    return {
      label: benefit.isUsed ? 'Used' : 'One-time benefit',
      urgency: benefit.isUsed ? 'done' : 'normal',
      progressPercent: null,
      remainingDays: null,
      resetLabel: null,
    };
  }

  const now = new Date();
  const periodEnd = benefit.periodEnd
    ? new Date(benefit.periodEnd)
    : null;
  const periodStart = benefit.periodStart
    ? new Date(benefit.periodStart)
    : null;

  // No periodEnd — fallback
  if (!periodEnd) {
    return {
      label: benefit.isUsed ? 'Used this period' : 'Available',
      urgency: benefit.isUsed ? 'done' : 'normal',
      progressPercent: null,
      remainingDays: null,
      resetLabel,
    };
  }

  const msRemaining = periodEnd.getTime() - now.getTime();
  const remainingDays = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  // Calculate progress percent (period elapsed)
  let progressPercent: number | null = null;
  if (periodStart) {
    const totalMs = periodEnd.getTime() - periodStart.getTime();
    const elapsedMs = now.getTime() - periodStart.getTime();
    if (totalMs > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100)));
    }
  }

  // Used benefit
  if (benefit.isUsed) {
    const claimedDate = benefit.claimedAt ? new Date(benefit.claimedAt) : null;
    const claimedStr = claimedDate ? formatShortDate(claimedDate) : '';
    let label: string;
    
    if (remainingDays < 0) {
      // Period already ended
      label = claimedStr ? `Used ${claimedStr} · Period ended` : 'Used · Period ended';
    } else {
      // Period still active
      const resetsStr = formatShortDate(periodEnd);
      label = claimedStr
        ? `Used ${claimedStr} · Resets ${resetsStr}`
        : `Used · Resets ${resetsStr}`;
    }
    
    return {
      label,
      urgency: 'done',
      progressPercent,
      remainingDays,
      resetLabel,
    };
  }

  // Period ended (past periodEnd)
  if (remainingDays < 0) {
    return {
      label: 'Period ended',
      urgency: 'normal',
      progressPercent: 100,
      remainingDays,
      resetLabel,
    };
  }

  // Unused, ≤7 days remaining
  if (remainingDays <= 7) {
    const label = remainingDays === 0
      ? 'Expires today'
      : `Expires in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
    return {
      label,
      urgency: 'urgent',
      progressPercent,
      remainingDays,
      resetLabel,
    };
  }

  // Unused, >7 days
  return {
    label: `Resets ${formatShortDate(periodEnd)}`,
    urgency: 'normal',
    progressPercent,
    remainingDays,
    resetLabel,
  };
}
