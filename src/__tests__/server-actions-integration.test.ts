/**
 * Integration tests for refactored server actions using centralized error handling.
 *
 * Tests verify:
 * - Input validation with proper error codes
 * - Authorization checks (ownership verification)
 * - Success responses with correct data shapes
 * - Error responses with proper status codes
 * - Database error handling (not found, conflicts, etc.)
 * - Race condition detection
 *
 * Usage: npm run test -- --testPathPattern=server-actions-integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addCardToWallet } from '@/actions/wallet';
import { toggleBenefit, updateUserDeclaredValue } from '@/actions/benefits';
import { ERROR_CODES, ERROR_MESSAGES, AppError } from '@/lib/errors';
import { Prisma } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    masterCard: {
      findUniqueOrThrow: vi.fn(),
    },
    userCard: {
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    userBenefit: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth-server', () => ({
  getAuthUserIdOrThrow: vi.fn(),
  verifyPlayerOwnership: vi.fn(),
  verifyBenefitOwnership: vi.fn(),
}));

vi.mock('@/lib/benefitDates', () => ({
  calcExpirationDate: vi.fn(() => new Date('2027-12-31')),
}));

import { prisma } from '@/lib/prisma';
import {
  getAuthUserIdOrThrow,
  verifyPlayerOwnership,
  verifyBenefitOwnership,
} from '@/lib/auth-server';

// ============================================================================
// Test Suite: addCardToWallet
// ============================================================================

describe('Server Actions - addCardToWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation Tests ─────────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('rejects invalid playerId (not UUID format)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await addCardToWallet(
        'invalid-id',
        'a0000000-0000-4000-8000-000000000000',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
      expect(result).toHaveProperty('statusCode', 400);
    });

    it('rejects invalid masterCardId (not UUID format)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'not-a-uuid',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });

    it('rejects invalid renewalDate (past date)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const pastDate = new Date('2020-01-01');
      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        pastDate
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });

    it('rejects invalid renewalDate (not a Date)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        'invalid-date' as any
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });
  });

  // ── Authentication Tests ─────────────────────────────────────────────────

  describe('Authentication', () => {
    it('rejects request with no authenticated user', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockImplementation(() => {
        throw new AppError(ERROR_CODES.AUTH_MISSING);
      });

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.AUTH_MISSING);
    });
  });

  // ── Authorization Tests ──────────────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects if user does not own the player', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: false });

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.AUTHZ_OWNERSHIP);
      expect(result).toHaveProperty('statusCode', 403);
    });
  });

  // ── Success Tests ────────────────────────────────────────────────────────

  describe('Success Cases', () => {
    it('creates card with cloned benefits on valid input', async () => {
      const userId = 'a0000000-0000-4000-8000-000000000001';
      const playerId = 'a0000000-0000-4000-8000-000000000002';
      const masterCardId = 'a0000000-0000-4000-8000-000000000003';

      vi.mocked(getAuthUserIdOrThrow).mockReturnValue(userId);
      vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: true });

      const mockMasterCard = {
        id: masterCardId,
        name: 'Amex Platinum',
        defaultAnnualFee: 0,
        masterBenefits: [
          {
            id: 'benefit-1',
            name: 'Airline credit',
            type: 'FIXED_VALUE',
            stickerValue: 20000,
            resetCadence: 'ANNUAL',
            isActive: true,
          },
        ],
      };

      const mockUserCard = {
        id: 'card-123',
        playerId,
        masterCardId,
        actualAnnualFee: 0,
        renewalDate: new Date('2027-12-31'),
        createdAt: new Date(),
        updatedAt: new Date(),
        userBenefits: [
          {
            id: 'benefit-1',
            name: 'Airline credit',
            type: 'FIXED_VALUE',
            stickerValue: 20000,
            userDeclaredValue: null,
            resetCadence: 'ANNUAL',
            isUsed: false,
            claimedAt: null,
            timesUsed: 0,
            expirationDate: new Date('2027-12-31'),
            userCardId: 'card-123',
            playerId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        masterCard: mockMasterCard,
      };

      vi.mocked(prisma.masterCard.findUniqueOrThrow).mockResolvedValue(mockMasterCard as any);
      vi.mocked(prisma.$transaction).mockResolvedValue(mockUserCard as any);

      const result = await addCardToWallet(
        playerId,
        masterCardId,
        new Date('2027-12-31')
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('card-123');
      }
    });
  });

  // ── Database Error Tests ─────────────────────────────────────────────────

  describe('Database Error Handling', () => {
    it('returns RESOURCE_NOT_FOUND when MasterCard does not exist', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: true });

      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });

      vi.mocked(prisma.masterCard.findUniqueOrThrow).mockRejectedValue(error);

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.RESOURCE_NOT_FOUND);
      expect(result).toHaveProperty('statusCode', 404);
    });

    it('returns CONFLICT_DUPLICATE when player already has card', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: true });

      const mockMasterCard = {
        id: 'master-123',
        name: 'Test Card',
        defaultAnnualFee: 0,
        masterBenefits: [],
      };

      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '1.0',
        }
      );

      vi.mocked(prisma.masterCard.findUniqueOrThrow).mockResolvedValue(mockMasterCard as any);
      vi.mocked(prisma.$transaction).mockRejectedValue(error);

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.CONFLICT_DUPLICATE);
      expect(result).toHaveProperty('statusCode', 409);
    });

    it('returns INTERNAL_ERROR on unexpected database error', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: true });

      const mockMasterCard = {
        id: 'master-123',
        name: 'Test Card',
        defaultAnnualFee: 0,
        masterBenefits: [],
      };

      const error = new Error('Unexpected database error');
      vi.mocked(prisma.masterCard.findUniqueOrThrow).mockResolvedValue(mockMasterCard as any);
      vi.mocked(prisma.$transaction).mockRejectedValue(error);

      const result = await addCardToWallet(
        'a0000000-0000-4000-8000-000000000000',
        'a0000000-0000-4000-8000-000000000001',
        new Date('2027-12-31')
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.INTERNAL_ERROR);
      expect(result).toHaveProperty('statusCode', 500);
    });
  });
});

// ============================================================================
// Test Suite: toggleBenefit
// ============================================================================

describe('Server Actions - toggleBenefit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation Tests ─────────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('rejects invalid benefitId (not UUID format)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await toggleBenefit('invalid-id', false);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
      expect(result).toHaveProperty('statusCode', 400);
    });
  });

  // ── Authorization Tests ──────────────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects if user does not own the benefit', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: false });

      const result = await toggleBenefit(
        'a0000000-0000-4000-8000-000000000000',
        false
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.AUTHZ_OWNERSHIP);
      expect(result).toHaveProperty('statusCode', 403);
    });
  });

  // ── Race Condition Tests ─────────────────────────────────────────────────

  describe('Race Condition Detection', () => {
    it('detects when benefit state changed (concurrent toggle)', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const error = new Prisma.PrismaClientKnownRequestError(
        'Conditional update failed',
        {
          code: 'P2025',
          clientVersion: '1.0',
        }
      );

      vi.mocked(prisma.userBenefit.update).mockRejectedValue(error);

      const result = await toggleBenefit(
        'a0000000-0000-4000-8000-000000000000',
        false
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.CONFLICT_STATE);
      expect(result).toHaveProperty('statusCode', 409);
    });
  });

  // ── Success Tests ────────────────────────────────────────────────────────

  describe('Success Cases', () => {
    it('marks benefit as used and increments counter', async () => {
      const benefitId = 'a0000000-0000-4000-8000-000000000000';

      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const mockBenefit = {
        id: benefitId,
        isUsed: true,
        claimedAt: new Date(),
        timesUsed: 1,
        name: 'Test benefit',
        type: 'FIXED_VALUE',
        stickerValue: 10000,
        userDeclaredValue: null,
        resetCadence: 'ANNUAL',
        expirationDate: new Date('2027-12-31'),
        userCardId: 'card-123',
        playerId: 'player-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userBenefit.update).mockResolvedValue(mockBenefit);

      const result = await toggleBenefit(benefitId, false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isUsed).toBe(true);
        expect(result.data.timesUsed).toBe(1);
      }
    });

    it('marks benefit as unused without decrementing counter', async () => {
      const benefitId = 'a0000000-0000-4000-8000-000000000000';

      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const mockBenefit = {
        id: benefitId,
        isUsed: false,
        claimedAt: null,
        timesUsed: 1, // Counter stays the same
        name: 'Test benefit',
        type: 'FIXED_VALUE',
        stickerValue: 10000,
        userDeclaredValue: null,
        resetCadence: 'ANNUAL',
        expirationDate: new Date('2027-12-31'),
        userCardId: 'card-123',
        playerId: 'player-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userBenefit.update).mockResolvedValue(mockBenefit);

      const result = await toggleBenefit(benefitId, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isUsed).toBe(false);
        expect(result.data.timesUsed).toBe(1); // Not decremented
      }
    });
  });
});

// ============================================================================
// Test Suite: updateUserDeclaredValue
// ============================================================================

describe('Server Actions - updateUserDeclaredValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Validation Tests ─────────────────────────────────────────────────────

  describe('Input Validation', () => {
    it('rejects invalid benefitId', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await updateUserDeclaredValue('invalid-id', 1500);

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });

    it('rejects negative monetary value', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await updateUserDeclaredValue(
        'a0000000-0000-4000-8000-000000000000',
        -100
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });

    it('rejects non-integer monetary value', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

      const result = await updateUserDeclaredValue(
        'a0000000-0000-4000-8000-000000000000',
        15.99 // Floats not allowed (use cents)
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.VALIDATION_FIELD);
    });
  });

  // ── Authorization Tests ──────────────────────────────────────────────────

  describe('Authorization', () => {
    it('rejects if user does not own the benefit', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: false });

      const result = await updateUserDeclaredValue(
        'a0000000-0000-4000-8000-000000000000',
        1500
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.AUTHZ_OWNERSHIP);
      expect(result).toHaveProperty('statusCode', 403);
    });
  });

  // ── Success Tests ────────────────────────────────────────────────────────

  describe('Success Cases', () => {
    it('updates declared value to custom amount', async () => {
      const benefitId = 'a0000000-0000-4000-8000-000000000000';
      const newValue = 800; // $8.00

      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const mockBenefit = {
        id: benefitId,
        userDeclaredValue: newValue,
        name: 'Test benefit',
        type: 'FIXED_VALUE',
        stickerValue: 1000,
        isUsed: false,
        claimedAt: null,
        timesUsed: 0,
        resetCadence: 'ANNUAL',
        expirationDate: new Date('2027-12-31'),
        userCardId: 'card-123',
        playerId: 'player-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userBenefit.update).mockResolvedValue(mockBenefit);

      const result = await updateUserDeclaredValue(benefitId, newValue);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userDeclaredValue).toBe(800);
      }
    });

    it('allows zero value (user considers benefit worthless)', async () => {
      const benefitId = 'a0000000-0000-4000-8000-000000000000';

      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const mockBenefit = {
        id: benefitId,
        userDeclaredValue: 0,
        name: 'Test benefit',
        type: 'FIXED_VALUE',
        stickerValue: 1000,
        isUsed: false,
        claimedAt: null,
        timesUsed: 0,
        resetCadence: 'ANNUAL',
        expirationDate: new Date('2027-12-31'),
        userCardId: 'card-123',
        playerId: 'player-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.userBenefit.update).mockResolvedValue(mockBenefit);

      const result = await updateUserDeclaredValue(benefitId, 0);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userDeclaredValue).toBe(0);
      }
    });
  });

  // ── Database Error Tests ─────────────────────────────────────────────────

  describe('Database Error Handling', () => {
    it('returns RESOURCE_NOT_FOUND when benefit does not exist', async () => {
      vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
      vi.mocked(verifyBenefitOwnership).mockResolvedValue({ isOwner: true });

      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });

      vi.mocked(prisma.userBenefit.update).mockRejectedValue(error);

      const result = await updateUserDeclaredValue(
        'a0000000-0000-4000-8000-000000000000',
        1500
      );

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('code', ERROR_CODES.RESOURCE_NOT_FOUND);
      expect(result).toHaveProperty('statusCode', 404);
    });
  });
});

// ============================================================================
// Test Suite: Response Format Consistency
// ============================================================================

describe('Response Format Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('success responses have consistent shape', async () => {
    vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');
    vi.mocked(verifyPlayerOwnership).mockResolvedValue({ isOwner: true });

    const mockMasterCard = {
      id: 'master-123',
      name: 'Test Card',
      defaultAnnualFee: 0,
      masterBenefits: [],
    };

    const mockCard = {
      id: 'card-123',
      playerId: 'player-123',
      masterCardId: 'master-123',
      actualAnnualFee: 0,
      renewalDate: new Date('2027-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
      masterCard: mockMasterCard,
      userBenefits: [],
    };

    vi.mocked(prisma.masterCard.findUniqueOrThrow).mockResolvedValue(mockMasterCard as any);
    vi.mocked(prisma.$transaction).mockResolvedValue(mockCard as any);

    const result = await addCardToWallet(
      'a0000000-0000-4000-8000-000000000000',
      'a0000000-0000-4000-8000-000000000001',
      new Date('2027-12-31')
    );

    // Success response must have:
    // - success: true
    // - data: <resource>
    // - no error, code, or statusCode fields
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result).toHaveProperty('data');
      expect(result).not.toHaveProperty('error');
      expect(result).not.toHaveProperty('code');
      expect(result).not.toHaveProperty('statusCode');
    }
  });

  it('error responses have consistent shape', async () => {
    vi.mocked(getAuthUserIdOrThrow).mockReturnValue('user-123');

    const result = await addCardToWallet(
      'invalid-id',
      'a0000000-0000-4000-8000-000000000001',
      new Date('2027-12-31')
    );

    // Error response must have:
    // - success: false
    // - error: <message>
    // - code: <ERROR_CODE>
    // - statusCode: <number>
    // - details?: <object>
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('code');
      expect(result).toHaveProperty('statusCode');
      expect(typeof result.statusCode).toBe('number');
    }
  });

  it('error codes map to correct HTTP status codes', () => {
    const testCases = [
      [ERROR_CODES.VALIDATION_FIELD, 400],
      [ERROR_CODES.AUTH_MISSING, 401],
      [ERROR_CODES.AUTHZ_OWNERSHIP, 403],
      [ERROR_CODES.RESOURCE_NOT_FOUND, 404],
      [ERROR_CODES.CONFLICT_DUPLICATE, 409],
      [ERROR_CODES.INTERNAL_ERROR, 500],
    ];

    testCases.forEach(([code, expectedStatus]) => {
      const message = ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
      expect(message.statusCode).toBe(expectedStatus);
    });
  });
});
