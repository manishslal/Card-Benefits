/**
 * P0-2: Pagination Implementation Tests
 *
 * Tests for critical API endpoints to verify pagination implementation:
 * - GET /api/cards/master - Master card catalog pagination
 * - GET /api/cards/my-cards - User's card collection pagination
 *
 * Test Coverage:
 * ✓ Pagination parameters (page, limit)
 * ✓ Bounds checking (min/max limits)
 * ✓ Response structure (pagination metadata)
 * ✓ Edge cases (empty results, page boundaries)
 * ✓ Performance with large datasets
 * ✓ Backward compatibility concerns
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib';

// ============================================================
// Test Constants
// ============================================================

const TEST_API_BASE = 'http://localhost:3000/api';

// Sample test data
const TEST_USER_ID = 'test-pagination-user-123';
const TEST_PLAYER_NAME = 'Primary';

// API response interfaces (matching implementation)
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface MasterCardsResponse {
  success: boolean;
  data: any[];
  pagination?: PaginationMeta;
  count?: number; // Legacy field (should be deprecated)
}

interface UserCardsResponse {
  success: boolean;
  cards: any[];
  summary?: any;
  pagination?: PaginationMeta;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Makes a request to the API with proper error handling
 */
async function fetchFromAPI(
  endpoint: string,
  options?: RequestInit & { headers?: Record<string, string> }
): Promise<{ status: number; data: any }> {
  const headers = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Creates test master cards in the database
 */
async function createTestMasterCards(count: number) {
  const cards = [];
  for (let i = 1; i <= count; i++) {
    cards.push({
      issuer: `Issuer ${Math.ceil(i / 10)}`, // Groups by tens
      cardName: `Test Card ${String(i).padStart(3, '0')}`,
      defaultAnnualFee: i * 100,
      cardImageUrl: `https://example.com/card-${i}.png`,
    });
  }

  // Use createMany if available, otherwise insert individually
  const createdCards = [];
  for (const card of cards) {
    const created = await prisma.masterCard.create({
      data: card,
    });
    createdCards.push(created);
  }

  return createdCards;
}

/**
 * Creates a test user with cards
 */
async function createTestUserWithCards(userId: string, cardCount: number) {
  // Create user (if needed)
  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@test.example.com`,
        password: 'hashed_password',
      },
    });
  }

  // Create player
  let player = await prisma.player.findFirst({
    where: { userId, playerName: TEST_PLAYER_NAME },
  });
  if (!player) {
    player = await prisma.player.create({
      data: {
        userId,
        playerName: TEST_PLAYER_NAME,
      },
    });
  }

  // Create master cards and user cards
  const masterCards = await prisma.masterCard.findMany({ take: cardCount });

  for (let i = 0; i < Math.min(cardCount, masterCards.length); i++) {
    await prisma.userCard.create({
      data: {
        playerId: player.id,
        masterCardId: masterCards[i].id,
        status: i % 3 === 0 ? 'ACTIVE' : i % 3 === 1 ? 'PENDING' : 'PAUSED',
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  }

  return { user, player };
}

/**
 * Cleans up test data
 */
async function cleanupTestData() {
  try {
    // Delete user cards
    await prisma.userCard.deleteMany({
      where: {
        userCard: {
          player: {
            userId: TEST_USER_ID,
          },
        },
      },
    });

    // Delete player
    await prisma.player.deleteMany({
      where: {
        userId: TEST_USER_ID,
        playerName: TEST_PLAYER_NAME,
      },
    });

    // Delete user
    await prisma.user.deleteMany({
      where: { id: TEST_USER_ID },
    });

    // Delete test master cards (ones we created)
    await prisma.masterCard.deleteMany({
      where: {
        cardName: {
          startsWith: 'Test Card',
        },
      },
    });
  } catch (error) {
    console.error('Cleanup error (non-critical):', error);
  }
}

// ============================================================
// Tests: /api/cards/master
// ============================================================

describe('GET /api/cards/master - Pagination', () => {
  beforeAll(async () => {
    // Create test data: 50 master cards for pagination testing
    console.log('Creating 50 test master cards for pagination tests...');
    await createTestMasterCards(50);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Default Pagination', () => {
    it('should return first page with default limit (12)', async () => {
      const { status, data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master`);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.length).toBeLessThanOrEqual(12);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(12);
      expect(data.pagination.total).toBeGreaterThanOrEqual(50);
    });

    it('should include pagination metadata', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master`);

      expect(data.pagination).toMatchObject({
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
        hasMore: expect.any(Boolean),
      });
    });
  });

  describe('Custom Pagination Parameters', () => {
    it('should respect custom page parameter', async () => {
      const { data: page1 } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?page=1&limit=10`);
      const { data: page2 } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?page=2&limit=10`);

      expect(page1.data).toHaveLength(10);
      expect(page2.data).toHaveLength(10);
      expect(page1.pagination.page).toBe(1);
      expect(page2.pagination.page).toBe(2);

      // Verify different cards on different pages
      const page1Ids = page1.data.map((c: any) => c.id);
      const page2Ids = page2.data.map((c: any) => c.id);
      expect(page1Ids).not.toEqual(page2Ids);
    });

    it('should respect custom limit parameter', async () => {
      const limits = [5, 10, 20, 30];

      for (const limit of limits) {
        const { data } = await fetchFromAPI(
          `${TEST_API_BASE}/cards/master?page=1&limit=${limit}`
        );

        expect(data.data.length).toBeLessThanOrEqual(limit);
        expect(data.pagination.limit).toBe(limit);
      }
    });

    it('should calculate hasMore flag correctly', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?limit=10`);

      const total = data.pagination.total;
      const totalPages = data.pagination.totalPages;

      // Test first page
      const firstPageResp = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=1&limit=10`
      );
      expect(firstPageResp.data.pagination.hasMore).toBe(
        total > 10 && firstPageResp.data.pagination.totalPages > 1
      );

      // Test last page
      const lastPageResp = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=${totalPages}&limit=10`
      );
      expect(lastPageResp.data.pagination.hasMore).toBe(false);
    });
  });

  describe('Bounds Checking', () => {
    it('should cap maximum limit at 50', async () => {
      const testLimits = [100, 200, 1000];

      for (const limit of testLimits) {
        const { data } = await fetchFromAPI(
          `${TEST_API_BASE}/cards/master?page=1&limit=${limit}`
        );

        expect(data.pagination.limit).toBeLessThanOrEqual(50);
        expect(data.data.length).toBeLessThanOrEqual(50);
      }
    });

    it('should enforce minimum limit of 1', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=1&limit=0`
      );

      expect(data.pagination.limit).toBeGreaterThanOrEqual(1);
      expect(data.data.length).toBeGreaterThanOrEqual(0);
    });

    it('should enforce minimum page of 1', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=0`
      );

      expect(data.pagination.page).toBeGreaterThanOrEqual(1);
    });

    it('should handle negative page/limit', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=-5&limit=-10`
      );

      expect(data.pagination.page).toBeGreaterThanOrEqual(1);
      expect(data.pagination.limit).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle requesting beyond last page', async () => {
      const { data: firstResp } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=1&limit=10`
      );
      const totalPages = firstResp.pagination.totalPages;

      // Request page way beyond last page
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/master?page=${totalPages + 100}&limit=10`
      );

      expect(data.data).toHaveLength(0);
      expect(data.pagination.hasMore).toBe(false);
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      const invalidParams = [
        'page=abc&limit=12',
        'page=12&limit=xyz',
        'page=NaN&limit=10',
      ];

      for (const params of invalidParams) {
        const { status, data } = await fetchFromAPI(
          `${TEST_API_BASE}/cards/master?${params}`
        );

        // Should either return 400 error or handle gracefully with defaults
        if (status === 400) {
          expect(data.success).toBe(false);
        } else {
          expect(data.success).toBe(true);
          expect(data.pagination).toBeDefined();
        }
      }
    });

    it('should calculate totalPages correctly', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?limit=10`);

      const expectedPages = Math.ceil(data.pagination.total / 10);
      expect(data.pagination.totalPages).toBe(expectedPages);
    });
  });

  describe('Response Structure', () => {
    it('should maintain correct response structure with pagination', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?page=1&limit=5`);

      // Check top-level structure
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');

      // Check data is array
      expect(Array.isArray(data.data)).toBe(true);

      // Check pagination structure
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('hasMore');
    });

    it('should include master card details in response', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master?limit=1`);

      if (data.data.length > 0) {
        const card = data.data[0];
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('issuer');
        expect(card).toHaveProperty('cardName');
        expect(card).toHaveProperty('defaultAnnualFee');
        expect(card).toHaveProperty('cardImageUrl');
        expect(card).toHaveProperty('masterBenefits');
        expect(Array.isArray(card.masterBenefits)).toBe(true);
      }
    });
  });

  describe('Performance', () => {
    it('should return paginated results quickly', async () => {
      const start = Date.now();
      await fetchFromAPI(`${TEST_API_BASE}/cards/master?page=1&limit=20`);
      const duration = Date.now() - start;

      // Pagination should be fast (< 500ms for typical scenarios)
      expect(duration).toBeLessThan(500);
    });

    it('should efficiently handle multiple concurrent requests', async () => {
      const requests = Array(10)
        .fill(0)
        .map((_, i) => fetchFromAPI(`${TEST_API_BASE}/cards/master?page=${i + 1}&limit=5`));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        expect(response.data.pagination).toBeDefined();
      });
    });
  });
});

