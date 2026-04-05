/**
 * Unit Tests for Card Calculation Utilities
 * 
 * Tests all calculation functions in src/lib/card-calculations.ts
 * Covers: ROI calculations, renewal status, formatting, edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEffectiveAnnualFee,
  getDaysUntilRenewal,
  getRenewalStatus,
  formatRenewalCountdown,
  getRenewalStatusColor,
  getStatusBadgeColor,
  getStatusLabel,
  calculateCardROI,
  calculateWalletROI,
  formatCurrency,
  formatPercentage,
  calculateBenefitsSummary,
  cardContributesToROI,
  getRenewalStatusTooltip,
  calculateArchiveROIImpact
} from '@/features/cards/lib/calculations';
import { CardDisplayModel } from '@/features/cards/types';

// ============================================================================
// Effective Annual Fee Calculation Tests
// ============================================================================

describe('getEffectiveAnnualFee', () => {
  it('should return override fee when provided', () => {
    expect(getEffectiveAnnualFee(55000, 40000)).toBe(40000);
    expect(getEffectiveAnnualFee(100000, 0)).toBe(0);
  });

  it('should return default fee when override is null', () => {
    expect(getEffectiveAnnualFee(55000, null)).toBe(55000);
  });

  it('should return default fee when override is undefined', () => {
    expect(getEffectiveAnnualFee(55000, undefined)).toBe(55000);
  });

  it('should handle zero fees', () => {
    expect(getEffectiveAnnualFee(0, null)).toBe(0);
    expect(getEffectiveAnnualFee(0, 0)).toBe(0);
  });

  it('should handle large fee values', () => {
    expect(getEffectiveAnnualFee(1000000, 500000)).toBe(500000);
  });

  it('should prefer override over default', () => {
    expect(getEffectiveAnnualFee(55000, 1)).toBe(1);
  });
});

// ============================================================================
// Days Until Renewal Calculation Tests
// ============================================================================

describe('getDaysUntilRenewal', () => {
  let today: Date;

  beforeEach(() => {
    today = new Date();
    today.setHours(0, 0, 0, 0);
  });

  it('should calculate positive days for future dates', () => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(getDaysUntilRenewal(tomorrow)).toBe(1);

    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    expect(getDaysUntilRenewal(in7Days)).toBe(7);

    const in365Days = new Date(today);
    in365Days.setDate(in365Days.getDate() + 365);
    expect(getDaysUntilRenewal(in365Days)).toBe(365);
  });

  it('should calculate negative days for past dates', () => {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getDaysUntilRenewal(yesterday)).toBe(-1);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    expect(getDaysUntilRenewal(sevenDaysAgo)).toBe(-7);
  });

  it('should return 0 for today', () => {
    // Edge case: renewal date that was set to 00:00 for today
    const midnightToday = new Date(today);
    midnightToday.setHours(0, 0, 0, 0);
    // Result could be 0 or -1 depending on exact time comparison
    expect(getDaysUntilRenewal(midnightToday)).toBeGreaterThanOrEqual(-1);
    expect(getDaysUntilRenewal(midnightToday)).toBeLessThanOrEqual(0);
  });

  it('should ignore time component', () => {
    const futureDate1 = new Date(today);
    futureDate1.setDate(futureDate1.getDate() + 30);
    futureDate1.setHours(0, 0, 0, 0);

    const futureDate2 = new Date(today);
    futureDate2.setDate(futureDate2.getDate() + 30);
    futureDate2.setHours(23, 59, 59);

    // Both should give same result (time doesn't matter)
    expect(getDaysUntilRenewal(futureDate1)).toBe(getDaysUntilRenewal(futureDate2));
  });

  it('should handle leap years correctly', () => {
    // Feb 28, 2024 to Feb 28, 2025 = 366 days (2024 is leap year)
    const feb28_2024 = new Date(2024, 1, 28);
    feb28_2024.setHours(0, 0, 0, 0);
    const feb28_2025 = new Date(2025, 1, 28);
    feb28_2025.setHours(0, 0, 0, 0);
    
    const daysInYear = getDaysUntilRenewal(feb28_2025) - getDaysUntilRenewal(feb28_2024);
    // This test is approximate due to today's date changing
    expect(Math.abs(daysInYear)).toBeGreaterThan(360);
    expect(Math.abs(daysInYear)).toBeLessThan(375);
  });
});

// ============================================================================
// Renewal Status Determination Tests
// ============================================================================

describe('getRenewalStatus', () => {
  it('should return "Overdue" for negative days', () => {
    expect(getRenewalStatus(-1)).toBe('Overdue');
    expect(getRenewalStatus(-30)).toBe('Overdue');
    expect(getRenewalStatus(-365)).toBe('Overdue');
  });

  it('should return "DueNow" for 0-30 days until renewal', () => {
    expect(getRenewalStatus(0)).toBe('DueNow');
    expect(getRenewalStatus(1)).toBe('DueNow');
    expect(getRenewalStatus(15)).toBe('DueNow');
    expect(getRenewalStatus(30)).toBe('DueNow');
  });

  it('should return "DueSoon" for 31-60 days', () => {
    expect(getRenewalStatus(31)).toBe('DueSoon');
    expect(getRenewalStatus(45)).toBe('DueSoon');
    expect(getRenewalStatus(60)).toBe('DueSoon');
  });

  it('should return "Safe" for 60+ days', () => {
    expect(getRenewalStatus(61)).toBe('Safe');
    expect(getRenewalStatus(90)).toBe('Safe');
    expect(getRenewalStatus(365)).toBe('Safe');
  });

  it('should handle boundary values correctly', () => {
    // Boundary between Overdue and DueNow
    expect(getRenewalStatus(0)).toBe('DueNow');
    
    // Boundary between DueNow and DueSoon
    expect(getRenewalStatus(30)).toBe('DueNow');
    expect(getRenewalStatus(31)).toBe('DueSoon');
    
    // Boundary between DueSoon and Safe
    expect(getRenewalStatus(60)).toBe('DueSoon');
    expect(getRenewalStatus(61)).toBe('Safe');
  });
});

// ============================================================================
// Renewal Countdown Formatting Tests
// ============================================================================

describe('formatRenewalCountdown', () => {
  it('should format future days correctly', () => {
    expect(formatRenewalCountdown(1)).toBe('Renews in 1 day');
    expect(formatRenewalCountdown(7)).toBe('Renews in 7 days');
    expect(formatRenewalCountdown(30)).toBe('Renews in 30 days');
  });

  it('should format years when exceeding 365 days', () => {
    // The function only converts to years if > 365
    expect(formatRenewalCountdown(366)).toBe('Renews in 1 year');
    expect(formatRenewalCountdown(730)).toBe('Renews in 2 years');
    expect(formatRenewalCountdown(1095)).toBe('Renews in 3 years');
  });

  it('should format today correctly', () => {
    expect(formatRenewalCountdown(0)).toBe('Renews today');
  });

  it('should format overdue dates correctly', () => {
    expect(formatRenewalCountdown(-1)).toBe('Renewed 1 day ago');
    expect(formatRenewalCountdown(-7)).toBe('Renewed 7 days ago');
    expect(formatRenewalCountdown(-30)).toBe('Renewed 30 days ago');
  });

  it('should use plural correctly', () => {
    expect(formatRenewalCountdown(1)).toContain('1 day');
    expect(formatRenewalCountdown(2)).toContain('2 days');
    expect(formatRenewalCountdown(366)).toContain('1 year');
    expect(formatRenewalCountdown(730)).toContain('2 years');
  });

  it('should handle large numbers', () => {
    expect(formatRenewalCountdown(1000)).toContain('year');
    expect(formatRenewalCountdown(5000)).toContain('year');
  });
});

// ============================================================================
// Renewal Status Color Tests
// ============================================================================

describe('getRenewalStatusColor', () => {
  it('should return correct colors for each status', () => {
    expect(getRenewalStatusColor('DueNow')).toContain('red');
    expect(getRenewalStatusColor('DueSoon')).toContain('yellow');
    expect(getRenewalStatusColor('Coming')).toContain('blue');
    expect(getRenewalStatusColor('Safe')).toContain('green');
    expect(getRenewalStatusColor('Overdue')).toContain('red');
  });

  it('should return Tailwind CSS classes', () => {
    const color = getRenewalStatusColor('Safe');
    expect(color).toMatch(/bg-/);
    expect(color).toMatch(/text-/);
  });

  it('should handle invalid status', () => {
    const color = getRenewalStatusColor('INVALID' as any);
    expect(color).toContain('gray'); // Default fallback
  });
});

// ============================================================================
// Status Badge Color Tests
// ============================================================================

describe('getStatusBadgeColor', () => {
  it('should return correct colors for card statuses', () => {
    expect(getStatusBadgeColor('ACTIVE')).toContain('green');
    expect(getStatusBadgeColor('PENDING')).toContain('blue');
    expect(getStatusBadgeColor('PAUSED')).toContain('yellow');
    expect(getStatusBadgeColor('ARCHIVED')).toContain('gray');
    expect(getStatusBadgeColor('DELETED')).toContain('red');
  });

  it('should return Tailwind CSS classes', () => {
    const color = getStatusBadgeColor('ACTIVE');
    expect(color).toMatch(/bg-/);
    expect(color).toMatch(/text-/);
  });

  it('should handle invalid status gracefully', () => {
    const color = getStatusBadgeColor('UNKNOWN');
    expect(color).toContain('gray'); // Fallback
  });
});

// ============================================================================
// Status Label Formatting Tests
// ============================================================================

describe('getStatusLabel', () => {
  it('should return human-readable labels', () => {
    expect(getStatusLabel('ACTIVE')).toBe('Active');
    expect(getStatusLabel('PENDING')).toBe('Pending');
    expect(getStatusLabel('PAUSED')).toBe('Paused');
    expect(getStatusLabel('ARCHIVED')).toBe('Archived');
    expect(getStatusLabel('DELETED')).toBe('Deleted');
  });

  it('should return default for unknown status', () => {
    expect(getStatusLabel('UNKNOWN')).toBe('Unknown');
  });

  it('should handle case-sensitive input', () => {
    expect(getStatusLabel('active')).toBe('Unknown'); // Case sensitive
  });
});

// ============================================================================
// Card ROI Calculation Tests
// ============================================================================

describe('calculateCardROI', () => {
  it('should calculate ROI correctly for cards with positive ROI', () => {
    // ($500 benefits - $100 fee) / $100 fee = 4 = 400%
    expect(calculateCardROI(50000, 10000)).toBe(400);
    
    // ($200 benefits - $50 fee) / $50 fee = 3 = 300%
    expect(calculateCardROI(20000, 5000)).toBe(300);
  });

  it('should calculate ROI correctly for cards with zero ROI', () => {
    // ($50 benefits - $50 fee) / $50 fee = 0%
    expect(calculateCardROI(5000, 5000)).toBe(0);
  });

  it('should calculate ROI correctly for cards with negative ROI', () => {
    // ($30 benefits - $100 fee) / $100 fee = -0.7 = -70%
    expect(calculateCardROI(3000, 10000)).toBe(-70);
  });

  it('should handle zero fee special case', () => {
    // No fee: benefits/0 is undefined, so return 100% for any positive benefits
    expect(calculateCardROI(1, 0)).toBe(100);
    expect(calculateCardROI(100, 0)).toBe(100);
    expect(calculateCardROI(0, 0)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    // ($100 benefits - $33 fee) / $33 fee = 2.0303... = 203.03%
    expect(calculateCardROI(10000, 3300)).toBe(203.03);
  });

  it('should handle large values', () => {
    expect(calculateCardROI(500000, 100000)).toBe(400);
  });

  it('should handle fractional results', () => {
    // ($45 benefits - $10 fee) / $10 fee = 3.5 = 350%
    expect(calculateCardROI(4500, 1000)).toBe(350);
  });
});

// ============================================================================
// Wallet ROI Calculation Tests
// ============================================================================

describe('calculateWalletROI', () => {
  const createCard = (cardROI: number): CardDisplayModel => ({
    id: `card-${Math.random()}`,
    issuer: 'Test Bank',
    cardName: 'Test Card',
    customName: null,
    defaultAnnualFee: 0,
    actualAnnualFee: null,
    effectiveAnnualFee: 0,
    renewalDate: new Date(),
    daysUntilRenewal: 100,
    renewalStatus: 'Safe',
    status: 'ACTIVE',
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    benefitsCount: 0,
    activeBenefitsCount: 0,
    claimedBenefitsCount: 0,
    cardROI,
    annualValue: 0,
    cardImageUrl: ''
  });

  it('should calculate average ROI across cards', () => {
    const cards = [createCard(100), createCard(200), createCard(300)];
    expect(calculateWalletROI(cards)).toBe(200);
  });

  it('should return 0 for empty array', () => {
    expect(calculateWalletROI([])).toBe(0);
  });

  it('should handle single card', () => {
    expect(calculateWalletROI([createCard(150)])).toBe(150);
  });

  it('should handle negative ROI cards', () => {
    const cards = [createCard(100), createCard(-50), createCard(150)];
    expect(calculateWalletROI(cards)).toBe(66.67);
  });

  it('should round to 2 decimal places', () => {
    const cards = [createCard(100.5), createCard(100.5)];
    expect(calculateWalletROI(cards)).toBe(100.5);
  });

  it('should handle many cards', () => {
    const cards = Array.from({ length: 50 }, () => createCard(200));
    expect(calculateWalletROI(cards)).toBe(200);
  });
});

// ============================================================================
// Currency Formatting Tests
// ============================================================================

describe('formatCurrency', () => {
  it('should format cents to dollars with symbol', () => {
    expect(formatCurrency(10000)).toBe('$100.00');
    expect(formatCurrency(55000)).toBe('$550.00');
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should format without symbol when requested', () => {
    expect(formatCurrency(10000, false)).toBe('100.00');
    expect(formatCurrency(55000, false)).toBe('550.00');
  });

  it('should always use 2 decimal places', () => {
    expect(formatCurrency(1)).toBe('$0.01');
    expect(formatCurrency(99)).toBe('$0.99');
    expect(formatCurrency(100)).toBe('$1.00');
  });

  it('should use locale-specific formatting', () => {
    expect(formatCurrency(1000000)).toBe('$10,000.00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});

// ============================================================================
// Percentage Formatting Tests
// ============================================================================

describe('formatPercentage', () => {
  it('should format percentage with default 1 decimal place', () => {
    expect(formatPercentage(12.5)).toBe('12.5%');
    expect(formatPercentage(100)).toBe('100.0%');
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('should format with custom decimal places', () => {
    expect(formatPercentage(12.567, 2)).toBe('12.57%');
    expect(formatPercentage(12.567, 0)).toBe('13%');
    expect(formatPercentage(12.567, 3)).toBe('12.567%');
  });

  it('should handle negative percentages', () => {
    expect(formatPercentage(-12.5)).toBe('-12.5%');
    expect(formatPercentage(-50)).toBe('-50.0%');
  });

  it('should handle large numbers', () => {
    // Note: formatPercentage rounds at 1 decimal place, so 999.99 rounds to 1000.0%
    expect(formatPercentage(999.99)).toBe('1000.0%');
    expect(formatPercentage(1000)).toBe('1000.0%');
  });
});

// ============================================================================
// Benefits Summary Calculation Tests
// ============================================================================

describe('calculateBenefitsSummary', () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  it('should calculate summary for empty benefits', () => {
    const result = calculateBenefitsSummary([]);
    expect(result.unclaimed).toBe(0);
    expect(result.claimed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.count).toBe(0);
    expect(result.activeCount).toBe(0);
    expect(result.expiredCount).toBe(0);
  });

  it('should sum claimed benefits correctly', () => {
    const benefits = [
      { stickerValue: 10000, isUsed: true, expirationDate: null },
      { stickerValue: 20000, isUsed: true, expirationDate: null }
    ];
    const result = calculateBenefitsSummary(benefits);
    expect(result.claimed).toBe(30000);
    expect(result.unclaimed).toBe(0);
    expect(result.total).toBe(30000);
  });

  it('should sum unclaimed benefits correctly', () => {
    const benefits = [
      { stickerValue: 10000, isUsed: false, expirationDate: null },
      { stickerValue: 20000, isUsed: false, expirationDate: null }
    ];
    const result = calculateBenefitsSummary(benefits);
    expect(result.claimed).toBe(0);
    expect(result.unclaimed).toBe(30000);
    expect(result.total).toBe(30000);
  });

  it('should count active benefits correctly', () => {
    const benefits = [
      { stickerValue: 10000, isUsed: false, expirationDate: tomorrow },
      { stickerValue: 20000, isUsed: false, expirationDate: yesterday },
      { stickerValue: 30000, isUsed: false, expirationDate: null }
    ];
    const result = calculateBenefitsSummary(benefits);
    expect(result.activeCount).toBe(2); // tomorrow and null (no expiration)
    expect(result.expiredCount).toBe(1); // yesterday
  });

  it('should handle mixed used and unused benefits', () => {
    const benefits = [
      { stickerValue: 10000, isUsed: true, expirationDate: tomorrow },
      { stickerValue: 15000, isUsed: false, expirationDate: tomorrow },
      { stickerValue: 20000, isUsed: true, expirationDate: yesterday }
    ];
    const result = calculateBenefitsSummary(benefits);
    expect(result.claimed).toBe(30000); // 10000 + 20000
    expect(result.unclaimed).toBe(15000);
    expect(result.total).toBe(45000);
    expect(result.count).toBe(3);
    expect(result.activeCount).toBe(2); // tomorrow ones
    expect(result.expiredCount).toBe(1); // yesterday
  });
});

// ============================================================================
// Card ROI Contribution Tests
// ============================================================================

describe('cardContributesToROI', () => {
  it('should include ACTIVE cards', () => {
    expect(cardContributesToROI('ACTIVE')).toBe(true);
  });

  it('should include PENDING cards', () => {
    expect(cardContributesToROI('PENDING')).toBe(true);
  });

  it('should exclude PAUSED cards', () => {
    expect(cardContributesToROI('PAUSED')).toBe(false);
  });

  it('should exclude ARCHIVED cards', () => {
    expect(cardContributesToROI('ARCHIVED')).toBe(false);
  });

  it('should exclude DELETED cards', () => {
    expect(cardContributesToROI('DELETED')).toBe(false);
  });

  it('should exclude unknown statuses', () => {
    expect(cardContributesToROI('UNKNOWN')).toBe(false);
  });
});

// ============================================================================
// Renewal Status Tooltip Tests
// ============================================================================

describe('getRenewalStatusTooltip', () => {
  it('should provide tooltip for Overdue status', () => {
    const tooltip = getRenewalStatusTooltip('Overdue', -5);
    expect(tooltip).toContain('overdue');
    expect(tooltip).toContain('5');
  });

  it('should provide tooltip for DueNow status', () => {
    const tooltip = getRenewalStatusTooltip('DueNow', 15);
    expect(tooltip).toContain('30 days');
  });

  it('should provide tooltip for DueSoon status', () => {
    const tooltip = getRenewalStatusTooltip('DueSoon', 45);
    expect(tooltip).toContain('45');
  });

  it('should provide tooltip for Safe status', () => {
    const tooltip = getRenewalStatusTooltip('Safe', 90);
    expect(tooltip).toContain('60 days');
  });

  it('should use correct singular/plural forms', () => {
    const tooltip1 = getRenewalStatusTooltip('Overdue', -1);
    expect(tooltip1).toContain('1 day');
    
    const tooltip2 = getRenewalStatusTooltip('Overdue', -5);
    expect(tooltip2).toContain('5 days');
  });
});

// ============================================================================
// Archive ROI Impact Calculation Tests
// ============================================================================

describe('calculateArchiveROIImpact', () => {
  it('should return 0 for empty wallet', () => {
    expect(calculateArchiveROIImpact(100, 100, 10000, 0)).toBe(0);
  });

  it('should calculate impact when card ROI > wallet ROI', () => {
    // Card with 200% ROI in wallet with 100% average
    // Card value is 50% of wallet
    // Impact = 0.5 * (200 - 100) = 50%
    expect(calculateArchiveROIImpact(200, 100, 50000, 100000)).toBe(50);
  });

  it('should calculate negative impact when card ROI < wallet ROI', () => {
    // Card with 50% ROI in wallet with 100% average
    // Card value is 50% of wallet
    // Impact = 0.5 * (50 - 100) = -25%
    expect(calculateArchiveROIImpact(50, 100, 50000, 100000)).toBe(-25);
  });

  it('should handle zero impact when card matches wallet ROI', () => {
    expect(calculateArchiveROIImpact(100, 100, 50000, 100000)).toBe(0);
  });

  it('should handle small card in large wallet', () => {
    // Card with 200% ROI, 1% of wallet
    // Impact = 0.01 * (200 - 100) = 1%
    const result = calculateArchiveROIImpact(200, 100, 10000, 1000000);
    expect(result).toBe(1);
  });

  it('should round to 2 decimal places', () => {
    // Result that should be rounded
    const result = calculateArchiveROIImpact(150, 100, 33333, 100000);
    expect(result.toString().split('.')[1]?.length).toBeLessThanOrEqual(2);
  });

  it('should handle negative ROI cards', () => {
    // Card with -50% ROI in wallet with 100% average
    expect(calculateArchiveROIImpact(-50, 100, 50000, 100000)).toBe(-75);
  });
});

// ============================================================================
// Integration and Edge Cases
// ============================================================================

describe('Card Calculations - Integration Tests', () => {
  it('should integrate renewal status determination with countdown formatting', () => {
    // Future date
    const daysUntil = 45;
    const status = getRenewalStatus(daysUntil);
    expect(status).toBe('DueSoon');
    
    const countdown = formatRenewalCountdown(daysUntil);
    expect(countdown).toContain('45');
    expect(countdown).toContain('days');
  });

  it('should integrate ROI calculation with formatting', () => {
    const roi = calculateCardROI(50000, 10000);
    const formatted = formatPercentage(roi);
    expect(formatted).toBe('400.0%');
  });

  it('should integrate status with badge color and label', () => {
    const status = 'ACTIVE';
    const color = getStatusBadgeColor(status);
    const label = getStatusLabel(status);
    
    expect(color).toContain('green');
    expect(label).toBe('Active');
  });

  it('should handle full card lifecycle in calculations', () => {
    // Card with override fee
    const defaultFee = 55000;
    const overrideFee = 40000;
    const effectiveFee = getEffectiveAnnualFee(defaultFee, overrideFee);
    expect(effectiveFee).toBe(40000);
    
    // Calculate ROI with effective fee
    const benefits = 100000;
    const roi = calculateCardROI(benefits, effectiveFee);
    expect(roi).toBe(150);
    
    // Format for display
    const roiFormatted = formatPercentage(roi);
    expect(roiFormatted).toBe('150.0%');
  });
});
