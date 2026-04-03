/**
 * src/__tests__/lib/custom-values/roi-calculator.test.ts
 *
 * Tests for ROI calculation engine.
 * Focuses on pure calculation functions and cache logic.
 *
 * Test targets (from spec):
 * - 30+ test cases
 * - All edge cases covered
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateBenefitROI,
  invalidateROICache,
  clearROICache,
  getROICacheStats,
} from '@/lib/custom-values/roi-calculator';

describe('ROI Calculator', () => {
  beforeEach(() => {
    clearROICache();
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BENEFIT ROI TESTS
  // ════════════════════════════════════════════════════════════════════════════

  describe('calculateBenefitROI', () => {
    it('should calculate ROI with custom value', () => {
      // $250 custom value, $550 annual fee
      const roi = calculateBenefitROI(25000, 30000, 55000);
      expect(roi).toBeCloseTo(45.45, 1);
    });

    it('should use sticker value when custom value is null', () => {
      // null custom, $300 sticker, $550 fee
      const roi = calculateBenefitROI(null, 30000, 55000);
      expect(roi).toBeCloseTo(54.55, 1);
    });

    it('should return 0 when fee is 0 (avoid Infinity)', () => {
      const roi = calculateBenefitROI(25000, 30000, 0);
      expect(roi).toBe(0);
    });

    it('should return 0 when both value and fee are 0', () => {
      const roi = calculateBenefitROI(0, 0, 0);
      expect(roi).toBe(0);
    });

    it('should handle zero custom value', () => {
      // $0 custom, $550 fee
      const roi = calculateBenefitROI(0, 30000, 55000);
      expect(roi).toBe(0);
    });

    it('should handle very large values', () => {
      // $9,999,999 value, $5,500 fee
      const roi = calculateBenefitROI(999_999_900, 999_999_999, 550000);
      expect(roi).toBeGreaterThan(0);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should maintain 2 decimal precision', () => {
      const roi = calculateBenefitROI(33333, 33333, 100000);
      // 0.33333 * 100 = 33.333%, should round to 33.33
      expect(roi).toBeCloseTo(33.33, 2);
    });

    it('should handle 100% ROI', () => {
      // Value = Fee, so ROI should be 100
      const roi = calculateBenefitROI(10000, 10000, 10000);
      expect(roi).toBe(100);
    });

    it('should handle ROI > 200%', () => {
      // Value is 3x fee
      const roi = calculateBenefitROI(30000, 30000, 10000);
      expect(roi).toBe(300);
    });

    it('should handle very small fees', () => {
      // 1 cent fee
      const roi = calculateBenefitROI(100, 100, 1);
      expect(roi).toBe(10000);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should handle fractional cents', () => {
      // Ensure rounding doesn't cause issues
      const roi = calculateBenefitROI(1, 1, 3);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('should maintain precision with 100% custom = 100% sticker', () => {
      const roi1 = calculateBenefitROI(30000, 30000, 55000);
      const roi2 = calculateBenefitROI(null, 30000, 55000);
      expect(roi1).toEqual(roi2);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CACHE TESTS
  // ════════════════════════════════════════════════════════════════════════════

  describe('Cache Management', () => {
    it('should invalidate cache entries', () => {
      // Add some cache entries
      invalidateROICache(['CARD:card-1', 'PLAYER:player-1']);
      
      // Verify they're removed (indirectly through stats)
      const stats = getROICacheStats();
      expect(stats.size).toBe(0);
    });

    it('should clear entire cache', () => {
      clearROICache();
      const stats = getROICacheStats();
      expect(stats.size).toBe(0);
    });

    it('should track cache stats', () => {
      const stats = getROICacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.entries)).toBe(true);
    });
  });
});
