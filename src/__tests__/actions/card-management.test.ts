/**
 * Unit Tests for Card Management Server Actions
 * 
 * Tests all server actions in src/actions/card-management.ts
 * Covers: CRUD operations, authorization, validation, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cardActions from '@/features/cards/actions/card-management';
import { AppError, ERROR_CODES } from '@/lib/errors';
import { assertSuccess, assertError } from '@/__tests__/setup';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userCard: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/features/auth/lib/auth', () => ({
  getAuthUserIdOrThrow: vi.fn(),
  verifyPlayerOwnership: vi.fn(),
  authorizeCardOperation: vi.fn()
}));

vi.mock('@/lib/card-validation', () => ({
  validateCustomName: vi.fn(),
  validateAnnualFee: vi.fn(),
  validateRenewalDate: vi.fn(),
  validateCardStatusTransition: vi.fn(),
  validateDeleteConfirmation: vi.fn(),
  validateBulkUpdateInput: vi.fn()
}));

import { prisma } from '@/lib/prisma';
import * as authServer from '@/features/auth/lib/auth';
import * as cardValidation from '@/features/cards/lib/validation';

// ============================================================================
// getPlayerCards Tests
// ============================================================================

describe('getPlayerCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return cards for authorized player', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: true
    });

    const mockCards = [
      {
        id: 'card-1',
        playerId,
        customName: 'My Card',
        actualAnnualFee: null,
        renewalDate: new Date('2025-12-31'),
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        masterCard: {
          id: 'mc-1',
          cardName: 'Chase Sapphire',
          issuer: 'Chase',
          defaultAnnualFee: 55000,
          cardImageUrl: 'https://example.com/card.png'
        },
        userBenefits: []
      }
    ];

    vi.mocked(prisma.userCard.findMany).mockResolvedValue(mockCards as any);
    vi.mocked(prisma.userCard.count).mockResolvedValue(1);

    const result = await cardActions.getPlayerCards(playerId);

    assertSuccess(result);
    expect(result.data.cards).toHaveLength(1);
    expect(result.data.total).toBe(1);
    expect(authServer.verifyPlayerOwnership).toHaveBeenCalledWith(playerId, userId);
  });

  it('should reject unauthorized user', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: false,
      error: 'Not the owner'
    });

    const result = await cardActions.getPlayerCards(playerId);

    assertError(result, ERROR_CODES.AUTHZ_OWNERSHIP);
    expect(result.code).toBe(ERROR_CODES.AUTHZ_OWNERSHIP);
  });

  it('should apply search filter', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: true
    });
    vi.mocked(prisma.userCard.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userCard.count).mockResolvedValue(0);

    await cardActions.getPlayerCards(playerId, {
      search: 'Sapphire'
    });

    const callArgs = vi.mocked(prisma.userCard.findMany).mock.calls[0]?.[0];
    expect(callArgs?.where?.OR).toBeDefined();
  });

  it('should apply status filter', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: true
    });
    vi.mocked(prisma.userCard.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userCard.count).mockResolvedValue(0);

    await cardActions.getPlayerCards(playerId, {
      status: 'ARCHIVED'
    });

    const callArgs = vi.mocked(prisma.userCard.findMany).mock.calls[0]?.[0];
    expect(callArgs?.where?.status).toBe('ARCHIVED');
  });

  it('should handle pagination', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: true
    });
    vi.mocked(prisma.userCard.findMany).mockResolvedValue([]);
    vi.mocked(prisma.userCard.count).mockResolvedValue(100);

    const result = await cardActions.getPlayerCards(playerId, {
      limit: 25,
      offset: 50
    });

    assertSuccess(result);
    expect(result.data.limit).toBe(25);
    expect(result.data.offset).toBe(50);
    const callArgs = vi.mocked(prisma.userCard.findMany).mock.calls[0]?.[0];
    expect(callArgs?.skip).toBe(50);
    expect(callArgs?.take).toBe(25);
  });

  it('should calculate wallet statistics', async () => {
    const playerId = 'player-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.verifyPlayerOwnership).mockResolvedValue({
      isOwner: true
    });

    const mockCard = {
      id: 'card-1',
      playerId,
      customName: null,
      actualAnnualFee: null,
      renewalDate: new Date(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        cardImageUrl: ''
      },
      userBenefits: [
        { stickerValue: 100000, isUsed: false, expirationDate: null }
      ]
    };

    vi.mocked(prisma.userCard.findMany).mockResolvedValue([mockCard] as any);
    vi.mocked(prisma.userCard.count).mockResolvedValue(1);

    const result = await cardActions.getPlayerCards(playerId);

    assertSuccess(result);
    expect(result.data.stats).toBeDefined();
    expect(result.data.stats.totalCards).toBeGreaterThanOrEqual(0);
    expect(result.data.stats.activeCards).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// getCardDetails Tests
// ============================================================================

describe('getCardDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return card details for authorized user', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);

    const mockCard = {
      id: cardId,
      customName: 'My Card',
      renewalDate: new Date(),
      status: 'ACTIVE',
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        masterBenefits: []
      },
      userBenefits: [],
      player: {
        id: 'player-1',
        user: { id: userId }
      }
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);

    const result = await cardActions.getCardDetails(cardId);

    assertSuccess(result);
    expect(result.data.id).toBe(cardId);
    expect(authServer.authorizeCardOperation).toHaveBeenCalledWith(userId, mockCard, 'READ');
  });

  it('should return 404 for non-existent card', async () => {
    const cardId = 'non-existent';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(null);

    const result = await cardActions.getCardDetails(cardId);

    assertError(result, ERROR_CODES.RESOURCE_NOT_FOUND);
    expect(result.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('should reject unauthorized access', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);

    const mockCard = {
      id: cardId,
      customName: 'My Card',
      renewalDate: new Date(),
      status: 'ACTIVE'
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(false);

    const result = await cardActions.getCardDetails(cardId);

    assertError(result, ERROR_CODES.AUTHZ_DENIED);
    expect(result.code).toBe(ERROR_CODES.AUTHZ_DENIED);
  });

  it('should generate diagnostics for overdue renewals', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30);

    const mockCard = {
      id: cardId,
      customName: null,
      renewalDate: pastDate,
      status: 'ACTIVE',
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        masterBenefits: []
      },
      userBenefits: [],
      player: {
        id: 'player-1',
        user: { id: userId }
      }
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);

    const result = await cardActions.getCardDetails(cardId);

    assertSuccess(result);
    expect(result.data.diagnostics.warnings).toBeDefined();
    // Should have warning for overdue renewal
    expect(result.data.diagnostics.warnings.some((w: { type: string }) => w.type === 'RENEWAL_OVERDUE')).toBe(true);
  });
});

// ============================================================================
// updateCard Tests
// ============================================================================

describe('updateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update card with valid data', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);
    vi.mocked(cardValidation.validateCustomName).mockImplementation(() => {});
    vi.mocked(cardValidation.validateAnnualFee).mockImplementation(() => {});
    vi.mocked(cardValidation.validateRenewalDate).mockImplementation(() => {});

    const mockCard = {
      id: cardId,
      customName: 'Old Name',
      actualAnnualFee: 55000,
      renewalDate: new Date('2025-12-31'),
      status: 'ACTIVE',
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        cardImageUrl: ''
      },
      userBenefits: []
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
    vi.mocked(prisma.userCard.update).mockResolvedValue({
      ...mockCard,
      customName: 'New Name'
    } as any);

    const result = await cardActions.updateCard(cardId, {
      customName: 'New Name'
    });

    assertSuccess(result);
    expect(cardValidation.validateCustomName).toHaveBeenCalledWith('New Name');
  });

  it('should validate input before updating', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);

    const mockCard = {
      id: cardId,
      status: 'ACTIVE'
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);
    vi.mocked(cardValidation.validateAnnualFee).mockImplementation(() => {
      throw new AppError(ERROR_CODES.VALIDATION_FIELD, { field: 'fee' });
    });

    const result = await cardActions.updateCard(cardId, {
      actualAnnualFee: -1
    });

    assertError(result, ERROR_CODES.VALIDATION_FIELD);
    expect(result.code).toBe(ERROR_CODES.VALIDATION_FIELD);
  });
});

// ============================================================================
// archiveCard Tests
// ============================================================================

describe('archiveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should archive card successfully', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);
    vi.mocked(cardValidation.validateCardStatusTransition).mockImplementation(() => {});

    const mockCard = {
      id: cardId,
      status: 'ACTIVE',
      customName: 'My Card',
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        cardImageUrl: ''
      },
      userBenefits: []
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);

    const mockTx = {
      userCard: {
        update: vi.fn().mockResolvedValue({
          ...mockCard,
          status: 'ARCHIVED'
        })
      }
    };

    vi.mocked(prisma.$transaction).mockImplementation((cb) => cb(mockTx as any));

    const result = await cardActions.archiveCard(cardId, 'User closed card');

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// unarchiveCard Tests
// ============================================================================

describe('unarchiveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unarchive card successfully', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);
    vi.mocked(cardValidation.validateCardStatusTransition).mockImplementation(() => {});

    const mockCard = {
      id: cardId,
      status: 'ARCHIVED',
      customName: 'My Card',
      masterCard: {
        id: 'mc-1',
        cardName: 'Card',
        issuer: 'Bank',
        defaultAnnualFee: 55000,
        cardImageUrl: ''
      },
      userBenefits: []
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);

    const mockTx = {
      userCard: {
        update: vi.fn().mockResolvedValue({
          ...mockCard,
          status: 'ACTIVE'
        })
      }
    };

    vi.mocked(prisma.$transaction).mockImplementation((cb) => cb(mockTx as any));

    const result = await cardActions.unarchiveCard(cardId);

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// deleteCard Tests
// ============================================================================

describe('deleteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete card with exact name confirmation', async () => {
    const cardId = 'card-1';
    const userId = 'user-1';
    const cardName = 'Chase Sapphire';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);
    vi.mocked(cardValidation.validateDeleteConfirmation).mockImplementation(() => {});

    const mockCard = {
      id: cardId,
      customName: null,
      masterCard: {
        id: 'mc-1',
        cardName
      }
    };

    vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
    vi.mocked(prisma.userCard.delete).mockResolvedValue(mockCard as any);

    const result = await cardActions.deleteCard(cardId, cardName);

    assertSuccess(result);
    expect(result.data.success).toBe(true);
  });
});

// ============================================================================
// bulkUpdateCards Tests
// ============================================================================

describe('bulkUpdateCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update multiple cards', async () => {
    const cardIds = ['card-1', 'card-2', 'card-3'];
    const userId = 'user-1';

    vi.mocked(authServer.getAuthUserIdOrThrow).mockReturnValue(userId);
    vi.mocked(cardValidation.validateBulkUpdateInput).mockImplementation(() => {});
    vi.mocked(cardValidation.validateAnnualFee).mockImplementation(() => {});
    vi.mocked(cardValidation.validateRenewalDate).mockImplementation(() => {});
    vi.mocked(cardValidation.validateCardStatusTransition).mockImplementation(() => {});
    vi.mocked(authServer.authorizeCardOperation).mockResolvedValue(true);

    const mockCards = cardIds.map(id => ({
      id,
      status: 'ACTIVE',
      masterCard: { cardName: 'Card' }
    }));

    vi.mocked(prisma.userCard.findMany).mockResolvedValue(mockCards as any);

    const mockTx = {
      userCard: {
        update: vi.fn().mockResolvedValue({})
      }
    };

    vi.mocked(prisma.$transaction).mockImplementation((cb) => cb(mockTx as any));

    const result = await cardActions.bulkUpdateCards(cardIds, {
      status: 'ARCHIVED' as any
    });

    assertSuccess(result);
    expect(result.data.updated).toBe(3);
  });
});
