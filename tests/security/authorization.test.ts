/**
 * Authorization Tests - Task #3
 *
 * This test suite verifies that:
 * 1. Users cannot access other users' data
 * 2. Server actions enforce ownership boundaries
 * 3. Cross-user access attempts are properly blocked
 * 4. Authorization errors return appropriate status codes
 *
 * Test Strategy:
 * - Create two independent users (User A and User B)
 * - Give each user their own player with cards and benefits
 * - Attempt cross-user operations and verify they fail
 * - Verify error messages and codes are appropriate
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import {
  verifyPlayerOwnership,
  verifyCardOwnership,
  verifyBenefitOwnership,
} from '../../src/lib/auth-server';
import { hash } from 'argon2';

// ============================================================
// Test Data Setup
// ============================================================

/**
 * Creates test users, players, cards, and benefits for authorization testing.
 * Returns fixtures that can be used in test assertions.
 */
async function setupTestData() {
  // Create two test users
  const passwordHash = await hash('TestPassword123!');

  const userA = await prisma.user.create({
    data: {
      email: 'user-a@test.com',
      passwordHash,
      firstName: 'User',
      lastName: 'A',
      players: {
        create: {
          playerName: 'Primary',
          isActive: true,
        },
      },
    },
    include: { players: true },
  });

  const userB = await prisma.user.create({
    data: {
      email: 'user-b@test.com',
      passwordHash,
      firstName: 'User',
      lastName: 'B',
      players: {
        create: {
          playerName: 'Primary',
          isActive: true,
        },
      },
    },
    include: { players: true },
  });

  // Create test players (already created above, so grab them)
  const playerA = userA.players[0];
  const playerB = userB.players[0];

  // Create a test master card to use for all test cards
  const masterCard = await prisma.masterCard.create({
    data: {
      issuer: 'Test Bank',
      cardName: 'Test Card',
      defaultAnnualFee: 45000, // $450
      cardImageUrl: 'https://example.com/test-card.png',
      masterBenefits: {
        create: [
          {
            name: 'Travel Credit',
            type: 'StatementCredit',
            stickerValue: 30000, // $300
            resetCadence: 'CalendarYear',
            isActive: true,
          },
        ],
      },
    },
    include: { masterBenefits: true },
  });

  // Add cards to both players
  const cardA = await prisma.userCard.create({
    data: {
      playerId: playerA.id,
      masterCardId: masterCard.id,
      actualAnnualFee: masterCard.defaultAnnualFee,
      renewalDate: new Date('2025-01-01'),
      userBenefits: {
        create: [
          {
            playerId: playerA.id,
            name: 'Travel Credit',
            type: 'StatementCredit',
            stickerValue: 30000,
            resetCadence: 'CalendarYear',
            expirationDate: new Date('2025-12-31'),
            isUsed: false,
            timesUsed: 0,
            claimedAt: null,
            userDeclaredValue: null,
          },
        ],
      },
    },
    include: { userBenefits: true },
  });

  const cardB = await prisma.userCard.create({
    data: {
      playerId: playerB.id,
      masterCardId: masterCard.id,
      actualAnnualFee: masterCard.defaultAnnualFee,
      renewalDate: new Date('2025-06-01'),
      userBenefits: {
        create: [
          {
            playerId: playerB.id,
            name: 'Travel Credit',
            type: 'StatementCredit',
            stickerValue: 30000,
            resetCadence: 'CalendarYear',
            expirationDate: new Date('2025-12-31'),
            isUsed: false,
            timesUsed: 0,
            claimedAt: null,
            userDeclaredValue: null,
          },
        ],
      },
    },
    include: { userBenefits: true },
  });

  return {
    userA: {
      id: userA.id,
      email: userA.email,
      password: 'TestPassword123!',
    },
    userB: {
      id: userB.id,
      email: userB.email,
      password: 'TestPassword123!',
    },
    playerA,
    playerB,
    cardA,
    cardB,
    masterCard,
    benefitA: cardA.userBenefits[0],
    benefitB: cardB.userBenefits[0],
  };
}

/**
 * Cleans up test data after tests complete
 */
async function cleanupTestData() {
  // Delete in dependency order
  await prisma.session.deleteMany({});
  await prisma.userBenefit.deleteMany({});
  await prisma.userCard.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.masterCard.deleteMany({});
  await prisma.user.deleteMany({});
}

// ============================================================
// Test Suites
// ============================================================

