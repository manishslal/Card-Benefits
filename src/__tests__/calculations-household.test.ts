/**
 * Unit tests for household-level calculation functions
 * Tests: getHouseholdROI, getHouseholdTotalCaptured, getHouseholdActiveCount
 */

import {
  getHouseholdROI,
  getHouseholdTotalCaptured,
  getHouseholdActiveCount,
  MS_PER_DAY,
} from '../lib/calculations';
import type {
  Player,
  UserCard,
  UserBenefit,
} from '../lib/calculations';

// ---------------------------------------------------------------------------
// Mock Builders
// ---------------------------------------------------------------------------

/**
 * Create a mock UserBenefit for testing
 */
function createMockBenefit(
  overrides: Partial<UserBenefit> = {},
): UserBenefit {
  const now = new Date();
  return {
    id: `benefit-${Math.random()}`,
    userCardId: 'card-1',
    playerId: 'player-1',
    name: 'Test Benefit',
    type: 'StatementCredit',
    stickerValue: 10000, // $100
    userDeclaredValue: null,
    resetCadence: 'CardmemberYear',
    isUsed: false,
    timesUsed: 0,
    expirationDate: new Date(now.getTime() + 90 * MS_PER_DAY), // 90 days from now
    createdAt: now,
    updatedAt: now,
    claimedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock UserCard for testing
 */
function createMockCard(
  overrides: Partial<UserCard> = {},
  benefits: UserBenefit[] = [],
): UserCard & { userBenefits: UserBenefit[] } {
  const now = new Date();
  return {
    id: `card-${Math.random()}`,
    playerId: 'player-1',
    masterCardId: 'master-1',
    customName: null,
    actualAnnualFee: 50000, // $500
    renewalDate: new Date(now.getTime() + 365 * MS_PER_DAY),
    isOpen: true,
    createdAt: now,
    updatedAt: now,
    // Required field for calculations to work correctly
    masterCard: {
      id: 'master-1',
      issuer: 'Chase',
      cardName: 'Test Card',
      defaultAnnualFee: 50000,
      cardImageUrl: '/images/test-card.png',
    },
    userBenefits: benefits,
    ...overrides,
  };
}

/**
 * Create a mock Player for testing
 */
function createMockPlayer(
  overrides: Partial<Player> = {},
  cards: (UserCard & { userBenefits: UserBenefit[] })[] = [],
): Player & { userCards: (UserCard & { userBenefits: UserBenefit[] })[] } {
  return {
    id: `player-${Math.random()}`,
    userId: 'user-1',
    playerName: 'Primary',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    userCards: cards,
    ...overrides,
  } as Player & { userCards: (UserCard & { userBenefits: UserBenefit[] })[] };
}

// ---------------------------------------------------------------------------
// Tests: getHouseholdROI
// ---------------------------------------------------------------------------

describe('getHouseholdROI', () => {
  it('should return 0 for empty player array', () => {
    expect(getHouseholdROI([])).toBe(0);
  });

  it('should return 0 for null/undefined input', () => {
    expect(getHouseholdROI(null as any)).toBe(0);
    expect(getHouseholdROI(undefined as any)).toBe(0);
  });

  it('should calculate ROI for single player with one card', () => {
    // Create a benefit: $100 sticker, used (so extracted value = $100)
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit = createMockBenefit({
      stickerValue: 10000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });

    // Card with $500 annual fee
    const card = createMockCard(
      {
        actualAnnualFee: 50000,
      },
      [benefit],
    );

    const player = createMockPlayer({}, [card]);

    // ROI = $100 (extracted) - $500 (fee) = -$400
    expect(getHouseholdROI([player])).toBe(-40000);
  });

  it('should sum ROI across multiple cards in one player', () => {
    // Card 1: $100 benefit, $500 fee
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit1 = createMockBenefit({
      stickerValue: 10000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card1 = createMockCard(
      { actualAnnualFee: 50000 },
      [benefit1],
    );

    // Card 2: $200 benefit, $95 fee
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit2 = createMockBenefit({
      stickerValue: 20000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card2 = createMockCard(
      { actualAnnualFee: 9500 },
      [benefit2],
    );

    const player = createMockPlayer({}, [card1, card2]);

    // ROI = ($100 + $200) - ($500 + $95) = $300 - $595 = -$295
    expect(getHouseholdROI([player])).toBe(-29500);
  });

  it('should sum ROI across multiple players', () => {
    // Player 1: $100 benefit, $500 fee = -$400
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit1 = createMockBenefit({
      stickerValue: 10000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card1 = createMockCard(
      { actualAnnualFee: 50000 },
      [benefit1],
    );
    const player1 = createMockPlayer({}, [card1]);

    // Player 2: $200 benefit, $0 fee = +$200
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit2 = createMockBenefit({
      stickerValue: 20000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card2 = createMockCard(
      { actualAnnualFee: 0 },
      [benefit2],
    );
    const player2 = createMockPlayer({}, [card2]);

    // Total ROI = -$400 + $200 = -$200
    expect(getHouseholdROI([player1, player2])).toBe(-20000);
  });

  it('should handle positive ROI correctly', () => {
    // Benefit worth $1000, fee is $100
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit = createMockBenefit({
      stickerValue: 100000,
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card = createMockCard(
      { actualAnnualFee: 10000 },
      [benefit],
    );
    const player = createMockPlayer({}, [card]);

    // ROI = $1000 - $100 = $900
    expect(getHouseholdROI([player])).toBe(90000);
  });

  it('should ignore unused benefits in ROI calculation', () => {
    // Unused benefit should not contribute to extracted value
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee even if unused
    const benefit = createMockBenefit({
      stickerValue: 10000,
      isUsed: false,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card = createMockCard(
      { actualAnnualFee: 5000 },
      [benefit],
    );
    const player = createMockPlayer({}, [card]);

    // ROI = $0 (unused) - $50 (fee) = -$50
    expect(getHouseholdROI([player])).toBe(-5000);
  });

  it('should respect user-declared values in ROI', () => {
    // Benefit with sticker $100, user claims $150
    // NOTE: resetCadence set to 'Purchase' so it doesn't offset the annual fee
    const benefit = createMockBenefit({
      stickerValue: 10000,
      userDeclaredValue: 15000, // User declared $150
      isUsed: true,
      resetCadence: 'Purchase', // Not a fee-offset credit
    });
    const card = createMockCard(
      { actualAnnualFee: 5000 },
      [benefit],
    );
    const player = createMockPlayer({}, [card]);

    // ROI = $150 (declared) - $50 (fee) = $100
    expect(getHouseholdROI([player])).toBe(10000);
  });

  it('should handle players with null userCards array', () => {
    const player = createMockPlayer({}, []);
    player.userCards = null as any;

    expect(getHouseholdROI([player])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: getHouseholdTotalCaptured
// ---------------------------------------------------------------------------

describe('getHouseholdTotalCaptured', () => {
  it('should return 0 for empty player array', () => {
    expect(getHouseholdTotalCaptured([])).toBe(0);
  });

  it('should return 0 for null/undefined input', () => {
    expect(getHouseholdTotalCaptured(null as any)).toBe(0);
    expect(getHouseholdTotalCaptured(undefined as any)).toBe(0);
  });

  it('should sum only used benefits across all players', () => {
    // Benefit 1: $100, used
    const benefit1 = createMockBenefit({
      stickerValue: 10000,
      isUsed: true,
    });

    // Benefit 2: $50, unused
    const benefit2 = createMockBenefit({
      stickerValue: 5000,
      isUsed: false,
    });

    // Benefit 3: $200, used
    const benefit3 = createMockBenefit({
      stickerValue: 20000,
      isUsed: true,
    });

    const card1 = createMockCard({}, [benefit1, benefit2]);
    const card2 = createMockCard({}, [benefit3]);

    const player = createMockPlayer({}, [card1, card2]);

    // Total captured = $100 + $200 = $300 (ignore unused $50)
    expect(getHouseholdTotalCaptured([player])).toBe(30000);
  });

  it('should count usage perks by timesUsed', () => {
    // UsagePerk worth $10 each, used 5 times
    const benefit = createMockBenefit({
      type: 'UsagePerk',
      stickerValue: 1000, // $10 per use
      isUsed: true,
      timesUsed: 5,
    });

    const card = createMockCard({}, [benefit]);
    const player = createMockPlayer({}, [card]);

    // Captured = $10 * 5 = $50
    expect(getHouseholdTotalCaptured([player])).toBe(5000);
  });

  it('should respect user-declared values in captured calculation', () => {
    // StatementCredit: sticker $100, user claims $150, marked as used
    const benefit = createMockBenefit({
      type: 'StatementCredit',
      stickerValue: 10000,
      userDeclaredValue: 15000,
      isUsed: true,
    });

    const card = createMockCard({}, [benefit]);
    const player = createMockPlayer({}, [card]);

    // Captured = $150 (user-declared value)
    expect(getHouseholdTotalCaptured([player])).toBe(15000);
  });

  it('should sum captured across multiple players', () => {
    // Player 1: $100 captured
    const benefit1 = createMockBenefit({
      stickerValue: 10000,
      isUsed: true,
    });
    const card1 = createMockCard({}, [benefit1]);
    const player1 = createMockPlayer({}, [card1]);

    // Player 2: $200 captured
    const benefit2 = createMockBenefit({
      stickerValue: 20000,
      isUsed: true,
    });
    const card2 = createMockCard({}, [benefit2]);
    const player2 = createMockPlayer({}, [card2]);

    // Total = $100 + $200 = $300
    expect(getHouseholdTotalCaptured([player1, player2])).toBe(30000);
  });

  it('should handle empty benefit arrays', () => {
    const card = createMockCard({}, []);
    const player = createMockPlayer({}, [card]);

    expect(getHouseholdTotalCaptured([player])).toBe(0);
  });

  it('should handle players with null userCards', () => {
    const player = createMockPlayer({}, []);
    player.userCards = null as any;

    expect(getHouseholdTotalCaptured([player])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: getHouseholdActiveCount
// ---------------------------------------------------------------------------

describe('getHouseholdActiveCount', () => {
  it('should return 0 for empty player array', () => {
    expect(getHouseholdActiveCount([])).toBe(0);
  });

  it('should return 0 for null/undefined input', () => {
    expect(getHouseholdActiveCount(null as any)).toBe(0);
    expect(getHouseholdActiveCount(undefined as any)).toBe(0);
  });

  it('should count unused benefits that are not yet expired', () => {
    const now = new Date();

    // Benefit 1: unused, expires in 30 days
    const benefit1 = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    // Benefit 2: unused, expires in 60 days
    const benefit2 = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() + 60 * MS_PER_DAY),
    });

    const card = createMockCard({}, [benefit1, benefit2]);
    const player = createMockPlayer({}, [card]);

    expect(getHouseholdActiveCount([player])).toBe(2);
  });

  it('should include perpetual benefits (null expirationDate)', () => {
    // Perpetual benefit like lounge access
    const perpetualBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: null,
    });

    // Regular benefit that expires
    const expiringBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(new Date().getTime() + 30 * MS_PER_DAY),
    });

    const card = createMockCard({}, [perpetualBenefit, expiringBenefit]);
    const player = createMockPlayer({}, [card]);

    // Should count both perpetual AND expiring
    expect(getHouseholdActiveCount([player])).toBe(2);
  });

  it('should exclude used benefits', () => {
    const now = new Date();

    // Unused benefit
    const unusedBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    // Used benefit (should be excluded)
    const usedBenefit = createMockBenefit({
      isUsed: true,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    const card = createMockCard({}, [unusedBenefit, usedBenefit]);
    const player = createMockPlayer({}, [card]);

    // Should only count the unused benefit
    expect(getHouseholdActiveCount([player])).toBe(1);
  });

  it('should exclude expired benefits', () => {
    const now = new Date();

    // Unused but already expired
    const expiredBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() - 1 * MS_PER_DAY), // 1 day ago
    });

    // Unused and not yet expired
    const activeBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    const card = createMockCard({}, [expiredBenefit, activeBenefit]);
    const player = createMockPlayer({}, [card]);

    // Should only count the not-yet-expired benefit
    expect(getHouseholdActiveCount([player])).toBe(1);
  });

  it('should count unique benefit IDs across multiple players', () => {
    const benefit1 = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: null,
    });

    const benefit2 = createMockBenefit({
      id: 'b2',
      isUsed: false,
      expirationDate: null,
    });

    const card1 = createMockCard({}, [benefit1]);
    const card2 = createMockCard({}, [benefit2]);

    const player1 = createMockPlayer({}, [card1]);
    const player2 = createMockPlayer({}, [card2]);

    // Should count 2 unique benefits across both players
    expect(getHouseholdActiveCount([player1, player2])).toBe(2);
  });

  it('should not double-count if multiple players have the same benefit ID', () => {
    const benefit = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: null,
    });

    const card1 = createMockCard({}, [{ ...benefit, id: 'b1' }]);
    const card2 = createMockCard({}, [{ ...benefit, id: 'b1' }]);

    const player1 = createMockPlayer({}, [card1]);
    const player2 = createMockPlayer({}, [card2]);

    // Should count only 1 unique benefit ID, not 2
    expect(getHouseholdActiveCount([player1, player2])).toBe(1);
  });

  it('should handle multiple cards per player', () => {
    const now = new Date();

    // Card 1: 2 active benefits
    const benefit1 = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });
    const benefit2 = createMockBenefit({
      id: 'b2',
      isUsed: false,
      expirationDate: null,
    });
    const card1 = createMockCard({}, [benefit1, benefit2]);

    // Card 2: 1 active benefit
    const benefit3 = createMockBenefit({
      id: 'b3',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 60 * MS_PER_DAY),
    });
    const card2 = createMockCard({}, [benefit3]);

    const player = createMockPlayer({}, [card1, card2]);

    // Should count 3 unique benefits
    expect(getHouseholdActiveCount([player])).toBe(3);
  });

  it('should handle players with null userCards', () => {
    const player = createMockPlayer({}, []);
    player.userCards = null as any;

    expect(getHouseholdActiveCount([player])).toBe(0);
  });

  it('should handle cards with null userBenefits', () => {
    const card = createMockCard({}, []);
    card.userBenefits = null as any;

    const player = createMockPlayer({}, [card]);

    expect(getHouseholdActiveCount([player])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Household functions - Integration', () => {
  it('should correctly aggregate metrics for a realistic household scenario', () => {
    const now = new Date();

    // === Player 1: Primary cardholder ===
    // Card 1: CSR (Chase Sapphire Reserve)
    // NOTE: resetCadence set to 'Purchase' so the $300 benefit doesn't offset the fee
    const csr_benefit1 = createMockBenefit({
      id: 'csr-300-credit',
      name: '$300 Travel Credit',
      stickerValue: 30000,
      isUsed: true,
      type: 'StatementCredit',
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });
    const csr_benefit2 = createMockBenefit({
      id: 'csr-lounge',
      name: 'Lounge Access',
      stickerValue: 0,
      isUsed: false,
      expirationDate: null, // Perpetual
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });
    const csr_card = createMockCard(
      { actualAnnualFee: 55000 }, // $550
      [csr_benefit1, csr_benefit2],
    );

    // Card 2: Freedom Flex
    const freedom_benefit = createMockBenefit({
      id: 'freedom-cashback',
      name: '5x Groceries',
      stickerValue: 10000, // $100
      isUsed: false,
      expirationDate: new Date(now.getTime() + 120 * MS_PER_DAY),
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });
    const freedom_card = createMockCard(
      { actualAnnualFee: 0 }, // No fee
      [freedom_benefit],
    );

    const player1 = createMockPlayer(
      { playerName: 'Primary' },
      [csr_card, freedom_card],
    );

    // === Player 2: Spouse ===
    // Card: Amex Platinum (authorized user)
    const amex_benefit = createMockBenefit({
      id: 'amex-centurion-lounge',
      name: 'Centurion Lounge',
      stickerValue: 0,
      isUsed: false,
      expirationDate: null, // Perpetual
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });
    const amex_card = createMockCard(
      { actualAnnualFee: 50000 }, // $500
      [amex_benefit],
    );

    const player2 = createMockPlayer(
      { playerName: 'Spouse' },
      [amex_card],
    );

    const players = [player1, player2];

    // === Assertions ===

    // Total Captured: $300 (CSR credit, used)
    expect(getHouseholdTotalCaptured(players)).toBe(30000);

    // Active Count: 3 perpetual + 1 unused (Freedom) = 3 unique
    // CSR Lounge (perpetual), Freedom Cashback (expires in 120d), Amex Lounge (perpetual)
    expect(getHouseholdActiveCount(players)).toBe(3);

    // ROI = $300 (captured) - ($550 + $500) (fees) = -$750
    expect(getHouseholdROI(players)).toBe(-75000);
  });

  it('should handle edge case: all benefits perpetual, no fees', () => {
    // Build a card with perpetual benefits and no fees
    // NOTE: resetCadence set to 'Purchase' so benefits don't offset fees
    const benefit1 = createMockBenefit({
      id: 'lounge1',
      isUsed: false,
      expirationDate: null,
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });
    const benefit2 = createMockBenefit({
      id: 'lounge2',
      isUsed: false,
      expirationDate: null,
      resetCadence: 'Purchase', // Not a CardmemberYear fee-offset
    });

    const card = createMockCard(
      { actualAnnualFee: 0 },
      [benefit1, benefit2],
    );

    const player = createMockPlayer({}, [card]);

    expect(getHouseholdTotalCaptured([player])).toBe(0); // No used benefits
    expect(getHouseholdActiveCount([player])).toBe(2); // 2 perpetual benefits
    expect(getHouseholdROI([player])).toBe(0); // 0 captured - 0 fees
  });
});
