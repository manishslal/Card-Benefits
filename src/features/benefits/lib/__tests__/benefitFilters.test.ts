/**
 * Tests for benefit filtering and status utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getStatusForBenefit,
  filterBenefitsByStatus,
  countBenefitsByStatus,
  isUrgent,
  isWarning,
  getDaysUntilReset,
  formatResetDate,
} from '../benefitFilters';
import type { UserBenefit } from '@/types';

// Mock benefits for testing
function createMockBenefit(overrides: Partial<UserBenefit> = {}): UserBenefit {
  return {
    id: '123',
    userCardId: 'card123',
    playerId: 'player123',
    name: 'Test Benefit',
    type: 'StatementCredit',
    stickerValue: 10000,
    resetCadence: 'Monthly',
    userDeclaredValue: null,
    timesUsed: 0,
    expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
    isUsed: false,
    status: 'ACTIVE',
    importedFrom: null,
    importedAt: null,
    version: 1,
    valueHistory: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    claimedAt: null,
    ...overrides,
  };
}

describe('getStatusForBenefit', () => {
  it('returns "claimed" if isUsed=true', () => {
    const benefit = createMockBenefit({ isUsed: true });
    expect(getStatusForBenefit(benefit)).toBe('claimed');
  });

  it('returns "expired" if expirationDate is in the past', () => {
    const benefit = createMockBenefit({
      expirationDate: new Date(Date.now() - 1000), // 1 second ago
      isUsed: false,
    });
    expect(getStatusForBenefit(benefit)).toBe('expired');
  });

  it('returns "expiring" if 3-7 days remain', () => {
    const benefit = createMockBenefit({
      expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
      isUsed: false,
    });
    expect(getStatusForBenefit(benefit)).toBe('expiring');
  });

  it('returns "expiring" if < 3 days remain', () => {
    const benefit = createMockBenefit({
      expirationDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      isUsed: false,
    });
    expect(getStatusForBenefit(benefit)).toBe('expiring');
  });

  it('returns "available" if > 7 days remain', () => {
    const benefit = createMockBenefit({
      expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      isUsed: false,
    });
    expect(getStatusForBenefit(benefit)).toBe('available');
  });

  it('returns "available" if null expirationDate (perpetual)', () => {
    const benefit = createMockBenefit({
      expirationDate: null,
      isUsed: false,
    });
    expect(getStatusForBenefit(benefit)).toBe('available');
  });
});

describe('filterBenefitsByStatus', () => {
  const benefits = [
    createMockBenefit({
      id: '1',
      expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      isUsed: false,
    }), // available
    createMockBenefit({
      id: '2',
      expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      isUsed: false,
    }), // expiring
    createMockBenefit({
      id: '3',
      expirationDate: new Date(Date.now() - 1000),
      isUsed: false,
    }), // expired
    createMockBenefit({
      id: '4',
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      isUsed: true,
    }), // claimed
  ];

  it('returns all benefits when status="all"', () => {
    const filtered = filterBenefitsByStatus(benefits, 'all');
    expect(filtered).toHaveLength(4);
  });

  it('returns only active benefits when status="active"', () => {
    const filtered = filterBenefitsByStatus(benefits, 'active');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('returns only expiring benefits when status="expiring"', () => {
    const filtered = filterBenefitsByStatus(benefits, 'expiring');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  it('returns only expired benefits when status="expired"', () => {
    const filtered = filterBenefitsByStatus(benefits, 'expired');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('3');
  });

  it('returns only claimed benefits when status="claimed"', () => {
    const filtered = filterBenefitsByStatus(benefits, 'claimed');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('4');
  });
});

describe('countBenefitsByStatus', () => {
  const benefits = [
    createMockBenefit({
      id: '1',
      expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      isUsed: false,
    }), // available
    createMockBenefit({
      id: '2',
      expirationDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      isUsed: false,
    }), // expiring
    createMockBenefit({
      id: '3',
      expirationDate: new Date(Date.now() - 1000),
      isUsed: false,
    }), // expired
    createMockBenefit({
      id: '4',
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      isUsed: true,
    }), // claimed
  ];

  it('returns correct count for all statuses', () => {
    const counts = countBenefitsByStatus(benefits);
    expect(counts.all).toBe(4);
    expect(counts.active).toBe(1);
    expect(counts.expiring).toBe(1);
    expect(counts.expired).toBe(1);
    expect(counts.claimed).toBe(1);
  });

  it('handles empty array', () => {
    const counts = countBenefitsByStatus([]);
    expect(counts.all).toBe(0);
    expect(counts.active).toBe(0);
    expect(counts.expiring).toBe(0);
    expect(counts.expired).toBe(0);
    expect(counts.claimed).toBe(0);
  });
});

describe('isUrgent', () => {
  it('returns true for < 3 days', () => {
    expect(isUrgent(0)).toBe(true);
    expect(isUrgent(1)).toBe(true);
    expect(isUrgent(2)).toBe(true);
  });

  it('returns false for >= 3 days', () => {
    expect(isUrgent(3)).toBe(false);
    expect(isUrgent(7)).toBe(false);
    expect(isUrgent(15)).toBe(false);
  });

  it('returns false for negative days', () => {
    expect(isUrgent(-1)).toBe(false);
  });
});

describe('isWarning', () => {
  it('returns true for 3-7 days', () => {
    expect(isWarning(3)).toBe(true);
    expect(isWarning(5)).toBe(true);
    expect(isWarning(7)).toBe(true);
  });

  it('returns false for < 3 days', () => {
    expect(isWarning(0)).toBe(false);
    expect(isWarning(1)).toBe(false);
    expect(isWarning(2)).toBe(false);
  });

  it('returns false for > 7 days', () => {
    expect(isWarning(8)).toBe(false);
    expect(isWarning(15)).toBe(false);
  });
});

describe('getDaysUntilReset', () => {
  it('returns days until expiration', () => {
    const benefit = createMockBenefit({
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    const days = getDaysUntilReset(benefit);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(10);
  });

  it('returns Infinity for null expiration date', () => {
    const benefit = createMockBenefit({ expirationDate: null });
    expect(getDaysUntilReset(benefit)).toBe(Infinity);
  });
});

describe('formatResetDate', () => {
  it('formats date as "Month Day"', () => {
    const date = new Date('2025-03-15T12:00:00Z');
    const benefit = createMockBenefit({ expirationDate: date });
    const formatted = formatResetDate(benefit);
    // The formatted date will be in the local timezone, so just check it contains March
    expect(formatted).toContain('March');
    expect(formatted).toMatch(/\d+/); // has a day number
  });

  it('returns empty string for null expirationDate', () => {
    const benefit = createMockBenefit({ expirationDate: null });
    expect(formatResetDate(benefit)).toBe('');
  });

  it('handles string dates', () => {
    const benefit = createMockBenefit({ expirationDate: new Date('2025-03-15') });
    const formatted = formatResetDate(benefit);
    expect(formatted).toContain('March');
  });
});
