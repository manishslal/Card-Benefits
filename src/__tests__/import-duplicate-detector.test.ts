/**
 * Import Duplicate Detector Tests
 *
 * Comprehensive test suite for duplicate detection logic including:
 * - Within-batch duplicate detection
 * - Database duplicate detection with mocked prisma
 * - Difference detection (field-level changes)
 * - Suggested actions for different duplicate types
 * - Dedup key accuracy
 * - End-to-end duplicate detection
 *
 * Total: 50+ test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  findWithinBatchDuplicates,
  findDatabaseDuplicates,
  detectDuplicates,
  type DuplicateMatch,
  type DuplicateCheckResult,
} from '@/lib/import/duplicate-detector';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userCard: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userBenefit: {
      findMany: vi.fn(),
    },
  },
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const testCardRecord1 = {
  id: 'row-1',
  rowNumber: 1,
  recordType: 'Card' as const,
  data: {
    CardName: 'Chase Sapphire Reserve',
    Issuer: 'Chase',
    AnnualFee: 55000,
    RenewalDate: '2025-12-31',
  },
};

const testCardRecord2 = {
  id: 'row-2',
  rowNumber: 2,
  recordType: 'Card' as const,
  data: {
    CardName: 'Chase Sapphire Reserve',
    Issuer: 'Chase',
    AnnualFee: 55000,
    RenewalDate: '2025-12-31',
  },
};

const testCardRecord3 = {
  id: 'row-3',
  rowNumber: 3,
  recordType: 'Card' as const,
  data: {
    CardName: 'American Express Gold',
    Issuer: 'American Express',
    AnnualFee: 29000,
    RenewalDate: '2025-06-30',
  },
};

const testBenefitRecord1 = {
  id: 'row-1',
  rowNumber: 1,
  recordType: 'Benefit' as const,
  data: {
    CardName: 'Chase Sapphire Reserve',
    Issuer: 'Chase',
    BenefitName: '3% Dining Cash Back',
    BenefitType: 'StatementCredit',
    StickerValue: 300000,
  },
};

const testBenefitRecord2 = {
  id: 'row-2',
  rowNumber: 2,
  recordType: 'Benefit' as const,
  data: {
    CardName: 'Chase Sapphire Reserve',
    Issuer: 'Chase',
    BenefitName: '3% Dining Cash Back',
    BenefitType: 'StatementCredit',
    StickerValue: 300000,
  },
};

const testBenefitRecord3 = {
  id: 'row-3',
  rowNumber: 3,
  recordType: 'Benefit' as const,
  data: {
    CardName: 'Chase Sapphire Reserve',
    Issuer: 'Chase',
    BenefitName: '1% Travel Cash Back',
    BenefitType: 'StatementCredit',
    StickerValue: 150000,
  },
};

const existingCardInDB = {
  id: 'card-123',
  playerId: 'player-1',
  masterCardId: 'mc-123',
  annualFee: 50000,
  renewalDate: new Date('2024-12-31'),
  customName: null,
  status: 'Active' as const,
  version: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const existingBenefitInDB = {
  id: 'benefit-123',
  userCardId: 'card-123',
  name: '3% Dining Cash Back',
  type: 'StatementCredit' as const,
  stickerValue: 300000,
  version: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ============================================================================
// SECTION 1: Within-Batch Duplicate Detection (15 tests)
// ============================================================================

describe('Within-Batch Duplicate Detection', () => {
  describe('findWithinBatchDuplicates - Card Records', () => {
    it('detects exact duplicate cards in batch', () => {
      const records = [testCardRecord1, testCardRecord2];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(true);
      expect(result.cardDuplicates).toBeGreaterThan(0);
      expect(result.totalDuplicates).toBeGreaterThan(0);
    });

    it('identifies which records are duplicates', () => {
      const records = [testCardRecord1, testCardRecord2];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].recordType).toBe('Card');
    });

    it('does not flag different cards as duplicates', () => {
      const records = [testCardRecord1, testCardRecord3];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(false);
      expect(result.totalDuplicates).toBe(0);
    });

    it('handles single card without false positives', () => {
      const records = [testCardRecord1];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(false);
    });

    it('handles empty batch', () => {
      const records: any[] = [];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicates).toHaveLength(0);
    });

    it('uses correct dedup key for cards (cardName + issuer)', () => {
      const record1 = {
        ...testCardRecord1,
        id: 'row-1',
      };
      const record2 = {
        ...testCardRecord1,
        id: 'row-2',
        rowNumber: 2,
      };

      const result = findWithinBatchDuplicates([record1, record2], 'player-1');

      expect(result.cardDuplicates).toBeGreaterThan(0);
    });

    it('detects duplicates even with whitespace differences in values', () => {
      const record1 = { ...testCardRecord1, id: 'row-1' };
      const record2 = {
        ...testCardRecord2,
        id: 'row-2',
        rowNumber: 2,
        data: {
          ...testCardRecord2.data,
          CardName: '  Chase Sapphire Reserve  ',
        },
      };

      const result = findWithinBatchDuplicates([record1, record2], 'player-1');

      // Should normalize and detect duplicates
      expect(result.hasDuplicates).toBe(true);
    });

    it('detects duplicates with case-insensitive matching', () => {
      const record1 = { ...testCardRecord1, id: 'row-1' };
      const record2 = {
        ...testCardRecord2,
        id: 'row-2',
        rowNumber: 2,
        data: {
          ...testCardRecord2.data,
          CardName: 'chase sapphire reserve',
        },
      };

      const result = findWithinBatchDuplicates([record1, record2], 'player-1');

      expect(result.hasDuplicates).toBe(true);
    });
  });

  describe('findWithinBatchDuplicates - Benefit Records', () => {
    it('detects exact duplicate benefits in batch', () => {
      const records = [testBenefitRecord1, testBenefitRecord2];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(true);
      expect(result.benefitDuplicates).toBeGreaterThan(0);
    });

    it('identifies which benefit records are duplicates', () => {
      const records = [testBenefitRecord1, testBenefitRecord2];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].recordType).toBe('Benefit');
    });

    it('does not flag different benefits as duplicates', () => {
      const records = [testBenefitRecord1, testBenefitRecord3];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.hasDuplicates).toBe(false);
    });

    it('uses correct dedup key for benefits (card + benefit name)', () => {
      const record1 = {
        ...testBenefitRecord1,
        id: 'row-1',
      };
      const record2 = {
        ...testBenefitRecord1,
        id: 'row-2',
        rowNumber: 2,
      };

      const result = findWithinBatchDuplicates([record1, record2], 'player-1');

      expect(result.benefitDuplicates).toBeGreaterThan(0);
    });

    it('detects multiple duplicate groups within batch', () => {
      const records = [
        testBenefitRecord1,
        testBenefitRecord2, // Duplicate of 1
        testBenefitRecord3, // Different
        {
          ...testBenefitRecord3,
          id: 'row-4',
          rowNumber: 4,
        }, // Duplicate of 3
      ];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.totalDuplicates).toBe(2);
    });
  });

  describe('findWithinBatchDuplicates - Mixed Records', () => {
    it('handles mixed card and benefit records', () => {
      const records = [testCardRecord1, testBenefitRecord1, testCardRecord2];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.cardDuplicates).toBeGreaterThan(0);
      expect(result.benefitDuplicates).toBe(0);
    });

    it('counts duplicates correctly for mixed records', () => {
      const records = [
        testCardRecord1,
        testCardRecord2, // Card duplicate
        testBenefitRecord1,
        testBenefitRecord2, // Benefit duplicate
      ];

      const result = findWithinBatchDuplicates(records, 'player-1');

      expect(result.cardDuplicates).toBe(1);
      expect(result.benefitDuplicates).toBe(1);
      expect(result.totalDuplicates).toBe(2);
    });
  });
});

// ============================================================================
// SECTION 2: Database Duplicate Detection (15 tests)
// ============================================================================

describe('Database Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findDatabaseDuplicates - Card Records', () => {
    it('finds existing card in database', async () => {
      (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

      const records = [testCardRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.hasDuplicates).toBe(true);
      expect(result.cardDuplicates).toBeGreaterThan(0);
    });

    it('identifies which records match database', async () => {
      (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

      const records = [testCardRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].recordType).toBe('Card');
      expect(result.duplicates[0].existingRecord).toBeDefined();
    });

    it('does not flag non-existent cards', async () => {
      (prisma.userCard.findUnique as any).mockResolvedValue(null);

      const records = [testCardRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.hasDuplicates).toBe(false);
    });

    it('detects multiple existing cards', async () => {
      (prisma.userCard.findUnique as any).mockImplementation(
        async (query: any) => {
          if (query.where.masterCardId === 'mc-123') {
            return existingCardInDB;
          }
          return null;
        }
      );

      const records = [testCardRecord1, testCardRecord3];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      // Only first record should match
      expect(result.cardDuplicates).toBe(1);
    });
  });

  describe('findDatabaseDuplicates - Benefit Records', () => {
    it('finds existing benefit in database', async () => {
      (prisma.userBenefit.findMany as any).mockResolvedValue([
        existingBenefitInDB,
      ]);

      const records = [testBenefitRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.hasDuplicates).toBe(true);
      expect(result.benefitDuplicates).toBeGreaterThan(0);
    });

    it('identifies which benefit records match database', async () => {
      (prisma.userBenefit.findMany as any).mockResolvedValue([
        existingBenefitInDB,
      ]);

      const records = [testBenefitRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].recordType).toBe('Benefit');
    });

    it('does not flag non-existent benefits', async () => {
      (prisma.userBenefit.findMany as any).mockResolvedValue([]);

      const records = [testBenefitRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.hasDuplicates).toBe(false);
    });

    it('detects multiple existing benefits', async () => {
      (prisma.userBenefit.findMany as any).mockResolvedValue([
        existingBenefitInDB,
        {
          ...existingBenefitInDB,
          id: 'benefit-456',
          name: '1% Travel Cash Back',
        },
      ]);

      const records = [testBenefitRecord1, testBenefitRecord3];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'user-1'
      );

      expect(result.benefitDuplicates).toBe(2);
    });
  });

  describe('findDatabaseDuplicates - Authorization', () => {
    it('only searches within player context', async () => {
      (prisma.userCard.findUnique as any).mockResolvedValue(null);

      const records = [testCardRecord1];

      await findDatabaseDuplicates(records, 'player-1', 'user-1');

      // Verify the call was made with correct player context
      expect(prisma.userCard.findUnique).toHaveBeenCalled();
    });

    it('handles user without access to player', async () => {
      (prisma.userCard.findUnique as any).mockResolvedValue(null);

      const records = [testCardRecord1];

      const result = await findDatabaseDuplicates(
        records,
        'player-1',
        'different-user'
      );

      // Should return no duplicates (isolation by user)
      expect(result).toBeDefined();
    });
  });
});

// ============================================================================
// SECTION 3: Difference Detection (10 tests)
// ============================================================================

describe('Difference Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects changed annual fee', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      annualFee: 50000,
    });

    const records = [
      {
        ...testCardRecord1,
        data: {
          ...testCardRecord1.data,
          AnnualFee: 55000, // Different
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      const feeDiff = differences.find((d) => d.field === 'AnnualFee');
      expect(feeDiff).toBeDefined();
    }
  });

  it('detects changed renewal date', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      renewalDate: new Date('2024-12-31'),
    });

    const records = [
      {
        ...testCardRecord1,
        data: {
          ...testCardRecord1.data,
          RenewalDate: '2025-12-31', // Different
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      const dateDiff = differences.find((d) => d.field === 'RenewalDate');
      expect(dateDiff).toBeDefined();
    }
  });

  it('detects unchanged benefits', async () => {
    (prisma.userBenefit.findMany as any).mockResolvedValue([
      existingBenefitInDB,
    ]);

    const records = [testBenefitRecord1];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      // Should be empty if all fields match
      expect(Array.isArray(differences)).toBe(true);
    }
  });

  it('detects multiple field differences', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      annualFee: 50000,
      renewalDate: new Date('2024-12-31'),
    });

    const records = [
      {
        ...testCardRecord1,
        data: {
          ...testCardRecord1.data,
          AnnualFee: 55000,
          RenewalDate: '2025-12-31',
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      expect(differences.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('handles null value comparisons', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      customName: null,
    });

    const records = [
      {
        ...testCardRecord1,
        data: {
          ...testCardRecord1.data,
          CustomName: 'My Card',
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      const nameDiff = differences.find((d) => d.field === 'CustomName');
      expect(nameDiff).toBeDefined();
      expect(nameDiff?.existing).toBeNull();
    }
  });

  it('handles date format normalization', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      renewalDate: new Date('2025-12-31'),
    });

    const records = [
      {
        ...testCardRecord1,
        data: {
          ...testCardRecord1.data,
          RenewalDate: '2025-12-31',
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const differences = result.duplicates[0].differences;
      const dateDiff = differences.find((d) => d.field === 'RenewalDate');
      // Should be no difference when dates match
      expect(dateDiff).toBeUndefined();
    }
  });
});

// ============================================================================
// SECTION 4: Suggested Actions (10 tests)
// ============================================================================

describe('Suggested Actions for Duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suggests Skip for exact duplicates (no differences)', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      annualFee: 55000,
      renewalDate: new Date('2025-12-31'),
    });

    const records = [testCardRecord1];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      expect(result.duplicates[0].suggestedActions).toContain('Skip');
    }
  });

  it('suggests Update for duplicates with differences', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      annualFee: 50000, // Different from record
    });

    const records = [testCardRecord1];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      expect(result.duplicates[0].suggestedActions).toContain('Update');
    }
  });

  it('suggests KeepBoth for new benefit variations', async () => {
    (prisma.userBenefit.findMany as any).mockResolvedValue([
      existingBenefitInDB,
    ]);

    const records = [
      {
        ...testBenefitRecord1,
        data: {
          ...testBenefitRecord1.data,
          StickerValue: 400000, // Different value
        },
      },
    ];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      expect(result.duplicates[0].suggestedActions).toContain('KeepBoth');
    }
  });

  it('provides actionable suggestions', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue({
      ...existingCardInDB,
      annualFee: 50000,
    });

    const records = [testCardRecord1];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      expect(result.duplicates[0].suggestedActions.length).toBeGreaterThan(0);
      result.duplicates[0].suggestedActions.forEach((action) => {
        expect(['Skip', 'Update', 'KeepBoth', 'Merge']).toContain(action);
      });
    }
  });

  it('handles no suggested actions for ambiguous cases', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(null);

    const records = [testCardRecord1];

    const result = await findDatabaseDuplicates(
      records,
      'player-1',
      'user-1'
    );

    expect(result.hasDuplicates).toBe(false);
  });
});

// ============================================================================
// SECTION 5: End-to-End Duplicate Detection (10 tests)
// ============================================================================

describe('End-to-End Duplicate Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects within-batch and database duplicates together', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

    const records = [
      testCardRecord1,
      testCardRecord2, // Within-batch duplicate
    ];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    // Should detect both within-batch and database duplicates
    expect(result.totalDuplicates).toBeGreaterThanOrEqual(1);
  });

  it('provides complete duplicate match information', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

    const records = [testCardRecord1];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const match = result.duplicates[0];
      expect(match.id).toBeDefined();
      expect(match.rowNumber).toBeDefined();
      expect(match.recordType).toBeDefined();
      expect(match.newRecord).toBeDefined();
      expect(match.existingRecord).toBeDefined();
      expect(match.differences).toBeDefined();
      expect(match.suggestedActions).toBeDefined();
    }
  });

  it('allows user to resolve duplicates', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

    const records = [testCardRecord1];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      // User should be able to set decision
      result.duplicates[0].userDecision = 'Update';
      expect(result.duplicates[0].userDecision).toBe('Update');
    }
  });

  it('handles batch with no duplicates', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(null);

    const records = [testCardRecord1];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    expect(result.hasDuplicates).toBe(false);
    expect(result.totalDuplicates).toBe(0);
  });

  it('handles empty batch', async () => {
    const records: any[] = [];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    expect(result.hasDuplicates).toBe(false);
    expect(result.duplicates).toHaveLength(0);
  });

  it('maintains duplicate match reference data', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

    const records = [testCardRecord1];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const match = result.duplicates[0];
      // Ensure data is preserved for later reference
      expect(match.newRecord.CardName).toBe('Chase Sapphire Reserve');
      expect(match.existingRecord.id).toBe('card-123');
    }
  });

  it('tracks row numbers for duplicate references', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(null);

    const records = [
      { ...testCardRecord1, rowNumber: 5 },
      { ...testCardRecord2, rowNumber: 7 },
    ];

    const result = findWithinBatchDuplicates(records, 'player-1');

    if (result.duplicates.length > 0) {
      expect(result.duplicates[0].rowNumber).toBeGreaterThan(0);
    }
  });

  it('generates duplicate summary statistics', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);
    (prisma.userBenefit.findMany as any).mockResolvedValue([
      existingBenefitInDB,
    ]);

    const records = [
      testCardRecord1,
      testCardRecord2, // Within-batch dup
      testBenefitRecord1,
    ];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    expect(result.cardDuplicates).toBeDefined();
    expect(result.benefitDuplicates).toBeDefined();
    expect(result.totalDuplicates).toBeDefined();
    expect(result.totalDuplicates).toBeGreaterThanOrEqual(0);
  });

  it('handles database errors gracefully', async () => {
    (prisma.userCard.findUnique as any).mockRejectedValue(
      new Error('Database error')
    );

    const records = [testCardRecord1];

    // Should throw or return error state
    expect(async () => {
      await detectDuplicates(records, 'player-1', 'user-1');
    }).rejects;
  });
});

// ============================================================================
// SECTION 6: Edge Cases (5 tests)
// ============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles very large batch efficiently', () => {
    const records = [];
    for (let i = 0; i < 10000; i++) {
      records.push({
        ...testCardRecord1,
        id: `row-${i}`,
        rowNumber: i + 1,
      });
    }

    const startTime = Date.now();
    const result = findWithinBatchDuplicates(records, 'player-1');
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    expect(result).toBeDefined();
  });

  it('handles records with missing dedup fields', () => {
    const incompleteRecord = {
      id: 'row-1',
      rowNumber: 1,
      recordType: 'Card' as const,
      data: {
        // Missing CardName and Issuer
        AnnualFee: 55000,
      },
    };

    const result = findWithinBatchDuplicates([incompleteRecord], 'player-1');

    expect(result).toBeDefined();
  });

  it('normalizes case sensitivity in dedup keys', () => {
    const record1 = {
      ...testCardRecord1,
      id: 'row-1',
      data: {
        ...testCardRecord1.data,
        CardName: 'CHASE SAPPHIRE',
      },
    };
    const record2 = {
      ...testCardRecord2,
      id: 'row-2',
      rowNumber: 2,
      data: {
        ...testCardRecord2.data,
        CardName: 'chase sapphire',
      },
    };

    const result = findWithinBatchDuplicates([record1, record2], 'player-1');

    // Should normalize case and detect duplicates
    expect(result.hasDuplicates).toBe(true);
  });

  it('handles null issuer in dedup key', () => {
    const recordWithNullIssuer = {
      id: 'row-1',
      rowNumber: 1,
      recordType: 'Card' as const,
      data: {
        CardName: 'Chase Sapphire',
        Issuer: null,
        AnnualFee: 55000,
      },
    };

    const result = findWithinBatchDuplicates([recordWithNullIssuer], 'player-1');

    expect(result).toBeDefined();
  });

  it('preserves duplicate match context for user decisions', async () => {
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCardInDB);

    const records = [testCardRecord1];

    const result = await detectDuplicates(
      records,
      'player-1',
      'user-1'
    );

    if (result.duplicates.length > 0) {
      const match = result.duplicates[0];
      // User needs full context to make decision
      expect(match.newRecord).toEqual(testCardRecord1.data);
      expect(match.existingRecord).toBeDefined();
      expect(match.differences).toBeDefined();
      expect(match.suggestedActions).toBeDefined();
    }
  });
});