// ============================================================
// Tests: /api/cards/my-cards
// ============================================================

describe('GET /api/cards/my-cards - Pagination', () => {
  const userId = TEST_USER_ID;

  beforeAll(async () => {
    // Create test data: 100 master cards, then assign 30 to test user
    console.log('Creating test data for my-cards pagination...');
    await createTestMasterCards(30); // Create 30 cards total
    await createTestUserWithCards(userId, 25); // User owns 25 of them
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Authentication', () => {
    it('should return 401 when not authenticated', async () => {
      const { status, data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`);

      expect(status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('authenticated');
    });

    it('should return 200 with valid authentication header', async () => {
      const { status, data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: {
          'x-user-id': userId,
        },
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Default Pagination', () => {
    it('should return first page with default limit (20)', async () => {
      const { status, data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: { 'x-user-id': userId },
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cards).toBeDefined();
      expect(Array.isArray(data.cards)).toBe(true);
      expect(data.cards.length).toBeLessThanOrEqual(20);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
      expect(data.pagination.total).toBe(25); // We created 25 cards
    });

    it('should include summary with pagination', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: { 'x-user-id': userId },
      });

      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveProperty('totalCards');
      expect(data.summary).toHaveProperty('totalAnnualFees');
      expect(data.summary).toHaveProperty('totalBenefitValue');
      expect(data.summary).toHaveProperty('activeCards');
      expect(data.summary).toHaveProperty('activeBenefits');

      // Summary should reflect ALL cards, not just paginated set
      expect(data.summary.totalCards).toBe(data.pagination.total);
    });
  });

  describe('Custom Pagination Parameters', () => {
    it('should respect custom page parameter', async () => {
      const { data: page1 } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=1&limit=10`,
        { headers: { 'x-user-id': userId } }
      );
      const { data: page2 } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=2&limit=10`,
        { headers: { 'x-user-id': userId } }
      );

      expect(page1.pagination.page).toBe(1);
      expect(page2.pagination.page).toBe(2);

      if (page1.cards.length > 0 && page2.cards.length > 0) {
        const page1Ids = page1.cards.map((c: any) => c.id);
        const page2Ids = page2.cards.map((c: any) => c.id);
        expect(page1Ids).not.toEqual(page2Ids);
      }
    });

    it('should respect custom limit parameter', async () => {
      const limits = [5, 10, 15, 25];

      for (const limit of limits) {
        const { data } = await fetchFromAPI(
          `${TEST_API_BASE}/cards/my-cards?limit=${limit}`,
          { headers: { 'x-user-id': userId } }
        );

        expect(data.cards.length).toBeLessThanOrEqual(limit);
        expect(data.pagination.limit).toBe(limit);
      }
    });
  });

  describe('Bounds Checking', () => {
    it('should cap maximum limit at 100', async () => {
      const testLimits = [150, 500, 1000];

      for (const limit of testLimits) {
        const { data } = await fetchFromAPI(
          `${TEST_API_BASE}/cards/my-cards?limit=${limit}`,
          { headers: { 'x-user-id': userId } }
        );

        expect(data.pagination.limit).toBeLessThanOrEqual(100);
      }
    });

    it('should handle negative page/limit values', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=-1&limit=-20`,
        { headers: { 'x-user-id': userId } }
      );

      expect(data.pagination.page).toBeGreaterThanOrEqual(1);
      expect(data.pagination.limit).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Summary Statistics Accuracy', () => {
    it('should calculate summary from ALL cards regardless of pagination', async () => {
      const page1 = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=1&limit=10`,
        { headers: { 'x-user-id': userId } }
      );
      const page2 = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=2&limit=10`,
        { headers: { 'x-user-id': userId } }
      );

      // Summary should be identical on all pages (not affected by pagination)
      expect(page1.data.summary).toEqual(page2.data.summary);
    });

    it('should maintain accurate totalCards in summary', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=1&limit=5`,
        { headers: { 'x-user-id': userId } }
      );

      // Summary.totalCards should match pagination.total
      expect(data.summary.totalCards).toBe(data.pagination.total);
    });
  });

  describe('Response Structure', () => {
    it('should maintain correct response structure with pagination', async () => {
      const { data } = await fetchFromAPI(
        `${TEST_API_BASE}/cards/my-cards?page=1&limit=10`,
        { headers: { 'x-user-id': userId } }
      );

      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('cards');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('pagination');

      expect(Array.isArray(data.cards)).toBe(true);
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('totalPages');
      expect(data.pagination).toHaveProperty('hasMore');
    });

    it('should include complete card details', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards?limit=1`, {
        headers: { 'x-user-id': userId },
      });

      if (data.cards.length > 0) {
        const card = data.cards[0];
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('masterCardId');
        expect(card).toHaveProperty('issuer');
        expect(card).toHaveProperty('cardName');
        expect(card).toHaveProperty('status');
        expect(card).toHaveProperty('benefits');
        expect(Array.isArray(card.benefits)).toBe(true);
      }
    });
  });

  describe('Empty Results', () => {
    it('should handle user with no cards', async () => {
      const newUserId = 'user-with-no-cards-123';

      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: { 'x-user-id': newUserId },
      });

      expect(data.success).toBe(true);
      expect(data.cards).toEqual([]);
      expect(data.pagination.total).toBe(0);
      expect(data.pagination.totalPages).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
      expect(data.summary.totalCards).toBe(0);
    });
  });
});

