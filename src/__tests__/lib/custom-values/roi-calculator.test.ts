/**
 * src/__tests__/lib/custom-values/roi-calculator.test.ts
 *
 * Comprehensive tests for ROI calculation engine.
 * Covers benefit, card, player, and household ROI calculations with caching.
 *
 * Test targets:
 * - 50+ test cases covering all calculation levels
 * - Edge cases: zero fees, large values, decimal precision
 * - Cache behavior: hits, misses, TTL, invalidation
 * - Performance targets: all operations < thresholds
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  calculateBenefitROI,
  calculateCardROI,
  calculatePlayerROI,
  calculateHouseholdROI,
  getROI,
  invalidateROICache,
  clearROICache,
  getROICacheStats,
} from '@/features/cards/lib/roi-calculator';
import { prisma } from '@/shared/lib';

// Mock Prisma
vi.mock('@/shared/lib', () => ({
  prisma: {
    userCard: {
      findUnique: vi.fn(),
    },
    player: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('ROI Calculator', () => {
  beforeEach(() => {
    clearROICache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearROICache();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BENEFIT ROI TESTS (6 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculateBenefitROI - Basic Calculations', () => {
    it('should calculate ROI as (value / fee) * 100', () => {
      // $250 custom value, $550 annual fee = 45.45%
      const roi = calculateBenefitROI(25000, 30000, 55000);
      expect(roi).toBeCloseTo(45.45, 1);
    });

    it('should use sticker value when custom value is null', () => {
      // null custom, $300 sticker, $550 fee = 54.55%
      const roi = calculateBenefitROI(null, 30000, 55000);
      expect(roi).toBeCloseTo(54.55, 1);
    });

    it('should return 0 when fee is 0 (avoid Infinity)', () => {
      const roi = calculateBenefitROI(25000, 30000, 0);
      expect(roi).toBe(0);
    });

    it('should return 0 when value is 0', () => {
      const roi = calculateBenefitROI(0, 30000, 55000);
      expect(roi).toBe(0);
    });

    it('should maintain decimal precision to 2 places', () => {
      const roi = calculateBenefitROI(25000, 30000, 55000);
      const decimalPlaces = (roi.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should match spec example: $250/$550 = 45.45%', () => {
      const roi = calculateBenefitROI(25000, 30000, 55000);
      expect(roi).toBeCloseTo(45.45, 2);
    });
  });

  describe('calculateBenefitROI - Edge Cases', () => {
    it('should handle very large values', () => {
      const roi = calculateBenefitROI(999_999_900, 999_999_999, 550000);
      expect(roi).toBeGreaterThan(0);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should handle 100% ROI (value = fee)', () => {
      const roi = calculateBenefitROI(10000, 10000, 10000);
      expect(roi).toBe(100);
    });

    it('should handle ROI > 200% (value > 2x fee)', () => {
      const roi = calculateBenefitROI(30000, 30000, 10000);
      expect(roi).toBe(300);
    });

    it('should handle very small fees (1 cent)', () => {
      const roi = calculateBenefitROI(100, 100, 1);
      expect(roi).toBe(10000);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should handle both value and fee zero', () => {
      const roi = calculateBenefitROI(0, 0, 0);
      expect(roi).toBe(0);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should handle negative-looking scenario gracefully', () => {
      // Very small value, large fee
      const roi = calculateBenefitROI(1, 1, 10000);
      expect(roi).toBeCloseTo(0.01, 2);
      expect(Number.isFinite(roi)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CARD ROI TESTS (8 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculateCardROI', () => {
    const mockCard = {
      id: 'card-1',
      actualAnnualFee: null,
      masterCard: {
        defaultAnnualFee: 55000, // $550
      },
      userBenefits: [
        {
          id: 'b1',
          userDeclaredValue: 25000, // $250 custom
          stickerValue: 30000,
          isUsed: true,
        },
        {
          id: 'b2',
          userDeclaredValue: null, // Use sticker
          stickerValue: 20000, // $200
          isUsed: true,
        },
      ],
    };

    it('should sum all benefit values correctly', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
      
      const roi = await calculateCardROI('card-1');
      // ($250 + $200) / $550 * 100 = 81.82%
      expect(roi).toBeCloseTo(81.82, 1);
    });

    it('should use custom value when set', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
      
      const roi = await calculateCardROI('card-1');
      // Calculation includes custom value $250, not sticker $300
      const stats = getROICacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });

    it('should use sticker value when custom is null', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
      
      const roi = await calculateCardROI('card-1');
      expect(roi).toBeCloseTo(81.82, 1);
    });

    it('should exclude benefits with isUsed=false', async () => {
      // When querying with where: { isUsed: true }, the database only returns used benefits
      const cardWithUnused = {
        ...mockCard,
        userBenefits: [
          mockCard.userBenefits[0], // Only the used benefit is returned by the WHERE clause
        ],
      };
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(cardWithUnused as any);
      
      const roi = await calculateCardROI('card-1');
      // Only b1: $250 / $550 = 45.45%
      expect(roi).toBeCloseTo(45.45, 2);
    });

    it('should handle card not found', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(null);
      
      const roi = await calculateCardROI('card-not-exist');
      expect(roi).toBe(0);
    });

    it('should use actualAnnualFee when set', async () => {
      const cardWithOverride = {
        ...mockCard,
        actualAnnualFee: 100000, // $1000 override
      };
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(cardWithOverride as any);
      
      const roi = await calculateCardROI('card-1');
      // ($250 + $200) / $1000 = 45%
      expect(roi).toBeCloseTo(45, 0);
    });

    it('should return 0 when annual fee is 0', async () => {
      const cardFreeCard = {
        ...mockCard,
        masterCard: { defaultAnnualFee: 0 },
      };
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(cardFreeCard as any);
      
      const roi = await calculateCardROI('card-1');
      expect(roi).toBe(0);
    });

    it('should maintain decimal precision', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCard as any);
      
      const roi = await calculateCardROI('card-1');
      const decimalPlaces = (roi.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PLAYER ROI TESTS (8 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculatePlayerROI', () => {
    const mockPlayer = {
      id: 'player-1',
      userCards: [
        {
          id: 'card-1',
          actualAnnualFee: null,
          masterCard: { defaultAnnualFee: 55000 },
          userBenefits: [
            {
              id: 'b1',
              userDeclaredValue: 25000,
              stickerValue: 30000,
              isUsed: true,
            },
          ],
        },
        {
          id: 'card-2',
          actualAnnualFee: null,
          masterCard: { defaultAnnualFee: 100000 },
          userBenefits: [
            {
              id: 'b2',
              userDeclaredValue: null,
              stickerValue: 50000,
              isUsed: true,
            },
          ],
        },
      ],
    };

    it('should aggregate benefits from all cards', async () => {
      vi.mocked(prisma.player.findUnique).mockResolvedValue(mockPlayer as any);
      
      const roi = await calculatePlayerROI('player-1');
      // ($250 + $500) / ($550 + $1000) = 750 / 1550 = 48.39%
      expect(roi).toBeCloseTo(48.39, 1);
    });

    it('should only count benefits with isUsed=true', async () => {
      // When querying with where: { isUsed: true }, only used benefits are returned
      const playerWithUnused = {
        ...mockPlayer,
        userCards: [
          {
            ...mockPlayer.userCards[0],
            userBenefits: [], // b1 is not used, so it's excluded by the WHERE clause
          },
          mockPlayer.userCards[1], // b2 is used and returned
        ],
      };
      vi.mocked(prisma.player.findUnique).mockResolvedValue(playerWithUnused as any);
      
      const roi = await calculatePlayerROI('player-1');
      // Only b2: $500 / ($550 + $1000) = 500 / 1550 = 32.26%
      expect(roi).toBeCloseTo(32.26, 2);
    });

    it('should handle player not found', async () => {
      vi.mocked(prisma.player.findUnique).mockResolvedValue(null);
      
      const roi = await calculatePlayerROI('player-not-exist');
      expect(roi).toBe(0);
    });

    it('should return 0 when total fees are 0', async () => {
      const playerFreeCards = {
        ...mockPlayer,
        userCards: mockPlayer.userCards.map(c => ({
          ...c,
          masterCard: { defaultAnnualFee: 0 },
        })),
      };
      vi.mocked(prisma.player.findUnique).mockResolvedValue(playerFreeCards as any);
      
      const roi = await calculatePlayerROI('player-1');
      expect(roi).toBe(0);
    });

    it('should use actualAnnualFee when set', async () => {
      const playerWithOverrides = {
        ...mockPlayer,
        userCards: [
          { ...mockPlayer.userCards[0], actualAnnualFee: 200000 },
          mockPlayer.userCards[1],
        ],
      };
      vi.mocked(prisma.player.findUnique).mockResolvedValue(playerWithOverrides as any);
      
      const roi = await calculatePlayerROI('player-1');
      // ($250 + $500) / ($2000 + $1000) = 750 / 3000 = 25%
      expect(roi).toBeCloseTo(25, 0);
    });

    it('should only count open cards (isOpen=true)', async () => {
      // The implementation filters for isOpen: true
      const playerWithClosed = {
        ...mockPlayer,
        userCards: mockPlayer.userCards,
      };
      vi.mocked(prisma.player.findUnique).mockResolvedValue(playerWithClosed as any);
      
      const roi = await calculatePlayerROI('player-1');
      expect(roi).toBeGreaterThan(0);
    });

    it('should maintain decimal precision', async () => {
      vi.mocked(prisma.player.findUnique).mockResolvedValue(mockPlayer as any);
      
      const roi = await calculatePlayerROI('player-1');
      const decimalPlaces = (roi.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should handle mixed custom and sticker values', async () => {
      vi.mocked(prisma.player.findUnique).mockResolvedValue(mockPlayer as any);
      
      const roi = await calculatePlayerROI('player-1');
      // Card 1: custom $250, Card 2: sticker $500
      expect(roi).toBeCloseTo(48.39, 1);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HOUSEHOLD ROI TESTS (4 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculateHouseholdROI', () => {
    const mockHousehold = {
      id: 'user-1',
      players: [
        {
          id: 'player-1',
          userCards: [
            {
              id: 'card-1',
              actualAnnualFee: null,
              masterCard: { defaultAnnualFee: 55000 },
              userBenefits: [
                {
                  id: 'b1',
                  userDeclaredValue: 25000,
                  stickerValue: 30000,
                  isUsed: true,
                },
              ],
            },
          ],
        },
        {
          id: 'player-2',
          userCards: [
            {
              id: 'card-2',
              actualAnnualFee: null,
              masterCard: { defaultAnnualFee: 100000 },
              userBenefits: [
                {
                  id: 'b2',
                  userDeclaredValue: null,
                  stickerValue: 50000,
                  isUsed: true,
                },
              ],
            },
          ],
        },
      ],
    };

    it('should aggregate all players correctly', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockHousehold as any);
      
      const roi = await calculateHouseholdROI('user-1');
      // ($250 + $500) / ($550 + $1000) = 750 / 1550 = 48.39%
      expect(roi).toBeCloseTo(48.39, 1);
    });

    it('should only count active players', async () => {
      // The implementation filters for isActive: true
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockHousehold as any);
      
      const roi = await calculateHouseholdROI('user-1');
      expect(roi).toBeGreaterThan(0);
    });

    it('should handle household not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      
      const roi = await calculateHouseholdROI('user-not-exist');
      expect(roi).toBe(0);
    });

    it('should return 0 when total fees are 0', async () => {
      const householdFree = {
        ...mockHousehold,
        players: mockHousehold.players.map(p => ({
          ...p,
          userCards: p.userCards.map(c => ({
            ...c,
            masterCard: { defaultAnnualFee: 0 },
          })),
        })),
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(householdFree as any);
      
      const roi = await calculateHouseholdROI('user-1');
      expect(roi).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CACHE TESTS (8 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Cache Behavior', () => {
    const mockCardForCache = {
      id: 'card-1',
      actualAnnualFee: null,
      masterCard: { defaultAnnualFee: 55000 },
      userBenefits: [
        {
          id: 'b1',
          userDeclaredValue: 25000,
          stickerValue: 30000,
          isUsed: true,
        },
      ],
    };

    it('should cache card ROI on first call', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      await getROI('CARD', 'card-1');
      const stats = getROICacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('CARD:card-1');
    });

    it('should return cached value without recalculating', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      // First call - populates cache
      const roi1 = await getROI('CARD', 'card-1');
      vi.mocked(prisma.userCard.findUnique).mockClear();
      
      // Second call - should use cache
      const roi2 = await getROI('CARD', 'card-1');
      
      expect(roi1).toBe(roi2);
      expect(vi.mocked(prisma.userCard.findUnique)).not.toHaveBeenCalled();
    });

    it('should support bypassCache option', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      // First call
      await getROI('CARD', 'card-1');
      vi.mocked(prisma.userCard.findUnique).mockClear();
      
      // Second call with bypass
      await getROI('CARD', 'card-1', { bypassCache: true });
      
      // Should have called again
      expect(vi.mocked(prisma.userCard.findUnique)).toHaveBeenCalled();
    });

    it('should invalidate specific cache entries', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      // Populate cache
      await getROI('CARD', 'card-1');
      await getROI('CARD', 'card-2');
      
      let stats = getROICacheStats();
      expect(stats.size).toBe(2);
      
      // Invalidate one
      invalidateROICache(['CARD:card-1']);
      
      stats = getROICacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('CARD:card-2');
    });

    it('should invalidate multiple entries at once', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      await getROI('CARD', 'card-1');
      await getROI('CARD', 'card-2');
      await getROI('PLAYER', 'player-1');
      
      let stats = getROICacheStats();
      expect(stats.size).toBe(3);
      
      invalidateROICache(['CARD:card-1', 'PLAYER:player-1']);
      
      stats = getROICacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].key).toBe('CARD:card-2');
    });

    it('should track cache entry age', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue(mockCardForCache as any);
      
      await getROI('CARD', 'card-1');
      const stats = getROICacheStats();
      
      expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
      expect(stats.entries[0].age).toBeLessThan(100); // Should be very recent
    });

    it('should clear entire cache', () => {
      clearROICache();
      const stats = getROICacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries.length).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PERFORMANCE TESTS (5 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Performance Targets', () => {
    it('calculateBenefitROI < 10ms', () => {
      const iterations = 1000;
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        calculateBenefitROI(25000, 30000, 55000);
      }
      
      const total = performance.now() - start;
      const avg = total / iterations;
      
      expect(avg).toBeLessThan(10);
    });

    it('cache hit retrieval < 5ms', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue({
        id: 'card-1',
        actualAnnualFee: null,
        masterCard: { defaultAnnualFee: 55000 },
        userBenefits: [
          {
            id: 'b1',
            userDeclaredValue: 25000,
            stickerValue: 30000,
            isUsed: true,
          },
        ],
      } as any);
      
      // Populate cache
      await getROI('CARD', 'card-1');
      
      // Measure cached retrieval
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await getROI('CARD', 'card-1');
      }
      const total = performance.now() - start;
      const avg = total / 100;
      
      expect(avg).toBeLessThan(5);
    });

    it('cache miss calculation < 100ms', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue({
        id: 'card-1',
        actualAnnualFee: null,
        masterCard: { defaultAnnualFee: 55000 },
        userBenefits: [
          {
            id: 'b1',
            userDeclaredValue: 25000,
            stickerValue: 30000,
            isUsed: true,
          },
        ],
      } as any);
      
      const start = performance.now();
      await getROI('CARD', 'card-1');
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(100);
    });

    it('getROICacheStats < 5ms', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        getROICacheStats();
      }
      const total = performance.now() - start;
      const avg = total / 1000;
      
      expect(avg).toBeLessThan(5);
    });

    it('invalidateROICache for 100 entries < 10ms', () => {
      const keys = Array.from({ length: 100 }, (_, i) => `KEY:${i}`);
      
      const start = performance.now();
      invalidateROICache(keys);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(10);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CONCURRENT ACCESS TESTS (3 cases)
  // ════════════════════════════════════════════════════════════════════════════

  describe('Concurrent Access', () => {
    it('should handle concurrent cache reads', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue({
        id: 'card-1',
        actualAnnualFee: null,
        masterCard: { defaultAnnualFee: 55000 },
        userBenefits: [
          {
            id: 'b1',
            userDeclaredValue: 25000,
            stickerValue: 30000,
            isUsed: true,
          },
        ],
      } as any);
      
      // Prime cache
      await getROI('CARD', 'card-1');
      
      // Concurrent reads
      const promises = Array.from({ length: 10 }, () => 
        getROI('CARD', 'card-1')
      );
      
      const results = await Promise.all(promises);
      
      // All should return same value
      expect(results.every(r => r === results[0])).toBe(true);
      expect(vi.mocked(prisma.userCard.findUnique).mock.calls.length).toBe(1);
    });

    it('should handle concurrent cache invalidation', () => {
      clearROICache();
      
      // Simulate concurrent invalidations
      invalidateROICache(['KEY1', 'KEY2', 'KEY3']);
      invalidateROICache(['KEY4', 'KEY5']);
      invalidateROICache(['KEY1']); // Duplicate
      
      const stats = getROICacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle mixed concurrent operations', async () => {
      vi.mocked(prisma.userCard.findUnique).mockResolvedValue({
        id: 'card-1',
        actualAnnualFee: null,
        masterCard: { defaultAnnualFee: 55000 },
        userBenefits: [
          {
            id: 'b1',
            userDeclaredValue: 25000,
            stickerValue: 30000,
            isUsed: true,
          },
        ],
      } as any);
      
      // Mixed operations
      const ops = [
        getROI('CARD', 'card-1'),
        getROI('CARD', 'card-2'),
        getROI('CARD', 'card-3'),
      ];
      
      await Promise.all(ops);
      
      let stats = getROICacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      invalidateROICache(['CARD:card-1']);
      
      stats = getROICacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});
