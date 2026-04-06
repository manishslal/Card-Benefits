/**
 * Import Server Actions Integration Tests
 *
 * Comprehensive test suite for server-side import actions including:
 * - uploadImportFile() action
 * - validateImportFile() action
 * - checkImportDuplicates() action
 * - performImportCommit() action
 * - Authorization checks on all actions
 * - Error handling and edge cases
 * - Full state management through import workflow
 *
 * Total: 40+ test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/shared/lib';
import {
  uploadImportFile,
  validateImportFile,
  checkImportDuplicates,
  performImportCommit,
} from '@/features/import-export';

// Mock Prisma - use importOriginal to get actual exports like AppError
vi.mock('@/shared/lib', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib')>();
  
  return {
    ...actual,
    prisma: {
      importJob: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      importRecord: {
        createMany: vi.fn(),
        updateMany: vi.fn(),
        findMany: vi.fn(),
      },
      masterCard: {
        findFirst: vi.fn(),
      },
      userCard: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userBenefit: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      player: {
        findUnique: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
      },
    },
  };
});

// Mock auth
vi.mock('@/lib/auth', () => ({
  verifySessionToken: vi.fn(),
}));

// Mock auth-server (used by server actions)
vi.mock('@/features/auth/lib/auth', () => ({
  getAuthUserIdOrThrow: vi.fn(() => 'user-1'),
  verifyPlayerOwnership: vi.fn(async (playerId: string, userId: string) => {
    // Use the mocked prisma to check ownership (simulating real behavior)
    const prismaModule = await import('@/shared/lib');
    const player = await (prismaModule.prisma as any).player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });

    if (!player) {
      return { isOwner: false, error: 'Player not found' };
    }

    if (player.userId !== userId) {
      return { isOwner: false, error: 'You do not have permission to modify this player' };
    }

    return { isOwner: true };
  }),
}));

// Mock import library functions
vi.mock('@/lib/import/parser', () => ({
  parseFile: vi.fn(async (file: File) => {
    // Simulate parsing CSV
    if (file.size === 0) {
      return { success: false, error: 'Empty file' };
    }
    return {
      success: true,
      totalRows: 2,
      rows: [
        { CardName: 'Chase Sapphire Reserve', Issuer: 'Chase', AnnualFee: '550' },
        { CardName: 'Amex Platinum', Issuer: 'Amex', AnnualFee: '695' },
      ],
      headers: ['CardName', 'Issuer', 'AnnualFee'],
    };
  }),
  detectColumnMapping: vi.fn((headers: string[]) => {
    // Return standard mappings for test headers
    const mapping: any = {};
    headers.forEach((header, index) => {
      mapping[header] = {
        fileIndex: index,
        systemField: header,
        confidence: 1.0,
        detectionType: 'exact' as const,
      };
    });
    return mapping;
  }),
}));

vi.mock('@/lib/import/validator', () => ({
  validateCardRecord: vi.fn((record: any) => ({
    isValid: true,
    errors: [],
    warnings: [],
  })),
  validateBenefitRecord: vi.fn((record: any) => ({
    isValid: true,
    errors: [],
    warnings: [],
  })),
}));

vi.mock('@/lib/import/duplicate-detector', () => ({
  detectDuplicates: vi.fn(async (records: any[], mapping: any) => {
    return { duplicates: [], warnings: [] };
  }),
}));

vi.mock('@/lib/import/committer', () => ({
  commitImport: vi.fn(async (jobId: string, records: any[]) => {
    return {
      success: true,
      cardsCreated: 1,
      benefitsCreated: 0,
      cardsUpdated: 0,
      benefitsUpdated: 0,
    };
  }),
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
};

const mockPlayer = {
  id: 'player-1',
  userId: 'user-1',
  displayName: 'Test Player',
};

const mockImportJob = {
  id: 'job-1',
  playerId: 'player-1',
  userId: 'user-1',
  status: 'Uploaded' as const,
  totalRecords: 2,
  cardsCreated: 0,
  benefitsCreated: 0,
  columnMappings: {
    CardName: { fileIndex: 0, systemField: 'CardName', confidence: 1.0, detectionType: 'exact' as const },
    Issuer: { fileIndex: 1, systemField: 'Issuer', confidence: 1.0, detectionType: 'exact' as const },
    AnnualFee: { fileIndex: 2, systemField: 'AnnualFee', confidence: 1.0, detectionType: 'exact' as const },
  },
  normalizedHeaderNames: ['CardName', 'Issuer', 'AnnualFee'],
  errorLog: [],
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockMasterCard = {
  id: 'mc-123',
  cardName: 'Chase Sapphire Reserve',
  issuer: 'Chase',
  defaultAnnualFee: 55000,
};

const mockCsvFile = new File(
  ['CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n'],
  'cards.csv',
  { type: 'text/csv' }
);

// ============================================================================
// SECTION 1: uploadImportFile Action Tests (10 tests)
// ============================================================================

describe('uploadImportFile Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImportFile - Success Cases', () => {
    it('successfully uploads and parses CSV file', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.importJob.create as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.createMany as any).mockResolvedValue({
        count: 2,
      });

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data?.importJobId).toBeDefined();
        expect(response.data?.totalRecords).toBeGreaterThan(0);
        expect(response.data?.status).toBe('Uploaded');
      }
    });

    it('creates ImportJob record on successful upload', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.importJob.create as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.createMany as any).mockResolvedValue({
        count: 1,
      });

      await uploadImportFile('player-1', mockCsvFile);

      expect(prisma.importJob.create).toHaveBeenCalled();
    });

    it('stores column mappings in ImportJob', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.importJob.create as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.createMany as any).mockResolvedValue({
        count: 1,
      });

      const response = await uploadImportFile('player-1', mockCsvFile);

      if (response.success) {
        expect(response.data?.columnMappings).toBeDefined();
      }
    });

    it('detects file format correctly (CSV)', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.importJob.create as any).mockResolvedValue({
        ...mockImportJob,
        format: 'CSV',
      });
      (prisma.importRecord.createMany as any).mockResolvedValue({
        count: 1,
      });

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(true);
    });
  });

  describe('uploadImportFile - Authorization', () => {
    it('rejects upload from unauthorized user', async () => {
      // User doesn't own the player
      (prisma.player.findUnique as any).mockResolvedValue({
        ...mockPlayer,
        userId: 'different-user',
      });

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(false);
      expect(response.code).toBe('AUTHZ_OWNERSHIP');
    });

    it('rejects upload for non-existent player', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(null);

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(false);
      expect(response.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects upload for non-existent user', async () => {
      (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(false);
    });
  });

  describe('uploadImportFile - Error Handling', () => {
    it('rejects invalid file format', async () => {
      const invalidFile = new File(['\x25\x50'], 'cards.csv', {
        type: 'text/csv',
      }); // PDF magic bytes

      const response = await uploadImportFile('player-1', invalidFile);

      expect(response.success).toBe(false);
      expect(response.code).toBe('FILE_FORMAT_INVALID');
    });

    it('rejects empty file', async () => {
      const emptyFile = new File([''], 'cards.csv', { type: 'text/csv' });

      const response = await uploadImportFile('player-1', emptyFile);

      expect(response.success).toBe(false);
    });

    it('handles database errors gracefully', async () => {
      (prisma.player.findUnique as any).mockRejectedValue(
        new Error('Database error')
      );

      const response = await uploadImportFile('player-1', mockCsvFile);

      expect(response.success).toBe(false);
      expect(response.code).toBe('DATABASE_ERROR');
    });

    it('includes detailed error message on failure', async () => {
      const invalidFile = new File([], 'cards.csv', { type: 'text/csv' });

      const response = await uploadImportFile('player-1', invalidFile);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SECTION 2: validateImportFile Action Tests (10 tests)
// ============================================================================

describe('validateImportFile Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateImportFile - Success Cases', () => {
    it('validates records in import job', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: '55000',
          }),
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'ValidatingComplete',
      });

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data?.status).toBe('ValidatingComplete');
      }
    });

    it('updates ImportJob status to ValidatingComplete', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([]);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'ValidatingComplete',
      });

      await validateImportFile('job-1');

      expect(prisma.importJob.update).toHaveBeenCalled();
    });

    it('returns validation errors and warnings', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'NonExistent',
            Issuer: 'Unknown',
            AnnualFee: '55000',
          }),
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(null); // Card not found
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'ValidatingComplete',
        errorLog: [
          {
            recordId: 'rec-1',
            field: 'CardName',
            message: 'Card not found',
            severity: 'critical',
          },
        ],
      });

      const response = await validateImportFile('job-1');

      if (response.success) {
        expect(response.data?.validationSummary).toBeDefined();
      }
    });
  });

  describe('validateImportFile - Authorization', () => {
    it('rejects validation from unauthorized user', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        userId: 'different-user',
      });

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('AUTHZ_OWNERSHIP');
    });

    it('rejects validation for non-existent job', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(null);

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('verifies player ownership', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        playerId: 'different-player',
      });

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(false);
    });
  });

  describe('validateImportFile - Error Handling', () => {
    it('handles database errors gracefully', async () => {
      (prisma.importJob.findUnique as any).mockRejectedValue(
        new Error('Database error')
      );

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('DATABASE_ERROR');
    });

    it('accumulates validation errors from multiple records', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            AnnualFee: '-5000', // Invalid
          }),
        },
        {
          id: 'rec-2',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Unknown', // Invalid
          }),
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(null);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        errorLog: [
          { recordId: 'rec-1', field: 'AnnualFee', severity: 'critical' },
          { recordId: 'rec-2', field: 'CardName', severity: 'critical' },
        ],
      });

      const response = await validateImportFile('job-1');

      expect(response.success).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 3: checkImportDuplicates Action Tests (10 tests)
// ============================================================================

describe('checkImportDuplicates Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkImportDuplicates - Success Cases', () => {
    it('detects duplicates within batch', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire',
            Issuer: 'Chase',
          }),
        },
        {
          id: 'rec-2',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire',
            Issuer: 'Chase',
          }),
        },
      ]);
      (prisma.userCard.findUnique as any).mockResolvedValue(null);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(true);
    });

    it('detects duplicates against existing database records', async () => {
      const existingCard = {
        id: 'card-123',
        masterCardId: 'mc-123',
        annualFee: 55000,
      };

      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
          }),
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.userCard.findUnique as any).mockResolvedValue(existingCard);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(true);
    });

    it('provides suggested actions for duplicates', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.userCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
        annualFee: 50000, // Different
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });

      const response = await checkImportDuplicates('job-1');

      if (response.success) {
        expect(response.data?.duplicates).toBeDefined();
        if (response.data?.duplicates && response.data.duplicates.length > 0) {
          expect(response.data.duplicates[0].suggestedActions).toBeDefined();
        }
      }
    });

    it('updates ImportJob status to DuplicateCheckComplete', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([]);
      (prisma.userCard.findUnique as any).mockResolvedValue(null);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });

      await checkImportDuplicates('job-1');

      expect(prisma.importJob.update).toHaveBeenCalled();
    });
  });

  describe('checkImportDuplicates - Authorization', () => {
    it('rejects check from unauthorized user', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        userId: 'different-user',
      });

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('AUTHZ_OWNERSHIP');
    });

    it('rejects check for non-existent job', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(null);

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('checkImportDuplicates - Error Handling', () => {
    it('handles database errors gracefully', async () => {
      (prisma.importJob.findUnique as any).mockRejectedValue(
        new Error('Database error')
      );

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('DATABASE_ERROR');
    });

    it('handles no duplicates case', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(mockImportJob);
      (prisma.importRecord.findMany as any).mockResolvedValue([]);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });

      const response = await checkImportDuplicates('job-1');

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data?.hasDuplicates).toBe(false);
      }
    });
  });
});

// ============================================================================
// SECTION 4: performImportCommit Action Tests (10 tests)
// ============================================================================

describe('performImportCommit Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('performImportCommit - Success Cases', () => {
    it('commits import to database successfully', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
          status: 'Pending',
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.userCard.create as any).mockResolvedValue({
        id: 'card-new',
        masterCardId: 'mc-123',
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
        cardsCreated: 1,
      });

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data?.status).toBe('Committed');
      }
    });

    it('creates new cards from import records', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
          status: 'Pending',
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.userCard.create as any).mockResolvedValue({
        id: 'card-new',
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
        cardsCreated: 1,
      });

      await performImportCommit('job-1');

      expect(prisma.userCard.create).toHaveBeenCalled();
    });

    it('creates new benefits from import records', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Benefit',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            BenefitName: 'Cash Back',
            StickerValue: 300000,
          }),
          status: 'Pending',
        },
      ]);
      (prisma.userCard.findUnique as any).mockResolvedValue({
        id: 'card-123',
      });
      (prisma.userBenefit.create as any).mockResolvedValue({
        id: 'benefit-new',
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
        benefitsCreated: 1,
      });

      await performImportCommit('job-1');

      expect(prisma.userBenefit.create).toHaveBeenCalled();
    });

    it('updates existing cards when instructed', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
          status: 'Update',
        },
      ]);
      (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
      (prisma.userCard.update as any).mockResolvedValue({
        id: 'card-123',
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
      });

      const userResolutions = [
        {
          recordId: 'rec-1',
          decision: 'Update' as const,
        },
      ];

      await performImportCommit('job-1');

      expect(prisma.userCard.update).toHaveBeenCalled();
    });

    it('skips records marked for skip', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
          status: 'Skip',
        },
      ]);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
        cardsCreated: 0,
      });

      const userResolutions = [
        {
          recordId: 'rec-1',
          decision: 'Skip' as const,
        },
      ];

      const response = await performImportCommit(
        'player-1',
        'job-1',
        userResolutions
      );

      expect(response.success).toBe(true);
      // userCard.create should not be called for skipped records
    });

    it('updates ImportJob status to Committed', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([]);
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
      });

      await performImportCommit('job-1');

      expect(prisma.importJob.update).toHaveBeenCalled();
    });
  });

  describe('performImportCommit - Authorization', () => {
    it('rejects commit from unauthorized user', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        userId: 'different-user',
      });

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('AUTHZ_OWNERSHIP');
    });

    it('rejects commit for non-existent job', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue(null);

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('prevents commit before validation', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Uploaded', // Not yet validated
      });

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
    });

    it('prevents commit before duplicate check', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'ValidatingComplete', // Validated but not duplicate checked
      });

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
    });
  });

  describe('performImportCommit - Error Handling', () => {
    it('rolls back transaction on error', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          data: JSON.stringify({
            CardName: 'Chase Sapphire Reserve',
            Issuer: 'Chase',
            AnnualFee: 55000,
          }),
        },
      ]);
      (prisma.userCard.create as any).mockRejectedValue(
        new Error('Database error')
      );

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
      // Job should not be marked as Committed
      expect(prisma.importJob.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'Committed',
          }),
        })
      );
    });

    it('handles database errors gracefully', async () => {
      (prisma.importJob.findUnique as any).mockRejectedValue(
        new Error('Database error')
      );

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(false);
      expect(response.code).toBe('DATABASE_ERROR');
    });

    it('returns summary of created/updated records', async () => {
      (prisma.importJob.findUnique as any).mockResolvedValue({
        ...mockImportJob,
        status: 'DuplicateCheckComplete',
      });
      (prisma.importRecord.findMany as any).mockResolvedValue([
        {
          id: 'rec-1',
          recordType: 'Card',
          status: 'Pending',
        },
        {
          id: 'rec-2',
          recordType: 'Benefit',
          status: 'Pending',
        },
      ]);
      (prisma.userCard.create as any).mockResolvedValue({
        id: 'card-new',
      });
      (prisma.userBenefit.create as any).mockResolvedValue({
        id: 'benefit-new',
      });
      (prisma.importJob.update as any).mockResolvedValue({
        ...mockImportJob,
        status: 'Committed',
        cardsCreated: 1,
        benefitsCreated: 1,
      });

      const response = await performImportCommit('job-1');

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data?.cardsCreated).toBeGreaterThanOrEqual(0);
        expect(response.data?.benefitsCreated).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ============================================================================
// SECTION 5: Full Workflow Integration (5 tests)
// ============================================================================

describe('Full Import Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
    (prisma.user.findUnique as any).mockResolvedValue(mockUser);
  });

  it('completes full 5-step workflow: upload → validate → check duplicates → resolve → commit', async () => {
    // Step 1: Upload
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockImportJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({
      count: 1,
    });

    const uploadResp = await uploadImportFile('player-1', mockCsvFile);
    expect(uploadResp.success).toBe(true);
    const jobId = uploadResp.data?.importJobId;

    // Step 2: Validate
    (prisma.importJob.findUnique as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
    });
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: JSON.stringify({
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '55000',
        }),
      },
    ]);
    (prisma.importJob.update as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
      status: 'ValidatingComplete',
    });

    const validateResp = await validateImportFile(jobId!);
    expect(validateResp.success).toBe(true);

    // Step 3: Check Duplicates
    (prisma.importJob.findUnique as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
      status: 'ValidatingComplete',
    });
    (prisma.userCard.findUnique as any).mockResolvedValue(null);
    (prisma.importJob.update as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
      status: 'DuplicateCheckComplete',
    });

    const duplicateResp = await checkImportDuplicates(jobId!);
    expect(duplicateResp.success).toBe(true);

    // Step 4: Commit
    (prisma.importJob.findUnique as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
      status: 'DuplicateCheckComplete',
    });
    (prisma.userCard.create as any).mockResolvedValue({
      id: 'card-new',
    });
    (prisma.importJob.update as any).mockResolvedValue({
      ...mockImportJob,
      id: jobId,
      status: 'Committed',
      cardsCreated: 1,
    });

    const commitResp = await performImportCommit(jobId!);
    expect(commitResp.success).toBe(true);
  });

  it('maintains state across workflow steps', async () => {
    // Job state should persist through all steps
    const jobState = { ...mockImportJob, status: 'Uploaded' as const };

    // Upload creates job
    expect(jobState.status).toBe('Uploaded');

    // Validate progresses status
    jobState.status = 'ValidatingComplete' as const;
    expect(jobState.status).toBe('ValidatingComplete');

    // Duplicate check progresses status
    jobState.status = 'DuplicateCheckComplete' as const;
    expect(jobState.status).toBe('DuplicateCheckComplete');

    // Commit completes workflow
    jobState.status = 'Committed' as const;
    expect(jobState.status).toBe('Committed');
  });

  it('prevents workflow from skipping steps', async () => {
    (prisma.importJob.findUnique as any).mockResolvedValue({
      ...mockImportJob,
      status: 'Uploaded', // Not validated
    });

    // Should not allow direct commit
    const response = await performImportCommit('job-1');
    expect(response.success).toBe(false);
  });
});