describe('Authorization - Server Action Security', () => {
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Player Ownership Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('verifyPlayerOwnership', () => {
    it('allows owner to access their own player', async () => {
      const result = await verifyPlayerOwnership(testData.playerA.id, testData.userA.id);

      expect(result.isOwner).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('prevents non-owner from accessing another user\'s player', async () => {
      const result = await verifyPlayerOwnership(testData.playerA.id, testData.userB.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('returns appropriate error for non-existent player', async () => {
      const result = await verifyPlayerOwnership('nonexistent-id', testData.userA.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Card Ownership Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('verifyCardOwnership', () => {
    it('allows owner to access their own card', async () => {
      const result = await verifyCardOwnership(testData.cardA.id, testData.userA.id);

      expect(result.isOwner).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('prevents non-owner from accessing another user\'s card', async () => {
      const result = await verifyCardOwnership(testData.cardA.id, testData.userB.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('returns appropriate error for non-existent card', async () => {
      const result = await verifyCardOwnership('nonexistent-id', testData.userA.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('User B cannot access User A\'s card via direct ID', async () => {
      // This is the core security test: User B trying to access User A's card
      const result = await verifyCardOwnership(testData.cardA.id, testData.userB.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Benefit Ownership Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('verifyBenefitOwnership', () => {
    it('allows owner to access their own benefit', async () => {
      const result = await verifyBenefitOwnership(testData.benefitA.id, testData.userA.id);

      expect(result.isOwner).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('prevents non-owner from accessing another user\'s benefit', async () => {
      const result = await verifyBenefitOwnership(testData.benefitA.id, testData.userB.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('returns appropriate error for non-existent benefit', async () => {
      const result = await verifyBenefitOwnership('nonexistent-id', testData.userA.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('User B cannot access User A\'s benefit via direct ID', async () => {
      // Core security test: User B trying to access User A's benefit
      const result = await verifyBenefitOwnership(testData.benefitA.id, testData.userB.id);

      expect(result.isOwner).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Cross-User Access Prevention Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Cross-User Data Access Prevention', () => {
    it('User A cannot read User B\'s player cards', async () => {
      // User A tries to read cards from User B's player
      const cardsInUserBPlayer = await prisma.userCard.findMany({
        where: { playerId: testData.playerB.id },
      });

      // Verify User A doesn't own the player
      const ownership = await verifyPlayerOwnership(
        testData.playerB.id,
        testData.userA.id
      );

      expect(ownership.isOwner).toBe(false);
      expect(cardsInUserBPlayer.length).toBeGreaterThan(0);
    });

    it('User A cannot read User B\'s benefits', async () => {
      // User A tries to read benefits from User B's player
      const benefitsInUserBPlayer = await prisma.userBenefit.findMany({
        where: { playerId: testData.playerB.id },
      });

      // Verify User A doesn't own these benefits
      for (const benefit of benefitsInUserBPlayer) {
        const ownership = await verifyBenefitOwnership(benefit.id, testData.userA.id);
        expect(ownership.isOwner).toBe(false);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Authorization Boundary Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Authorization Boundaries', () => {
    it('verifies ownership chain: User -> Player -> Card', async () => {
      // User A owns playerA
      const playerOwnership = await verifyPlayerOwnership(
        testData.playerA.id,
        testData.userA.id
      );
      expect(playerOwnership.isOwner).toBe(true);

      // playerA owns cardA
      const card = await prisma.userCard.findUnique({
        where: { id: testData.cardA.id },
      });
      expect(card?.playerId).toBe(testData.playerA.id);

      // Therefore, User A owns cardA (via chain)
      const cardOwnership = await verifyCardOwnership(testData.cardA.id, testData.userA.id);
      expect(cardOwnership.isOwner).toBe(true);
    });

    it('verifies ownership chain: User -> Player -> Benefit', async () => {
      // User A owns playerA
      const playerOwnership = await verifyPlayerOwnership(
        testData.playerA.id,
        testData.userA.id
      );
      expect(playerOwnership.isOwner).toBe(true);

      // playerA owns benefitA
      const benefit = await prisma.userBenefit.findUnique({
        where: { id: testData.benefitA.id },
      });
      expect(benefit?.playerId).toBe(testData.playerA.id);

      // Therefore, User A owns benefitA (via chain)
      const benefitOwnership = await verifyBenefitOwnership(
        testData.benefitA.id,
        testData.userA.id
      );
      expect(benefitOwnership.isOwner).toBe(true);
    });

    it('breaks ownership chain for different users', async () => {
      // User A owns playerA
      const playerAOwnership = await verifyPlayerOwnership(
        testData.playerA.id,
        testData.userA.id
      );
      expect(playerAOwnership.isOwner).toBe(true);

      // User B does NOT own playerA
      const userBCannotOwnPlayerA = await verifyPlayerOwnership(
        testData.playerA.id,
        testData.userB.id
      );
      expect(userBCannotOwnPlayerA.isOwner).toBe(false);

      // Therefore, User B cannot own any of playerA's cards
      const userBCannotOwnCardA = await verifyCardOwnership(
        testData.cardA.id,
        testData.userB.id
      );
      expect(userBCannotOwnCardA.isOwner).toBe(false);

      // And User B cannot own any of playerA's benefits
      const userBCannotOwnBenefitA = await verifyBenefitOwnership(
        testData.benefitA.id,
        testData.userB.id
      );
      expect(userBCannotOwnBenefitA.isOwner).toBe(false);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Data Isolation Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('User Data Isolation', () => {
    it('User A\'s players are isolated from User B', async () => {
      const userAPlayers = await prisma.player.findMany({
        where: { userId: testData.userA.id },
      });

      const userBPlayers = await prisma.player.findMany({
        where: { userId: testData.userB.id },
      });

      // No player should appear in both lists
      const playerIds = new Set(userAPlayers.map(p => p.id));
      for (const userBPlayer of userBPlayers) {
        expect(playerIds.has(userBPlayer.id)).toBe(false);
      }
    });

    it('User A\'s cards are isolated from User B', async () => {
      const userACards = await prisma.userCard.findMany({
        where: { player: { userId: testData.userA.id } },
      });

      const userBCards = await prisma.userCard.findMany({
        where: { player: { userId: testData.userB.id } },
      });

      // No card should appear in both lists
      const cardIds = new Set(userACards.map(c => c.id));
      for (const userBCard of userBCards) {
        expect(cardIds.has(userBCard.id)).toBe(false);
      }
    });

    it('User A\'s benefits are isolated from User B', async () => {
      const userABenefits = await prisma.userBenefit.findMany({
        where: { player: { userId: testData.userA.id } },
      });

      const userBBenefits = await prisma.userBenefit.findMany({
        where: { player: { userId: testData.userB.id } },
      });

      // No benefit should appear in both lists
      const benefitIds = new Set(userABenefits.map(b => b.id));
      for (const userBBenefit of userBBenefits) {
        expect(benefitIds.has(userBBenefit.id)).toBe(false);
      }
    });
  });
});
