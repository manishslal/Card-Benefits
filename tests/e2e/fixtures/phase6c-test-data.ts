/**
 * Phase 6C Test Data Fixtures
 * 
 * Comprehensive test data for claiming cadence E2E tests.
 * Sets up test user with all 87 benefits across various claiming periods.
 */

export const testUserData = {
  email: 'phase6c.test@cardbenefits.com',
  password: 'TestCadence2026!',
  playerId: 'test-phase6c-claiming-user',
  userId: 'usr_phase6c_claiming_test',
};

/**
 * Test cards with claiming cadence benefits
 */
export const testCards = [
  {
    id: 'card-amex-platinum',
    name: 'Amex Platinum',
    masterCardId: 'master-amex-platinum',
    benefits: [
      {
        id: 'benefit-amex-dining',
        name: 'Dining Credit',
        type: 'STATEMENT_CREDIT',
        claimingCadence: 'QUARTERLY',
        claimingAmount: 7500, // $75 in cents
        claimingWindowEnd: '2026-09-18', // Amex Sept 18 boundary
        resetCadence: 'QUARTERLY',
        stickerValue: 300, // $300 annual value
      },
      {
        id: 'benefit-amex-uber',
        name: 'Uber Credit',
        type: 'STATEMENT_CREDIT', 
        claimingCadence: 'MONTHLY',
        claimingAmount: 1500, // $15 in cents
        resetCadence: 'MONTHLY',
        stickerValue: 200, // $200 annual value
      },
      {
        id: 'benefit-amex-entertainment',
        name: 'Entertainment Credit',
        type: 'STATEMENT_CREDIT',
        claimingCadence: 'MONTHLY', 
        claimingAmount: 1500, // $15 in cents
        resetCadence: 'MONTHLY',
        stickerValue: 240, // $240 annual value
      },
      {
        id: 'benefit-amex-global-entry',
        name: 'Global Entry',
        type: 'STATEMENT_CREDIT',
        claimingCadence: 'ONE_TIME',
        claimingAmount: 10900, // $109 in cents
        resetCadence: 'CUSTOM',
        stickerValue: 109,
      }
    ]
  },
  {
    id: 'card-chase-sapphire',
    name: 'Chase Sapphire Reserve',
    masterCardId: 'master-chase-sapphire',
    benefits: [
      {
        id: 'benefit-chase-travel',
        name: 'Travel Credit',
        type: 'STATEMENT_CREDIT',
        claimingCadence: 'FLEXIBLE_ANNUAL',
        claimingAmount: 30000, // $300 in cents
        resetCadence: 'ANNUAL',
        stickerValue: 300,
      },
      {
        id: 'benefit-chase-monthly-25',
        name: 'Monthly Benefit',
        type: 'STATEMENT_CREDIT',
        claimingCadence: 'MONTHLY',
        claimingAmount: 2500, // $25 in cents
        resetCadence: 'MONTHLY', 
        stickerValue: 300,
      }
    ]
  }
];

/**
 * Test scenarios with specific dates and expected behaviors
 */
export const testScenarios = {
  // Scenario 1: Mid-month, low urgency
  midMarch2026: {
    currentDate: '2026-03-15T10:00:00.000Z',
    expectedUrgency: 'LOW',
    expectedColor: '#22c55e', // green
    monthlyBenefits: {
      uber: {
        available: 1500,
        daysLeft: 16,
        status: 'AVAILABLE'
      }
    }
  },
  
  // Scenario 2: Mobile over-limit test
  lateMarsh2026: {
    currentDate: '2026-03-20T14:30:00.000Z',
    expectedUrgency: 'MEDIUM',
    expectedColor: '#eab308', // yellow
    testOverLimit: {
      benefit: 'entertainment',
      limit: 1500,
      attemptAmount: 2000,
      expectedError: 'Only $15 available'
    }
  }
};