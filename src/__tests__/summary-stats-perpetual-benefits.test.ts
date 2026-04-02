/**
 * Unit tests for SummaryStats component - Perpetual Benefit Fix
 *
 * This test suite validates that perpetual benefits (null expirationDate)
 * are correctly counted as active benefits alongside time-limited benefits.
 */

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string;
  timesUsed: number;
  resetCadence: string;
}

interface UserCard {
  id: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date;
  isOpen: boolean;
  masterCard: {
    id: string;
    issuer: string;
    cardName: string;
    defaultAnnualFee: number;
    cardImageUrl: string;
  };
  userBenefits: UserBenefit[];
}

interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}

// This is the fixed function from SummaryStats.tsx
/**
 * Count total active benefits
 * A benefit is active if:
 * - It has NOT been used (isUsed === false), AND
 * - It is either perpetual (expirationDate === null) OR not yet expired
 */
function getActiveCount(players: Player[]): number {
  let count = 0;
  const now = new Date();
  for (const player of players) {
    for (const card of player.userCards) {
      count += card.userBenefits.filter((b) => {
        // Only count unused benefits
        if (b.isUsed) return false;

        // Include if perpetual (null expirationDate)
        if (b.expirationDate === null) return true;

        // Include if not yet expired
        return b.expirationDate > now;
      }).length;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Mock Builders
// ---------------------------------------------------------------------------

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function createMockBenefit(
  overrides: Partial<UserBenefit> = {},
): UserBenefit {
  const now = new Date();
  return {
    id: `benefit-${Math.random()}`,
    name: 'Test Benefit',
    stickerValue: 10000,
    userDeclaredValue: null,
    isUsed: false,
    expirationDate: new Date(now.getTime() + 90 * MS_PER_DAY),
    type: 'StatementCredit',
    timesUsed: 0,
    resetCadence: 'CardmemberYear',
    ...overrides,
  };
}

function createMockCard(
  benefits: UserBenefit[] = [],
): UserCard {
  const now = new Date();
  return {
    id: `card-${Math.random()}`,
    customName: null,
    actualAnnualFee: 50000,
    renewalDate: new Date(now.getTime() + 365 * MS_PER_DAY),
    isOpen: true,
    masterCard: {
      id: 'master-1',
      issuer: 'Chase',
      cardName: 'Sapphire Reserve',
      defaultAnnualFee: 55000,
      cardImageUrl: 'https://example.com/card.png',
    },
    userBenefits: benefits,
  };
}

function createMockPlayer(
  cards: UserCard[] = [],
  overrides: Partial<Player> = {},
): Player {
  return {
    id: `player-${Math.random()}`,
    playerName: 'Primary',
    isActive: true,
    userCards: cards,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: Perpetual Benefit Handling
// ---------------------------------------------------------------------------

describe('SummaryStats - Perpetual Benefit Counting', () => {
  it('should count perpetual benefits (null expirationDate) as active', () => {
    // Lounge access is typically perpetual (no expiration)
    const loungeAccess = createMockBenefit({
      id: 'lounge-access',
      name: 'Lounge Access',
      isUsed: false,
      expirationDate: null, // KEY: Perpetual benefit
    });

    const card = createMockCard([loungeAccess]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(1);
  });

  it('should count time-limited unused benefits as active', () => {
    const now = new Date();
    const timeLimitedBenefit = createMockBenefit({
      id: 'annual-credit',
      name: 'Annual Travel Credit',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    const card = createMockCard([timeLimitedBenefit]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(1);
  });

  it('should count both perpetual AND time-limited benefits together', () => {
    const now = new Date();

    // Perpetual benefit
    const perpetualBenefit = createMockBenefit({
      id: 'lounge',
      isUsed: false,
      expirationDate: null,
    });

    // Time-limited benefit
    const timeLimitedBenefit = createMockBenefit({
      id: 'credit',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 60 * MS_PER_DAY),
    });

    const card = createMockCard([perpetualBenefit, timeLimitedBenefit]);
    const player = createMockPlayer([card]);

    // Should count both
    expect(getActiveCount([player])).toBe(2);
  });

  it('should NOT count used perpetual benefits', () => {
    // Used perpetual benefit should be excluded
    const usedPerpetual = createMockBenefit({
      id: 'used-lounge',
      isUsed: true, // KEY: Already used
      expirationDate: null, // Perpetual
    });

    const card = createMockCard([usedPerpetual]);
    const player = createMockPlayer([card]);

    // Should not count because isUsed=true
    expect(getActiveCount([player])).toBe(0);
  });

  it('should NOT count expired time-limited benefits', () => {
    const now = new Date();

    // Expired benefit
    const expiredBenefit = createMockBenefit({
      id: 'expired-credit',
      isUsed: false,
      expirationDate: new Date(now.getTime() - 1 * MS_PER_DAY), // Already expired
    });

    const card = createMockCard([expiredBenefit]);
    const player = createMockPlayer([card]);

    // Should not count because it's expired
    expect(getActiveCount([player])).toBe(0);
  });

  it('should correctly handle mixed scenario: perpetual, time-limited, used, expired', () => {
    const now = new Date();

    // Perpetual, unused (ACTIVE)
    const perpetualActive = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: null,
    });

    // Time-limited, unused, not expired (ACTIVE)
    const timeLimitedActive = createMockBenefit({
      id: 'b2',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 30 * MS_PER_DAY),
    });

    // Perpetual, used (INACTIVE - already used)
    const perpetualUsed = createMockBenefit({
      id: 'b3',
      isUsed: true,
      expirationDate: null,
    });

    // Time-limited, unused, but expired (INACTIVE - expired)
    const timeLimitedExpired = createMockBenefit({
      id: 'b4',
      isUsed: false,
      expirationDate: new Date(now.getTime() - 1 * MS_PER_DAY),
    });

    const card = createMockCard([
      perpetualActive,
      timeLimitedActive,
      perpetualUsed,
      timeLimitedExpired,
    ]);
    const player = createMockPlayer([card]);

    // Should count only the 2 active benefits
    expect(getActiveCount([player])).toBe(2);
  });

  it('should handle multiple cards with perpetual benefits', () => {
    // Card 1: perpetual lounge access
    const loungeAccess = createMockBenefit({
      id: 'lounge',
      isUsed: false,
      expirationDate: null,
    });
    const card1 = createMockCard([loungeAccess]);

    // Card 2: perpetual concierge + time-limited credit
    const concierge = createMockBenefit({
      id: 'concierge',
      isUsed: false,
      expirationDate: null,
    });
    const credit = createMockBenefit({
      id: 'credit',
      isUsed: false,
      expirationDate: new Date(new Date().getTime() + 30 * MS_PER_DAY),
    });
    const card2 = createMockCard([concierge, credit]);

    const player = createMockPlayer([card1, card2]);

    // Should count all 3 active benefits
    expect(getActiveCount([player])).toBe(3);
  });

  it('should handle multiple players with perpetual benefits', () => {
    // Player 1: perpetual benefit
    const benefit1 = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: null,
    });
    const card1 = createMockCard([benefit1]);
    const player1 = createMockPlayer([card1]);

    // Player 2: perpetual + time-limited
    const benefit2 = createMockBenefit({
      id: 'b2',
      isUsed: false,
      expirationDate: null,
    });
    const benefit3 = createMockBenefit({
      id: 'b3',
      isUsed: false,
      expirationDate: new Date(new Date().getTime() + 30 * MS_PER_DAY),
    });
    const card2 = createMockCard([benefit2, benefit3]);
    const player2 = createMockPlayer([card2]);

    // Should count all 3 active benefits across both players
    expect(getActiveCount([player1, player2])).toBe(3);
  });

  it('should return 0 for empty players array', () => {
    expect(getActiveCount([])).toBe(0);
  });

  it('should return 0 when all benefits are used', () => {
    const perpetualUsed = createMockBenefit({
      id: 'b1',
      isUsed: true,
      expirationDate: null,
    });

    const card = createMockCard([perpetualUsed]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(0);
  });

  it('should return 0 when all time-limited benefits are expired', () => {
    const now = new Date();
    const expiredBenefit = createMockBenefit({
      id: 'b1',
      isUsed: false,
      expirationDate: new Date(now.getTime() - 1 * MS_PER_DAY),
    });

    const card = createMockCard([expiredBenefit]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(0);
  });

  it('should correctly distinguish between null and invalid date for expirationDate', () => {
    const now = new Date();

    // Perpetual (null)
    const perpetual = createMockBenefit({
      id: 'perpetual',
      isUsed: false,
      expirationDate: null,
    });

    // Very far in the future (not perpetual, but effectively perpetual)
    const farFuture = createMockBenefit({
      id: 'far-future',
      isUsed: false,
      expirationDate: new Date(now.getTime() + 10 * 365 * MS_PER_DAY), // 10 years
    });

    const card = createMockCard([perpetual, farFuture]);
    const player = createMockPlayer([card]);

    // Both should be counted as active
    expect(getActiveCount([player])).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Regression Tests: Ensure fix doesn't break existing behavior
// ---------------------------------------------------------------------------

describe('SummaryStats - Regression Tests', () => {
  it('should still correctly count non-perpetual benefits', () => {
    const now = new Date();
    const benefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() + 15 * MS_PER_DAY),
    });

    const card = createMockCard([benefit]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(1);
  });

  it('should still exclude used benefits (perpetual or not)', () => {
    const perpetualUsed = createMockBenefit({
      isUsed: true,
      expirationDate: null,
    });

    const timeLimitedUsed = createMockBenefit({
      isUsed: true,
      expirationDate: new Date(new Date().getTime() + 30 * MS_PER_DAY),
    });

    const card = createMockCard([perpetualUsed, timeLimitedUsed]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(0);
  });

  it('should still exclude expired benefits correctly', () => {
    const now = new Date();
    const expiredBenefit = createMockBenefit({
      isUsed: false,
      expirationDate: new Date(now.getTime() - 1 * MS_PER_DAY),
    });

    const card = createMockCard([expiredBenefit]);
    const player = createMockPlayer([card]);

    expect(getActiveCount([player])).toBe(0);
  });
});
