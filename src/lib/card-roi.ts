/**
 * card-roi.ts
 *
 * ROI calculation for a single card: total benefit value vs annual fee.
 * All monetary inputs are in CENTS; outputs are in DOLLARS.
 */

export interface CardROISummary {
  annualFee: number;
  totalBenefitValue: number;
  usedBenefitValue: number;
  remainingBenefitValue: number;
  roiMultiple: number;
  isWorthIt: boolean;
  hasNoFee: boolean;
  benefitCount: number;
  usedCount: number;
}

export function calculateCardROI(
  benefits: Array<{
    stickerValue: number;
    userDeclaredValue?: number | null;
    isUsed?: boolean;
    periodStatus?: string | null;
    type: string;
  }>,
  annualFeeCents: number
): CardROISummary {
  const annualFee = annualFeeCents / 100;

  // Only ACTIVE period benefits (or benefits without period info)
  const activeBenefits = benefits.filter(
    (b) => !b.periodStatus || b.periodStatus === 'ACTIVE'
  );

  // Exclude lounge access from dollar calculations
  const claimable = activeBenefits.filter(
    (b) => b.type?.toLowerCase() !== 'lounge'
  );

  const getValue = (b: {
    stickerValue: number;
    userDeclaredValue?: number | null;
  }) => (b.userDeclaredValue ?? b.stickerValue) / 100;

  const totalDollars = claimable.reduce((s, b) => s + getValue(b), 0);
  const usedDollars = claimable
    .filter((b) => b.isUsed)
    .reduce((s, b) => s + getValue(b), 0);
  const remainingDollars = claimable
    .filter((b) => !b.isUsed)
    .reduce((s, b) => s + getValue(b), 0);

  const roiMultiple =
    annualFee > 0
      ? Math.round((totalDollars / annualFee) * 10) / 10
      : 0;

  return {
    annualFee,
    totalBenefitValue: totalDollars,
    usedBenefitValue: usedDollars,
    remainingBenefitValue: remainingDollars,
    roiMultiple,
    isWorthIt: totalDollars >= annualFee,
    hasNoFee: annualFee === 0,
    benefitCount: claimable.length,
    usedCount: claimable.filter((b) => b.isUsed).length,
  };
}

export function formatDollar(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded >= 1000) return `$${rounded.toLocaleString()}`;
  if (rounded >= 10) return `$${rounded}`;
  if (amount > 0) return `$${amount.toFixed(2)}`;
  return '$0';
}

export function formatROIMessage(roi: CardROISummary): string {
  if (roi.hasNoFee) return 'No annual fee';
  if (roi.roiMultiple >= 2)
    return `You're getting ${roi.roiMultiple}× your annual fee in value`;
  if (roi.isWorthIt)
    return `Benefits exceed your ${formatDollar(roi.annualFee)} annual fee`;
  const gap = roi.annualFee - roi.totalBenefitValue;
  return `${formatDollar(gap)} short of covering your ${formatDollar(roi.annualFee)} annual fee`;
}
