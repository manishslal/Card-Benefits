export interface MultiplierBenefitShape {
  name?: string | null;
  usage?: number | null;
}

export function extractMultiplierFromName(name?: string | null): number | null {
  if (!name) return null;
  const match = name.match(/(\d+\.?\d*)x\b/i);
  return match ? Number.parseFloat(match[1]) : null;
}

export function isMultiplierBenefit(benefit: MultiplierBenefitShape): boolean {
  return benefit.usage === null && extractMultiplierFromName(benefit.name) !== null;
}

export function formatSpendCents(amountCents: number): string {
  return `$${(Math.max(0, amountCents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
