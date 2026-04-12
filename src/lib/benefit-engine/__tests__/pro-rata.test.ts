import { calculateProRata, isProRataEligible, ProRataBenefitInput } from '../pro-rata';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a test benefit with sensible defaults (Walmart+ style). */
function makeBenefit(overrides: Partial<ProRataBenefitInput> = {}): ProRataBenefitInput {
  return {
    stickerValue: 15500, // $155 Walmart+
    claimingCadence: 'MONTHLY',
    claimingAmount: 1293, // ~$12.95/mo
    name: 'Walmart+ Membership Credit',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isProRataEligible
// ---------------------------------------------------------------------------

describe('isProRataEligible', () => {
  test('returns true for MONTHLY cadence with positive claimingAmount', () => {
    expect(isProRataEligible(makeBenefit())).toBe(true);
  });

  test('returns true for lowercase "monthly" cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: 'monthly' }))).toBe(true);
  });

  test('returns false for QUARTERLY cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: 'QUARTERLY' }))).toBe(false);
  });

  test('returns false for FLEXIBLE_ANNUAL cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: 'FLEXIBLE_ANNUAL' }))).toBe(false);
  });

  test('returns false for ONE_TIME cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: 'ONE_TIME' }))).toBe(false);
  });

  test('returns false for SEMI_ANNUAL cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: 'SEMI_ANNUAL' }))).toBe(false);
  });

  test('returns false for null cadence', () => {
    expect(isProRataEligible(makeBenefit({ claimingCadence: null }))).toBe(false);
  });

  test('returns false for claimingAmount 0 (unlimited)', () => {
    expect(isProRataEligible(makeBenefit({ claimingAmount: 0 }))).toBe(false);
  });

  test('returns false for negative claimingAmount', () => {
    expect(isProRataEligible(makeBenefit({ claimingAmount: -100 }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateProRata — full year (no pro-rating)
// ---------------------------------------------------------------------------

describe('calculateProRata', () => {
  const walmart = makeBenefit(); // $155 annual, $12.95/mo
  const uberOne = makeBenefit({
    stickerValue: 12000,
    claimingAmount: 1000,
    name: 'Uber One Membership Credit',
  }); // $120 annual, $10/mo

  // -- null / undefined claimedAt → full value --

  test('null claimedAt returns full value', () => {
    const result = calculateProRata(walmart, null);
    expect(result.proRataValue).toBe(15500);
    expect(result.monthsRemaining).toBe(12);
    expect(result.isProRated).toBe(false);
    expect(result.percentUsable).toBe(100);
  });

  test('undefined claimedAt returns full value', () => {
    const result = calculateProRata(walmart, undefined);
    expect(result.proRataValue).toBe(15500);
    expect(result.isProRated).toBe(false);
  });

  // -- January claim = full year --

  test('January 1 claim = 12 months remaining', () => {
    const result = calculateProRata(walmart, new Date('2025-01-01'));
    expect(result.monthsRemaining).toBe(12);
    expect(result.proRataValue).toBe(12 * 1293); // 15516
    expect(result.isProRated).toBe(false);
  });

  // -- Mid-year claims --

  test('April 1 claim = 9 months remaining', () => {
    const result = calculateProRata(walmart, new Date('2025-04-01'));
    expect(result.monthsRemaining).toBe(9);
    expect(result.proRataValue).toBe(9 * 1293); // 11637
    expect(result.isProRated).toBe(true);
    expect(result.percentUsable).toBe(75);
  });

  test('June claim for Uber One = 7 months × $10 = $70', () => {
    const result = calculateProRata(uberOne, new Date('2025-06-15'));
    expect(result.monthsRemaining).toBe(7);
    expect(result.proRataValue).toBe(7000);
    expect(result.monthlyRate).toBe(1000);
    expect(result.isProRated).toBe(true);
  });

  test('February claim = 11 months remaining', () => {
    const result = calculateProRata(uberOne, new Date('2025-02-28'));
    expect(result.monthsRemaining).toBe(11);
    expect(result.proRataValue).toBe(11 * 1000); // 11000
    expect(result.isProRated).toBe(true);
    expect(result.percentUsable).toBe(92);
  });

  // -- December claim = 1 month --

  test('December claim = 1 month remaining', () => {
    const result = calculateProRata(walmart, new Date('2025-12-01'));
    expect(result.monthsRemaining).toBe(1);
    expect(result.proRataValue).toBe(1293);
    expect(result.isProRated).toBe(true);
    expect(result.percentUsable).toBe(8);
  });

  // -- Non-eligible benefits always return full value --

  test('QUARTERLY benefit returns full value, not pro-rated', () => {
    const quarterly = makeBenefit({ claimingCadence: 'QUARTERLY', claimingAmount: 5000 });
    const result = calculateProRata(quarterly, new Date('2025-06-01'));
    expect(result.proRataValue).toBe(quarterly.stickerValue);
    expect(result.isProRated).toBe(false);
  });

  test('ONE_TIME benefit returns full value, not pro-rated', () => {
    const oneTime = makeBenefit({ claimingCadence: 'ONE_TIME', claimingAmount: 20000 });
    const result = calculateProRata(oneTime, new Date('2025-09-01'));
    expect(result.proRataValue).toBe(oneTime.stickerValue);
    expect(result.isProRated).toBe(false);
  });

  test('unlimited benefit (claimingAmount=0) returns full value', () => {
    const unlimited = makeBenefit({ claimingAmount: 0, stickerValue: 0 });
    const result = calculateProRata(unlimited, new Date('2025-06-01'));
    expect(result.proRataValue).toBe(0);
    expect(result.isProRated).toBe(false);
  });

  test('null cadence benefit returns full value', () => {
    const noCadence = makeBenefit({ claimingCadence: null });
    const result = calculateProRata(noCadence, new Date('2025-06-01'));
    expect(result.proRataValue).toBe(noCadence.stickerValue);
    expect(result.isProRated).toBe(false);
  });

  // -- fullValue is always the stickerValue --

  test('fullValue is always the stickerValue', () => {
    const result = calculateProRata(walmart, new Date('2025-06-01'));
    expect(result.fullValue).toBe(15500);
  });

  // -- Every month boundary (exhaustive) --

  describe.each([
    { month: 1, expected: 12 },
    { month: 2, expected: 11 },
    { month: 3, expected: 10 },
    { month: 4, expected: 9 },
    { month: 5, expected: 8 },
    { month: 6, expected: 7 },
    { month: 7, expected: 6 },
    { month: 8, expected: 5 },
    { month: 9, expected: 4 },
    { month: 10, expected: 3 },
    { month: 11, expected: 2 },
    { month: 12, expected: 1 },
  ])('month $month', ({ month, expected }) => {
    test(`claim in month ${month} → ${expected} months remaining`, () => {
      const dateStr = `2025-${String(month).padStart(2, '0')}-15`;
      const result = calculateProRata(uberOne, new Date(dateStr));
      expect(result.monthsRemaining).toBe(expected);
      expect(result.proRataValue).toBe(expected * 1000);
    });
  });
});
