/**
 * Unit tests for the Benefit Auto-Generation Service.
 *
 * Uses Vitest mocks to isolate from the database layer.
 * Tests cover: empty catalog, full catalog, duplicate prevention,
 * period calculation integration, and edge cases.
 *
 * ≥15 test cases as required by the spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup — vi.mock is hoisted, so the factory must not reference
// variables declared outside. We use vi.hoisted() to declare them.
// ============================================================================

const { mockFindMany, mockCreateMany, mockTransaction } = vi.hoisted(() => {
  return {
    mockFindMany: vi.fn(),
    mockCreateMany: vi.fn(),
    mockTransaction: vi.fn(),
  };
});

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => mockTransaction(fn),
    masterBenefit: {
      findMany: mockFindMany,
    },
    userBenefit: {
      createMany: mockCreateMany,
    },
  },
}));

// The transaction client passed to generateBenefitsForCard
const mockTx = {
  masterBenefit: {
    findMany: mockFindMany,
  },
  userBenefit: {
    createMany: mockCreateMany,
  },
};

// Import after mocks are set up
import { generateBenefitsForCard, generateBenefitsForCardStandalone } from '../generate-benefits';

// ============================================================================
// Helpers
// ============================================================================

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function makeMasterBenefit(overrides: Partial<{
  id: string;
  masterCardId: string;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
  isDefault: boolean;
  isActive: boolean;
  claimingCadence: string | null;
  claimingAmount: number | null;
  claimingWindowEnd: string | null;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? 'mb-1',
    masterCardId: overrides.masterCardId ?? 'mc-1',
    name: overrides.name ?? '$10 Monthly Dining Credit',
    type: overrides.type ?? 'StatementCredit',
    stickerValue: overrides.stickerValue ?? 1000,
    resetCadence: overrides.resetCadence ?? 'Monthly',
    isDefault: overrides.isDefault ?? true,
    isActive: overrides.isActive ?? true,
    claimingCadence: overrides.claimingCadence ?? null,
    claimingAmount: overrides.claimingAmount ?? null,
    claimingWindowEnd: overrides.claimingWindowEnd ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    createdByAdminId: null,
    updatedAt: new Date(),
  };
}

const defaultUserCard = {
  id: 'uc-1',
  masterCardId: 'mc-1',
  renewalDate: utc(2027, 4, 8),
};

const defaultPlayerId = 'player-1';
const defaultRefDate = utc(2026, 4, 8);

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateBenefitsForCard', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Empty catalog
  // ──────────────────────────────────────────────────────────────────────────

  it('returns count 0 when no MasterBenefits exist for the card', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    expect(result.count).toBe(0);
    expect(result.benefits).toEqual([]);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it('logs info when no benefits are found', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mockFindMany.mockResolvedValue([]);

    await generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No active benefits configured')
    );
    consoleSpy.mockRestore();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Full catalog
  // ──────────────────────────────────────────────────────────────────────────

  it('creates UserBenefit rows for each active MasterBenefit', async () => {
    const masterBenefits = [
      makeMasterBenefit({ id: 'mb-1', name: 'Dining Credit', stickerValue: 1000 }),
      makeMasterBenefit({ id: 'mb-2', name: 'Travel Credit', stickerValue: 5000, resetCadence: 'CalendarYear' }),
    ];
    mockFindMany.mockResolvedValue(masterBenefits);
    mockCreateMany.mockResolvedValue({ count: 2 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    expect(result.count).toBe(2);
    expect(result.benefits).toHaveLength(2);
    expect(mockCreateMany).toHaveBeenCalledTimes(1);
  });

  it('passes correct data shape to createMany', async () => {
    const masterBenefits = [
      makeMasterBenefit({
        id: 'mb-1',
        name: '$10 Monthly Dining Credit',
        type: 'StatementCredit',
        stickerValue: 1000,
        resetCadence: 'Monthly',
      }),
    ];
    mockFindMany.mockResolvedValue(masterBenefits);
    mockCreateMany.mockResolvedValue({ count: 1 });

    await generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate);

    const createCall = mockCreateMany.mock.calls[0][0];
    const data = createCall.data[0];

    expect(data.userCardId).toBe('uc-1');
    expect(data.playerId).toBe('player-1');
    expect(data.masterBenefitId).toBe('mb-1');
    expect(data.name).toBe('$10 Monthly Dining Credit');
    expect(data.type).toBe('StatementCredit');
    expect(data.stickerValue).toBe(1000);
    expect(data.resetCadence).toBe('Monthly');
    expect(data.periodStatus).toBe('ACTIVE');
    expect(data.isUsed).toBe(false);
    expect(data.timesUsed).toBe(0);
    expect(data.claimedAt).toBeNull();
    expect(data.status).toBe('ACTIVE');
  });

  it('uses skipDuplicates for idempotency', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit()]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    await generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate);

    const createCall = mockCreateMany.mock.calls[0][0];
    expect(createCall.skipDuplicates).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Period calculation integration
  // ──────────────────────────────────────────────────────────────────────────

  it('calculates monthly period correctly', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit({ resetCadence: 'Monthly' })]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    const benefit = result.benefits[0];
    expect(benefit.periodStart).toEqual(utc(2026, 4, 1));
    expect(benefit.periodEnd).toEqual(new Date(Date.UTC(2026, 3, 30, 23, 59, 59, 999)));
  });

  it('calculates calendar year period correctly', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit({ resetCadence: 'CalendarYear' })]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    const benefit = result.benefits[0];
    expect(benefit.periodStart).toEqual(utc(2026, 1, 1));
    expect(benefit.periodEnd).toEqual(new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)));
  });

  it('calculates cardmember year period using renewalDate', async () => {
    const userCard = {
      id: 'uc-1',
      masterCardId: 'mc-1',
      renewalDate: utc(2024, 5, 15),
    };
    mockFindMany.mockResolvedValue([makeMasterBenefit({ resetCadence: 'CardmemberYear' })]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      userCard,
      defaultPlayerId,
      defaultRefDate // April 8, 2026
    );

    const benefit = result.benefits[0];
    // Ref (Apr 8) < candidate (May 15, 2026) → period starts May 15, 2025
    expect(benefit.periodStart).toEqual(utc(2025, 5, 15));
    expect(benefit.periodEnd).toEqual(new Date(Date.UTC(2026, 4, 14, 23, 59, 59, 999)));
  });

  it('calculates one-time period with null periodEnd', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit({ resetCadence: 'OneTime' })]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    const benefit = result.benefits[0];
    expect(benefit.periodStart).toEqual(utc(2026, 4, 8));
    expect(benefit.periodEnd).toBeNull();
  });

  it('sets expirationDate equal to periodEnd for backward compat', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit({ resetCadence: 'Monthly' })]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    await generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate);

    const data = mockCreateMany.mock.calls[0][0].data[0];
    expect(data.expirationDate).toEqual(data.periodEnd);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // claimingCadence override
  // ──────────────────────────────────────────────────────────────────────────

  it('uses claimingCadence when it differs from resetCadence', async () => {
    // Amex Platinum Uber: annual reset but monthly claiming
    mockFindMany.mockResolvedValue([
      makeMasterBenefit({
        resetCadence: 'CalendarYear',
        claimingCadence: 'MONTHLY',
        claimingAmount: 1500,
      }),
    ]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    // Should use monthly period despite CalendarYear reset
    const benefit = result.benefits[0];
    expect(benefit.periodStart).toEqual(utc(2026, 4, 1));
    expect(benefit.periodEnd).toEqual(new Date(Date.UTC(2026, 3, 30, 23, 59, 59, 999)));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Multiple benefits
  // ──────────────────────────────────────────────────────────────────────────

  it('handles mixed cadence types in one card', async () => {
    mockFindMany.mockResolvedValue([
      makeMasterBenefit({ id: 'mb-1', name: 'Monthly Credit', resetCadence: 'Monthly' }),
      makeMasterBenefit({ id: 'mb-2', name: 'Annual Credit', resetCadence: 'CalendarYear' }),
      makeMasterBenefit({ id: 'mb-3', name: 'One-Time Bonus', resetCadence: 'OneTime' }),
    ]);
    mockCreateMany.mockResolvedValue({ count: 3 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    expect(result.count).toBe(3);
    expect(result.benefits).toHaveLength(3);

    // Verify each has different period characteristics
    const monthly = result.benefits.find((b) => b.name === 'Monthly Credit')!;
    const annual = result.benefits.find((b) => b.name === 'Annual Credit')!;
    const oneTime = result.benefits.find((b) => b.name === 'One-Time Bonus')!;

    expect(monthly.periodEnd).not.toBeNull();
    expect(annual.periodEnd).not.toBeNull();
    expect(oneTime.periodEnd).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Duplicate prevention
  // ──────────────────────────────────────────────────────────────────────────

  it('handles createMany returning fewer rows due to duplicates', async () => {
    mockFindMany.mockResolvedValue([
      makeMasterBenefit({ id: 'mb-1' }),
      makeMasterBenefit({ id: 'mb-2', name: 'Travel Credit' }),
    ]);
    // One was a duplicate
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId,
      defaultRefDate
    );

    // count reflects actual DB inserts, but summaries show all attempted
    expect(result.count).toBe(1);
    expect(result.benefits).toHaveLength(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Query filtering
  // ──────────────────────────────────────────────────────────────────────────

  it('queries only active and default MasterBenefits', async () => {
    mockFindMany.mockResolvedValue([]);

    await generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        masterCardId: 'mc-1',
        isActive: true,
        isDefault: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Default referenceDate
  // ──────────────────────────────────────────────────────────────────────────

  it('defaults referenceDate to now when not provided', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit()]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const before = new Date();
    const result = await generateBenefitsForCard(
      mockTx as any,
      defaultUserCard,
      defaultPlayerId
      // no referenceDate — should default to now
    );

    // periodStart should be first of the current month
    const start = result.benefits[0].periodStart;
    expect(start.getUTCDate()).toBe(1);
    // Should be this month
    expect(start.getUTCMonth()).toBe(before.getUTCMonth());
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Error handling
  // ──────────────────────────────────────────────────────────────────────────

  it('propagates database errors from findMany', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection failed'));

    await expect(
      generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate)
    ).rejects.toThrow('DB connection failed');
  });

  it('propagates database errors from createMany', async () => {
    mockFindMany.mockResolvedValue([makeMasterBenefit()]);
    mockCreateMany.mockRejectedValue(new Error('Unique constraint violated'));

    await expect(
      generateBenefitsForCard(mockTx as any, defaultUserCard, defaultPlayerId, defaultRefDate)
    ).rejects.toThrow('Unique constraint violated');
  });
});

// ============================================================================
// generateBenefitsForCardStandalone
// ============================================================================

describe('generateBenefitsForCardStandalone', () => {
  it('wraps the call in a Prisma transaction', async () => {
    // The standalone version calls prisma.$transaction which passes tx
    // to the inner function. We need to simulate this.
    mockTransaction.mockImplementation(async (fn) => {
      return fn(mockTx);
    });
    mockFindMany.mockResolvedValue([makeMasterBenefit()]);
    mockCreateMany.mockResolvedValue({ count: 1 });

    const result = await generateBenefitsForCardStandalone(
      'uc-1',
      'mc-1',
      'player-1',
      defaultRefDate,
      utc(2027, 4, 8)
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(1);
  });
});
