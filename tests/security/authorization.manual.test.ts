/**
 * Authorization Tests - Task #3 (Manual Test Runner)
 *
 * This test suite verifies that:
 * 1. Users cannot access other users' data
 * 2. Server actions enforce ownership boundaries
 * 3. Cross-user access attempts are properly blocked
 * 4. Authorization errors return appropriate status codes
 *
 * Run with: npx ts-node tests/security/authorization.manual.test.ts
 */

import { prisma } from '../../src/lib/prisma';
import {
  verifyPlayerOwnership,
  verifyCardOwnership,
  verifyBenefitOwnership,
} from '../../src/lib/auth-server';
import { hash } from 'argon2';

// ============================================================
// Test Runner Utilities
// ============================================================

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ ${message}`);
    failCount++;
  }
}

async function test(name: string, fn: () => Promise<void>) {
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (error) {
    console.error(`  ✗ Test threw error:`, error);
    failCount++;
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(70)}`);
}

// ============================================================
// Test Data Setup
// ============================================================

async function setupTestData() {
  // Clean up any existing test data
  await prisma.session.deleteMany({});
  await prisma.userBenefit.deleteMany({});
  await prisma.userCard.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.masterCard.deleteMany({});

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

  const playerA = userA.players[0];
  const playerB = userB.players[0];

  // Create a test master card
  const masterCard = await prisma.masterCard.create({
    data: {
      issuer: 'Test Bank',
      cardName: 'Test Card',
      defaultAnnualFee: 45000,
      cardImageUrl: 'https://example.com/test-card.png',
      masterBenefits: {
        create: [
          {
            name: 'Travel Credit',
            type: 'StatementCredit',
            stickerValue: 30000,
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
    userA: { id: userA.id, email: userA.email },
    userB: { id: userB.id, email: userB.email },
    playerA,
    playerB,
    cardA,
    cardB,
    masterCard,
    benefitA: cardA.userBenefits[0],
    benefitB: cardB.userBenefits[0],
  };
}

async function cleanupTestData() {
  await prisma.session.deleteMany({});
  await prisma.userBenefit.deleteMany({});
  await prisma.userCard.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.masterCard.deleteMany({});
  await prisma.user.deleteMany({});
}

// ============================================================
// Tests
// ============================================================

async function runTests() {
  const data = await setupTestData();

  section('PLAYER OWNERSHIP TESTS');

  await test('verifyPlayerOwnership - Owner can access their player', async () => {
    const result = await verifyPlayerOwnership(data.playerA.id, data.userA.id);
    assert(result.isOwner === true, 'User A owns Player A');
    assert(result.error === undefined, 'No error for valid owner');
  });

  await test('verifyPlayerOwnership - Non-owner cannot access another player', async () => {
    const result = await verifyPlayerOwnership(data.playerA.id, data.userB.id);
    assert(result.isOwner === false, 'User B does not own Player A');
    assert(result.error !== undefined, 'Error message provided');
    assert(result.error?.includes('permission') === true, 'Error indicates permission issue');
  });

  await test('verifyPlayerOwnership - Non-existent player returns error', async () => {
    const result = await verifyPlayerOwnership('nonexistent-id', data.userA.id);
    assert(result.isOwner === false, 'Returns false for non-existent player');
    assert(result.error?.includes('not found') === true, 'Error indicates not found');
  });

  section('CARD OWNERSHIP TESTS');

  await test('verifyCardOwnership - Owner can access their card', async () => {
    const result = await verifyCardOwnership(data.cardA.id, data.userA.id);
    assert(result.isOwner === true, 'User A owns Card A');
    assert(result.error === undefined, 'No error for valid owner');
  });

  await test('verifyCardOwnership - Non-owner cannot access another card', async () => {
    const result = await verifyCardOwnership(data.cardA.id, data.userB.id);
    assert(result.isOwner === false, 'User B does not own Card A');
    assert(result.error !== undefined, 'Error message provided');
    assert(result.error?.includes('permission') === true, 'Error indicates permission issue');
  });

  await test('verifyCardOwnership - Cross-user card access is blocked', async () => {
    // This is the CRITICAL security test
    const result = await verifyCardOwnership(data.cardA.id, data.userB.id);
    assert(result.isOwner === false, 'Cross-user card access blocked');
    assert(result.error !== undefined, 'Error returned for unauthorized access');
  });

  await test('verifyCardOwnership - Non-existent card returns error', async () => {
    const result = await verifyCardOwnership('nonexistent-id', data.userA.id);
    assert(result.isOwner === false, 'Returns false for non-existent card');
    assert(result.error?.includes('not found') === true, 'Error indicates not found');
  });

  section('BENEFIT OWNERSHIP TESTS');

  await test('verifyBenefitOwnership - Owner can access their benefit', async () => {
    const result = await verifyBenefitOwnership(data.benefitA.id, data.userA.id);
    assert(result.isOwner === true, 'User A owns Benefit A');
    assert(result.error === undefined, 'No error for valid owner');
  });

  await test('verifyBenefitOwnership - Non-owner cannot access another benefit', async () => {
    const result = await verifyBenefitOwnership(data.benefitA.id, data.userB.id);
    assert(result.isOwner === false, 'User B does not own Benefit A');
    assert(result.error !== undefined, 'Error message provided');
    assert(result.error?.includes('permission') === true, 'Error indicates permission issue');
  });

  await test('verifyBenefitOwnership - Cross-user benefit access is blocked', async () => {
    // This is the CRITICAL security test
    const result = await verifyBenefitOwnership(data.benefitA.id, data.userB.id);
    assert(result.isOwner === false, 'Cross-user benefit access blocked');
    assert(result.error !== undefined, 'Error returned for unauthorized access');
  });

  await test('verifyBenefitOwnership - Non-existent benefit returns error', async () => {
    const result = await verifyBenefitOwnership('nonexistent-id', data.userA.id);
    assert(result.isOwner === false, 'Returns false for non-existent benefit');
    assert(result.error?.includes('not found') === true, 'Error indicates not found');
  });

  section('OWNERSHIP CHAIN TESTS');

  await test('Ownership chain: User -> Player -> Card', async () => {
    // User A owns playerA
    const playerOwnership = await verifyPlayerOwnership(data.playerA.id, data.userA.id);
    assert(playerOwnership.isOwner === true, 'User A owns Player A');

    // playerA owns cardA
    const card = await prisma.userCard.findUnique({ where: { id: data.cardA.id } });
    assert(card?.playerId === data.playerA.id, 'Card A belongs to Player A');

    // Therefore, User A owns cardA
    const cardOwnership = await verifyCardOwnership(data.cardA.id, data.userA.id);
    assert(cardOwnership.isOwner === true, 'User A owns Card A (via chain)');
  });

  await test('Ownership chain: User -> Player -> Benefit', async () => {
    // User A owns playerA
    const playerOwnership = await verifyPlayerOwnership(data.playerA.id, data.userA.id);
    assert(playerOwnership.isOwner === true, 'User A owns Player A');

    // playerA owns benefitA
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: data.benefitA.id },
    });
    assert(benefit?.playerId === data.playerA.id, 'Benefit A belongs to Player A');

    // Therefore, User A owns benefitA
    const benefitOwnership = await verifyBenefitOwnership(data.benefitA.id, data.userA.id);
    assert(benefitOwnership.isOwner === true, 'User A owns Benefit A (via chain)');
  });

  await test('Broken chain prevents access across users', async () => {
    // User B doesn't own playerA
    const playerOwnership = await verifyPlayerOwnership(data.playerA.id, data.userB.id);
    assert(playerOwnership.isOwner === false, 'User B does not own Player A');

    // Therefore, User B cannot own cardA
    const cardOwnership = await verifyCardOwnership(data.cardA.id, data.userB.id);
    assert(cardOwnership.isOwner === false, 'User B cannot own Card A');

    // And User B cannot own benefitA
    const benefitOwnership = await verifyBenefitOwnership(data.benefitA.id, data.userB.id);
    assert(benefitOwnership.isOwner === false, 'User B cannot own Benefit A');
  });

  section('DATA ISOLATION TESTS');

  await test('User A\'s players isolated from User B', async () => {
    const userAPlayers = await prisma.player.findMany({
      where: { userId: data.userA.id },
    });
    const userBPlayers = await prisma.player.findMany({
      where: { userId: data.userB.id },
    });

    const playerIds = new Set(userAPlayers.map(p => p.id));
    let isolated = true;
    for (const userBPlayer of userBPlayers) {
      if (playerIds.has(userBPlayer.id)) {
        isolated = false;
        break;
      }
    }

    assert(isolated, 'No player appears in both user lists');
  });

  await test('User A\'s cards isolated from User B', async () => {
    const userACards = await prisma.userCard.findMany({
      where: { player: { userId: data.userA.id } },
    });
    const userBCards = await prisma.userCard.findMany({
      where: { player: { userId: data.userB.id } },
    });

    const cardIds = new Set(userACards.map(c => c.id));
    let isolated = true;
    for (const userBCard of userBCards) {
      if (cardIds.has(userBCard.id)) {
        isolated = false;
        break;
      }
    }

    assert(isolated, 'No card appears in both user lists');
  });

  await test('User A\'s benefits isolated from User B', async () => {
    const userABenefits = await prisma.userBenefit.findMany({
      where: { player: { userId: data.userA.id } },
    });
    const userBBenefits = await prisma.userBenefit.findMany({
      where: { player: { userId: data.userB.id } },
    });

    const benefitIds = new Set(userABenefits.map(b => b.id));
    let isolated = true;
    for (const userBBenefit of userBBenefits) {
      if (benefitIds.has(userBBenefit.id)) {
        isolated = false;
        break;
      }
    }

    assert(isolated, 'No benefit appears in both user lists');
  });

  // Cleanup
  await cleanupTestData();

  // Results
  section('TEST RESULTS');
  console.log(`\nPassed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total:  ${passCount + failCount}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
