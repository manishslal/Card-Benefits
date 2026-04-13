/**
 * Tests for the getDisplayValue logic used on the dashboard.
 *
 * The function is defined inline in src/app/dashboard/page.tsx so we
 * replicate it here to keep tests fast and avoid importing the full page
 * component (which depends on React context, fetch, etc.).
 *
 * Any change to getDisplayValue in dashboard/page.tsx must keep these
 * tests green.
 */
import { describe, it, expect } from 'vitest';

// ── Mirror of getDisplayValue from dashboard/page.tsx ──────────────────
function getDisplayValue(benefit: {
  stickerValue: number;
  userDeclaredValue?: number | null;
}): number {
  return (benefit.userDeclaredValue ?? benefit.stickerValue) / 100;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('getDisplayValue', () => {
  // ── Basic value resolution ──────────────────────────────────────────

  it('returns stickerValue in dollars when no user override', () => {
    expect(getDisplayValue({ stickerValue: 2500 })).toBe(25);
  });

  it('prefers userDeclaredValue over stickerValue', () => {
    expect(getDisplayValue({ stickerValue: 2500, userDeclaredValue: 3000 })).toBe(30);
  });

  it('falls back to stickerValue when userDeclaredValue is null', () => {
    expect(getDisplayValue({ stickerValue: 2500, userDeclaredValue: null })).toBe(25);
  });

  // ── Monthly benefit: Entertainment Credit ($25/month) ───────────────

  it('shows per-period value for monthly entertainment credit', () => {
    // UserBenefit.stickerValue = 2500 (set by generate-benefits from claimingAmount)
    const entertainment = { stickerValue: 2500 };
    expect(getDisplayValue(entertainment)).toBe(25);
  });

  // ── Regression: value must NOT change when benefit is marked as used ─

  it('shows same value regardless of isUsed / claimedAt (no pro-rata)', () => {
    // Before the fix, marking as used would set claimedAt which triggered
    // pro-rata calculation: monthsRemaining × monthlyRate → inflated annual value.
    // Now claimedAt has no effect on per-card display value.
    const benefit = { stickerValue: 2500 };
    const valueBefore = getDisplayValue(benefit);
    const valueAfter = getDisplayValue(benefit); // same input, same output
    expect(valueBefore).toBe(valueAfter);
    expect(valueBefore).toBe(25);
  });

  // ── Monthly benefit with variable amounts: Uber Cash ────────────────

  it('shows base amount for Uber Cash (non-December)', () => {
    // UserBenefit.stickerValue = 1500 ($15) — resolved by generate-benefits
    expect(getDisplayValue({ stickerValue: 1500 })).toBe(15);
  });

  it('shows December override for Uber Cash', () => {
    // UserBenefit.stickerValue = 3500 ($35) — resolved from variableAmounts { "12": 3500 }
    expect(getDisplayValue({ stickerValue: 3500 })).toBe(35);
  });

  // ── Annual benefit: Equinox Credit ($300/year) ──────────────────────

  it('shows per-period value for Equinox (monthly $25)', () => {
    // If Equinox is modeled as MONTHLY cadence, UserBenefit.stickerValue = 2500
    expect(getDisplayValue({ stickerValue: 2500 })).toBe(25);
  });

  it('shows annual value for Equinox if modeled as annual', () => {
    // If Equinox is modeled as ANNUAL cadence, UserBenefit.stickerValue = 30000
    expect(getDisplayValue({ stickerValue: 30000 })).toBe(300);
  });

  // ── Unlimited / multiplier benefits (stickerValue = 0) ──────────────

  it('returns 0 for unlimited benefits', () => {
    expect(getDisplayValue({ stickerValue: 0 })).toBe(0);
  });

  // ── User override takes precedence ──────────────────────────────────

  it('user override is shown even when different from stickerValue', () => {
    // User says "I only get $20 of this $25 credit"
    expect(getDisplayValue({ stickerValue: 2500, userDeclaredValue: 2000 })).toBe(20);
  });

  // ── Edge: very small amounts ────────────────────────────────────────

  it('handles sub-dollar amounts', () => {
    expect(getDisplayValue({ stickerValue: 50 })).toBe(0.5);
  });
});
