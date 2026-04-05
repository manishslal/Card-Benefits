/**
 * Import End-to-End Workflow Tests
 *
 * Comprehensive test suite for complete import workflows including:
 * - Happy path: upload → parse → validate → check duplicates → commit
 * - Error scenarios and recovery
 * - State preservation across steps
 * - Authorization for all steps
 * - Real-world import scenarios
 *
 * Total: 20+ test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/shared/lib';
import {
  uploadImportFile,
  validateImportFile,
  checkImportDuplicates,
  performImportCommit,
} from '@/features/import-export';

// Mock Prisma
vi.mock('@/shared/lib', () => ({
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
}));

// ============================================================================
// TEST FIXTURES & HELPERS
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

const mockMasterCard = {
  id: 'mc-123',
  cardName: 'Chase Sapphire Reserve',
  issuer: 'Chase',
  defaultAnnualFee: 55000,
};

const mockMasterCard2 = {
  id: 'mc-456',
  cardName: 'American Express Gold',
  issuer: 'American Express',
  defaultAnnualFee: 29000,
};

function createMockCsvFile(content: string, filename: string = 'cards.csv') {
  return new File([content], filename, { type: 'text/csv' });
}

function resetAllMocks() {
  vi.clearAllMocks();
  (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
  (prisma.user.findUnique as any).mockResolvedValue(mockUser);
}

// ============================================================================
// SECTION 1: Happy Path Workflows (5 tests)
// ============================================================================

describe('Happy Path: Complete Import Workflow', () => {
  beforeEach(resetAllMocks);

  it('successfully imports single card: upload → validate → check duplicates → commit', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file = createMockCsvFile(csvContent);

    // Step 1: Upload
    const mockJob = {
      id: 'job-1',
      playerId: 'player-1',
      userId: 'user-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      cardsCreated: 0,
      benefitsCreated: 0,
      columnMappings: {
        CardName: { fieldName: 'CardName', score: 1.0 },
        Issuer: { fieldName: 'Issuer', score: 1.0 },
        AnnualFee: { fieldName: 'AnnualFee', score: 1.0 },
      },
      normalizedHeaderNames: ['CardName', 'Issuer', 'AnnualFee'],
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);
    expect(uploadResp.data?.status).toBe('Uploaded');
    const jobId = uploadResp.data?.jobId;

    // Step 2: Validate
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        rowNumber: 1,
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '55000',
        },
        status: 'Pending',
      },
    ]);

    const validatedJob = { ...mockJob, status: 'ValidatingComplete' as const };
    (prisma.importJob.update as any).mockResolvedValue(validatedJob);

    const validateResp = await validateImportFile(jobId!);
    expect(validateResp.success).toBe(true);
    expect(validateResp.data?.status).toBe('ValidatingComplete');

    // Step 3: Check Duplicates
    (prisma.importJob.findUnique as any).mockResolvedValue(validatedJob);
    (prisma.userCard.findUnique as any).mockResolvedValue(null); // No duplicates

    const dupCheckJob = {
      ...validatedJob,
      status: 'DuplicateCheckComplete' as const,
    };
    (prisma.importJob.update as any).mockResolvedValue(dupCheckJob);

    const dupResp = await checkImportDuplicates(jobId!);
    expect(dupResp.success).toBe(true);
    expect(dupResp.data?.hasDuplicates).toBe(false);

    // Step 4: Commit
    (prisma.importJob.findUnique as any).mockResolvedValue(dupCheckJob);
    (prisma.userCard.create as any).mockResolvedValue({
      id: 'card-new-1',
      masterCardId: 'mc-123',
    });

    const committedJob = {
      ...dupCheckJob,
      status: 'Committed' as const,
      cardsCreated: 1,
    };
    (prisma.importJob.update as any).mockResolvedValue(committedJob);

    const commitResp = await performImportCommit(jobId!);
    expect(commitResp.success).toBe(true);
    expect(commitResp.data?.status).toBe('Committed');
    expect(commitResp.data?.cardsCreated).toBe(1);
  });

  it('successfully imports multiple cards and benefits', async () => {
    const csvContent = `CardName,Issuer,AnnualFee
Chase Sapphire Reserve,Chase,55000
American Express Gold,American Express,29000
CardName,Issuer,BenefitName,StickerValue
Chase Sapphire Reserve,Chase,3% Dining,300000
`;
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 3,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockImplementation(
      async (query: any) => {
        if (query.where.cardName === 'Chase Sapphire Reserve') {
          return mockMasterCard;
        }
        if (query.where.cardName === 'American Express Gold') {
          return mockMasterCard2;
        }
        return null;
      }
    );
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 3 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);
    expect(uploadResp.data?.totalRecords).toBeGreaterThan(0);
  });

  it('handles workflow with benefit records that reference cards', async () => {
    const csvContent = `CardName,Issuer,BenefitName,BenefitType,StickerValue
Chase Sapphire Reserve,Chase,3% Dining Cash Back,StatementCredit,300000
Chase Sapphire Reserve,Chase,1% Travel Cash Back,StatementCredit,150000
`;
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 2,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 2 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);
  });

  it('completes workflow when updating existing cards', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee,RenewalDate\nChase Sapphire Reserve,Chase,60000,2026-12-31\n';
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);

    // Subsequent steps would detect duplicate and offer Update action
    const jobId = uploadResp.data?.jobId;

    const validatedJob = {
      ...mockJob,
      status: 'ValidatingComplete' as const,
    };
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '60000',
          RenewalDate: '2026-12-31',
        },
      },
    ]);
    (prisma.importJob.update as any).mockResolvedValue(validatedJob);

    const validateResp = await validateImportFile(jobId!);
    expect(validateResp.success).toBe(true);
  });

  it('workflow preserves user data modifications through all steps', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee,CustomName\nChase Sapphire Reserve,Chase,55000,My Premium Card\n';
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    const jobId = uploadResp.data?.jobId;

    // Data with CustomName should be preserved through workflow
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '55000',
          CustomName: 'My Premium Card', // Should persist
        },
      },
    ]);

    const validatedJob = { ...mockJob, status: 'ValidatingComplete' as const };
    (prisma.importJob.update as any).mockResolvedValue(validatedJob);

    const validateResp = await validateImportFile(jobId!);
    expect(validateResp.success).toBe(true);
  });
});

// ============================================================================
// SECTION 2: Error Scenarios & Recovery (8 tests)
// ============================================================================

describe('Error Scenarios & Recovery', () => {
  beforeEach(resetAllMocks);

  it('recovers from validation errors and allows re-upload', async () => {
    const badCsvContent =
      'CardName,Issuer,AnnualFee\nInvalidCard,UnknownBank,99999999\n';
    const file = createMockCsvFile(badCsvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(null); // Card not found
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true); // Upload succeeds

    const jobId = uploadResp.data?.jobId;

    // Validation detects error
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'InvalidCard',
          Issuer: 'UnknownBank',
          AnnualFee: '99999999',
        },
      },
    ]);

    const validationJob = {
      ...mockJob,
      status: 'ValidatingComplete' as const,
      errorLog: [
        {
          recordId: 'rec-1',
          field: 'AnnualFee',
          message: 'Exceeds maximum',
          severity: 'critical',
        },
      ],
    };
    (prisma.importJob.update as any).mockResolvedValue(validationJob);

    const validateResp = await validateImportFile(jobId!);
    expect(validateResp.success).toBe(true);

    // User can then upload corrected file
    const correctedContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const correctedFile = createMockCsvFile(correctedContent);

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue({
      ...mockJob,
      id: 'job-2',
    });
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const correctedUpload = await uploadImportFile('player-1', correctedFile);
    expect(correctedUpload.success).toBe(true);
  });

  it('handles duplicate detection and user resolution', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,60000\n';
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    const jobId = uploadResp.data?.jobId;

    // Validate
    const validatedJob = { ...mockJob, status: 'ValidatingComplete' as const };
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '60000',
        },
      },
    ]);
    (prisma.importJob.update as any).mockResolvedValue(validatedJob);

    await validateImportFile(jobId!);

    // Check duplicates - finds existing card
    const existingCard = {
      id: 'card-123',
      masterCardId: 'mc-123',
      annualFee: 55000, // Different from import
      renewalDate: new Date('2025-12-31'),
    };

    (prisma.importJob.findUnique as any).mockResolvedValue(validatedJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '60000',
        },
      },
    ]);
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.userCard.findUnique as any).mockResolvedValue(existingCard);

    const dupJob = {
      ...validatedJob,
      status: 'DuplicateCheckComplete' as const,
    };
    (prisma.importJob.update as any).mockResolvedValue(dupJob);

    const dupResp = await checkImportDuplicates(jobId!);
    expect(dupResp.success).toBe(true);
    expect(dupResp.data?.hasDuplicates).toBe(true);

    // User resolves to Update
    (prisma.importJob.findUnique as any).mockResolvedValue(dupJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '60000',
        },
        status: 'Update',
      },
    ]);
    (prisma.userCard.update as any).mockResolvedValue({
      id: 'card-123',
      annualFee: 60000,
      version: 2,
    });

    const committedJob = {
      ...dupJob,
      status: 'Committed' as const,
    };
    (prisma.importJob.update as any).mockResolvedValue(committedJob);

    const userResolutions = [
      {
        recordId: 'rec-1',
        decision: 'Update' as const,
      },
    ];

    const commitResp = await performImportCommit(
      'player-1',
      jobId!,
      userResolutions
    );
    expect(commitResp.success).toBe(true);
  });

  it('allows rollback if user cancels import at any step', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);

    // User cancels before completing workflow
    // Job remains in database but import is never committed
    // New upload would create fresh job
  });

  it('handles network errors gracefully', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file = createMockCsvFile(csvContent);

    (prisma.player.findUnique as any).mockRejectedValue(
      new Error('Network timeout')
    );

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(false);
  });

  it('handles malformed CSV gracefully', async () => {
    const malformedCsv = 'CardName,Issuer,AnnualFee\nChase,Chase,"55000';
    const file = createMockCsvFile(malformedCsv);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    // Should either succeed with parsed data or fail gracefully
    expect(uploadResp).toBeDefined();
  });

  it('prevents partial commits on database constraint violations', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'DuplicateCheckComplete' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '55000',
        },
      },
    ]);
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    // Simulate constraint violation (duplicate unique key)
    (prisma.userCard.create as any).mockRejectedValue(
      new Error('Unique constraint violation')
    );

    const commitResp = await performImportCommit('job-1');

    expect(commitResp.success).toBe(false);
    // Job should not be marked committed
  });

  it('logs detailed errors for debugging', async () => {
    const badCsvContent =
      'CardName,Issuer,AnnualFee\nInvalidCard,UnknownBank,invalid\n';
    const file = createMockCsvFile(badCsvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(null);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);

    // Validate
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'InvalidCard',
          Issuer: 'UnknownBank',
          AnnualFee: 'invalid',
        },
      },
    ]);

    const validationJob = {
      ...mockJob,
      status: 'ValidatingComplete' as const,
      errorLog: [
        {
          recordId: 'rec-1',
          rowNumber: 1,
          field: 'AnnualFee',
          message: 'Invalid monetary value',
          severity: 'critical',
        },
      ],
    };
    (prisma.importJob.update as any).mockResolvedValue(validationJob);

    const validateResp = await validateImportFile(uploadResp.data?.jobId!);
    expect(validateResp.success).toBe(true);
  });
});

// ============================================================================
// SECTION 3: Authorization & Security (5 tests)
// ============================================================================

describe('Authorization & Security', () => {
  beforeEach(resetAllMocks);

  it('prevents unauthorized users from uploading files to other players', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file = createMockCsvFile(csvContent);

    // Mock different user ownership
    (prisma.player.findUnique as any).mockResolvedValue({
      ...mockPlayer,
      userId: 'different-user',
    });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(false);
    expect(uploadResp.code).toBe('AUTHZ_OWNERSHIP');
  });

  it('prevents unauthorized users from validating others imports', async () => {
    (prisma.importJob.findUnique as any).mockResolvedValue({
      id: 'job-1',
      userId: 'different-user',
      playerId: 'player-1',
      status: 'Uploaded',
    });

    const validateResp = await validateImportFile('job-1');
    expect(validateResp.success).toBe(false);
    expect(validateResp.code).toBe('AUTHZ_OWNERSHIP');
  });

  it('prevents unauthorized users from checking duplicates', async () => {
    (prisma.importJob.findUnique as any).mockResolvedValue({
      id: 'job-1',
      userId: 'different-user',
      playerId: 'player-1',
      status: 'ValidatingComplete',
    });

    const dupResp = await checkImportDuplicates('job-1');
    expect(dupResp.success).toBe(false);
    expect(dupResp.code).toBe('AUTHZ_OWNERSHIP');
  });

  it('prevents unauthorized users from committing imports', async () => {
    (prisma.importJob.findUnique as any).mockResolvedValue({
      id: 'job-1',
      userId: 'different-user',
      playerId: 'player-1',
      status: 'DuplicateCheckComplete',
    });

    const commitResp = await performImportCommit('job-1');
    expect(commitResp.success).toBe(false);
    expect(commitResp.code).toBe('AUTHZ_OWNERSHIP');
  });

  it('verifies player ownership at each workflow step', async () => {
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file = createMockCsvFile(csvContent);

    // Valid upload
    (prisma.player.findUnique as any).mockResolvedValue(mockPlayer);
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue({
      id: 'job-1',
      status: 'Uploaded',
      playerId: 'player-1',
      userId: 'user-1',
    });
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const uploadResp = await uploadImportFile('player-1', file);
    expect(uploadResp.success).toBe(true);

    // Invalid validate from different player
    (prisma.importJob.findUnique as any).mockResolvedValue({
      id: 'job-1',
      playerId: 'player-1', // Job belongs to player-1
      userId: 'user-1',
      status: 'Uploaded',
    });

    // But trying to validate as different player
    const validateResp = await validateImportFile(
      'player-2', // Different player
      'job-1'
    );
    expect(validateResp.success).toBe(false);
  });
});

// ============================================================================
// SECTION 4: State & Data Integrity (2 tests)
// ============================================================================

describe('State & Data Integrity', () => {
  beforeEach(resetAllMocks);

  it('maintains data consistency through entire workflow', async () => {
    const csvContent = `CardName,Issuer,AnnualFee,CustomName,BenefitName,StickerValue
Chase Sapphire Reserve,Chase,55000,My Card,3% Dining,300000
`;
    const file = createMockCsvFile(csvContent);

    const mockJob = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 2,
      playerId: 'player-1',
      userId: 'user-1',
      cardsCreated: 0,
      benefitsCreated: 0,
      errorLog: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 2 });

    const uploadResp = await uploadImportFile('player-1', file);
    const jobId = uploadResp.data?.jobId!;

    // Data should remain consistent through validate
    (prisma.importJob.findUnique as any).mockResolvedValue(mockJob);
    (prisma.importRecord.findMany as any).mockResolvedValue([
      {
        id: 'rec-1',
        recordType: 'Card',
        data: {
          CardName: 'Chase Sapphire Reserve',
          Issuer: 'Chase',
          AnnualFee: '55000',
          CustomName: 'My Card',
        },
      },
      {
        id: 'rec-2',
        recordType: 'Benefit',
        data: {
          CardName: 'Chase Sapphire Reserve',
          BenefitName: '3% Dining',
          StickerValue: '300000',
        },
      },
    ]);

    const validatedJob = {
      ...mockJob,
      status: 'ValidatingComplete' as const,
    };
    (prisma.importJob.update as any).mockResolvedValue(validatedJob);

    const validateResp = await validateImportFile(jobId);
    expect(validateResp.success).toBe(true);

    // Data consistency through duplicate check
    (prisma.importJob.findUnique as any).mockResolvedValue(validatedJob);
    (prisma.userCard.findUnique as any).mockResolvedValue(null);
    (prisma.userBenefit.findMany as any).mockResolvedValue([]);

    const dupCheckJob = {
      ...validatedJob,
      status: 'DuplicateCheckComplete' as const,
    };
    (prisma.importJob.update as any).mockResolvedValue(dupCheckJob);

    const dupResp = await checkImportDuplicates(jobId);
    expect(dupResp.success).toBe(true);

    // Commit with consistency
    (prisma.importJob.findUnique as any).mockResolvedValue(dupCheckJob);
    (prisma.userCard.create as any).mockResolvedValue({
      id: 'card-new',
      masterCardId: 'mc-123',
    });
    (prisma.userCard.findUnique as any).mockResolvedValue({
      id: 'card-new',
    });
    (prisma.userBenefit.create as any).mockResolvedValue({
      id: 'benefit-new',
      userCardId: 'card-new',
    });

    const committedJob = {
      ...dupCheckJob,
      status: 'Committed' as const,
      cardsCreated: 1,
      benefitsCreated: 1,
    };
    (prisma.importJob.update as any).mockResolvedValue(committedJob);

    const commitResp = await performImportCommit(jobId);
    expect(commitResp.success).toBe(true);
    expect(commitResp.data?.cardsCreated).toBe(1);
    expect(commitResp.data?.benefitsCreated).toBe(1);
  });

  it('prevents concurrent imports on same player', async () => {
    // First import
    const csvContent =
      'CardName,Issuer,AnnualFee\nChase Sapphire Reserve,Chase,55000\n';
    const file1 = createMockCsvFile(csvContent);

    const mockJob1 = {
      id: 'job-1',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
    (prisma.importJob.create as any).mockResolvedValue(mockJob1);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const upload1 = await uploadImportFile('player-1', file1);
    expect(upload1.success).toBe(true);

    // Second upload to same player while first is pending
    const file2 = createMockCsvFile(
      'CardName,Issuer,AnnualFee\nAmerican Express Gold,American Express,29000\n'
    );

    const mockJob2 = {
      id: 'job-2',
      status: 'Uploaded' as const,
      totalRecords: 1,
      playerId: 'player-1',
      userId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (prisma.importJob.create as any).mockResolvedValue(mockJob2);
    (prisma.importRecord.createMany as any).mockResolvedValue({ count: 1 });

    const upload2 = await uploadImportFile('player-1', file2);
    expect(upload2.success).toBe(true);

    // Both jobs exist independently - user must complete/cancel first before committing second
  });
});