// ============================================================
// Tests: Backward Compatibility
// ============================================================

describe('Backward Compatibility - Response Changes', () => {
  describe('/api/cards/master response structure', () => {
    it('should include NEW pagination structure', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master`);

      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
    });

    it('should deprecate OLD count field in favor of pagination.total', async () => {
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/master`);

      // New structure should have pagination
      expect(data).toHaveProperty('pagination');

      // Old 'count' field is deprecated (may or may not exist)
      // This is informational - clients should migrate to pagination.total
      if (data.count !== undefined) {
        console.warn(
          'DEPRECATION: Response includes legacy "count" field. Use "pagination.total" instead.'
        );
      }
    });
  });

  describe('/api/cards/my-cards response structure', () => {
    it('should include NEW pagination structure', async () => {
      const userId = 'test-compat-user-123';
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: { 'x-user-id': userId },
      });

      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
    });

    it('should maintain summary structure unchanged', async () => {
      const userId = 'test-compat-user-456';
      const { data } = await fetchFromAPI(`${TEST_API_BASE}/cards/my-cards`, {
        headers: { 'x-user-id': userId },
      });

      // Summary should still exist and have expected fields
      expect(data.summary).toBeDefined();
      expect(data.summary).toHaveProperty('totalCards');
      expect(data.summary).toHaveProperty('totalAnnualFees');
      expect(data.summary).toHaveProperty('totalBenefitValue');
      expect(data.summary).toHaveProperty('activeCards');
      expect(data.summary).toHaveProperty('activeBenefits');
    });
  });
});
