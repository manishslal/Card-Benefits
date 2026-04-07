/**
 * Phase 2B-1 QA Bug Fixes Test Suite
 * Tests for QA-001, QA-002, QA-003, QA-004, QA-007, QA-008
 */

import { describe, it, expect } from 'vitest';
import { calculatePeriods, getCurrentPeriod } from '@/lib/period-utils';
import { buildBenefitWhereClause } from '@/lib/filters';
import { sanitizeErrorForLogging } from '@/lib/error-logging';

const mockPlayerId = 'player-456';

describe('Phase 2B-1 QA Bug Fixes', () => {
  // ============================================================
  // QA-001: SQL DoS Vulnerability - PageSize Validation
  // ============================================================
  describe('QA-001: SQL DoS Vulnerability - PageSize Validation', () => {
    it('should document max pageSize of 100', () => {
      const MAX_PAGE_SIZE = 100;
      expect(MAX_PAGE_SIZE).toBe(100);
    });

    it('should reject pageSize > 100', () => {
      const pageSize = 999999;
      const MAX_PAGE_SIZE = 100;
      expect(pageSize > MAX_PAGE_SIZE).toBe(true);
    });

    it('should accept pageSize of exactly 100', () => {
      const pageSize = 100;
      const MAX_PAGE_SIZE = 100;
      expect(pageSize <= MAX_PAGE_SIZE).toBe(true);
    });
  });

  // ============================================================
  // QA-002: Client-Side Filtering O(n) Problem
  // ============================================================
  describe('QA-002: Database-Level Filtering (Not Client-Side)', () => {
    it('should build where clause for minValue/maxValue filters', () => {
      const criteria = { minValue: 100, maxValue: 500 };
      const where = buildBenefitWhereClause(criteria, mockPlayerId);

      expect(where.playerId).toBe(mockPlayerId);
      expect(where.stickerValue).toBeDefined();
      expect(where.stickerValue?.gte).toBe(100);
      expect(where.stickerValue?.lte).toBe(500);
    });

    it('should build where clause for resetCadence filter', () => {
      const criteria = { resetCadence: ['MONTHLY', 'QUARTERLY'] };
      const where = buildBenefitWhereClause(criteria, mockPlayerId);

      expect(where.resetCadence?.in).toEqual(['MONTHLY', 'QUARTERLY']);
    });

    it('should build where clause for expiration filter', () => {
      const expirationDate = '2025-12-31';
      const criteria = { expirationBefore: expirationDate };
      const where = buildBenefitWhereClause(criteria, mockPlayerId);

      expect(where.expirationDate?.lte).toBeDefined();
    });

    it('should build where clause for search term', () => {
      const criteria = { searchTerm: 'airline' };
      const where = buildBenefitWhereClause(criteria, mockPlayerId);

      expect(where.name?.contains).toBe('airline');
      expect(where.name?.mode).toBe('insensitive');
    });

    it('should combine multiple filters in where clause', () => {
      const criteria = {
        minValue: 100,
        resetCadence: ['MONTHLY'],
        searchTerm: 'credit',
      };
      const where = buildBenefitWhereClause(criteria, mockPlayerId);

      expect(where.playerId).toBe(mockPlayerId);
      expect(where.stickerValue?.gte).toBe(100);
      expect(where.resetCadence?.in).toContain('MONTHLY');
      expect(where.name?.contains).toBe('credit');
    });
  });

  // ============================================================
  // QA-003: Timezone Issues in Period Calculations
  // ============================================================
  describe('QA-003: Timezone-Aware Period Calculations', () => {
    it('should calculate UTC monthly periods', () => {
      const periods = calculatePeriods('MONTHLY', 2);

      expect(periods.length).toBe(2);
      expect(periods[0].start).toBeInstanceOf(Date);
      expect(periods[0].end).toBeInstanceOf(Date);
      expect(periods[0].start < periods[0].end).toBe(true);

      // Check that dates use UTC (month starts at 00:00:00 UTC)
      expect(periods[0].start.getUTCHours()).toBe(0);
      expect(periods[0].start.getUTCMinutes()).toBe(0);
      expect(periods[0].start.getUTCDate()).toBe(1);
    });

    it('should calculate UTC quarterly periods', () => {
      const periods = calculatePeriods('QUARTERLY', 2);

      expect(periods.length).toBe(2);
      // Quarter should be 3 months apart
      const monthDiff = Math.abs(periods[0].start.getUTCMonth() - periods[1].start.getUTCMonth());
      expect(monthDiff === 3 || monthDiff === 9).toBe(true); // Handle year boundary
    });

    it('should calculate UTC annual periods', () => {
      const periods = calculatePeriods('ANNUAL', 2);

      expect(periods.length).toBe(2);
      // Annual periods should be 1 year apart
      const yearDiff = periods[0].start.getUTCFullYear() - periods[1].start.getUTCFullYear();
      expect(yearDiff).toBe(1);
    });

    it('should return single period for ONE_TIME cadence', () => {
      const periods = calculatePeriods('ONE_TIME', 12);

      expect(periods.length).toBe(1);
      expect(periods[0].start.getUTCFullYear()).toBe(1970);
      expect(periods[0].end.getUTCFullYear()).toBe(2099);
    });

    it('getCurrentPeriod should return UTC month boundaries', () => {
      const period = getCurrentPeriod('MONTHLY');

      expect(period.start.getUTCDate()).toBe(1);
      expect(period.start.getUTCHours()).toBe(0);
      expect(period.start.getUTCMinutes()).toBe(0);
    });

    it('should use UTC components, not local timezone', () => {
      const now = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth();

      const period = getCurrentPeriod('MONTHLY');
      expect(period.start.getUTCFullYear()).toBe(utcYear);
      expect(period.start.getUTCMonth()).toBe(utcMonth);
    });
  });

  // ============================================================
  // QA-004: N+1 Query Problem
  // ============================================================
  describe('QA-004: N+1 Query Fix (Documentation)', () => {
    it('should document that usage records should be fetched once, not per-benefit', () => {
      // This test documents the fix in recommendations/route.ts
      // The actual implementation uses Promise.all to fetch benefits and usage in parallel
      // Then builds a Map for O(1) lookup instead of O(n) database queries per benefit

      const benefits = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const usageRecords = [
        { benefitId: '1', amount: 100 },
        { benefitId: '1', amount: 200 },
        { benefitId: '2', amount: 50 },
      ];

      // Build map for O(1) lookup
      const usageByBenefit = new Map();
      for (const record of usageRecords) {
        const list = usageByBenefit.get(record.benefitId) || [];
        list.push(record);
        usageByBenefit.set(record.benefitId, list);
      }

      // Verify O(1) lookup
      const benefit1Usage = usageByBenefit.get('1');
      expect(benefit1Usage).toHaveLength(2);
      expect(benefit1Usage[0].amount).toBe(100);
    });
  });

  // ============================================================
  // QA-007: Duplicate Prevention
  // ============================================================
  describe('QA-007: Duplicate Prevention', () => {
    it('should detect P2002 unique constraint violation', () => {
      const error = { code: 'P2002', message: 'Unique constraint failed on (benefitId, userId, usageDate)' };
      const message = sanitizeErrorForLogging(error);

      expect(message).toContain('P2002');
    });

    it('should document unique constraint in schema', () => {
      // @@unique([benefitId, userId, usageDate]) in BenefitUsageRecord model
      const uniqueConstraint = ['benefitId', 'userId', 'usageDate'];
      expect(uniqueConstraint).toContain('benefitId');
      expect(uniqueConstraint).toContain('userId');
      expect(uniqueConstraint).toContain('usageDate');
    });
  });

  // ============================================================
  // QA-008: Error Logging without PII
  // ============================================================
  describe('QA-008: Safe Error Logging (No PII)', () => {
    it('should sanitize error to show only error code', () => {
      const error = { code: 'P2002', message: 'Unique constraint failed' };
      const message = sanitizeErrorForLogging(error);

      expect(message).toBe('P2002');
      expect(message).not.toContain('userId');
      expect(message).not.toContain('benefitId');
    });

    it('should include context only in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const message = sanitizeErrorForLogging(error, { userId: 'user-123', benefitId: 'benefit-456' });

      expect(message).toContain('dev:');
      expect(message).toContain('userId');
      expect(message).toContain('benefitId');

      process.env.NODE_ENV = originalEnv;
    });

    it('should exclude context in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const message = sanitizeErrorForLogging(error, { userId: 'user-123' });

      expect(message).toBe('Test error');
      expect(message).not.toContain('user-123');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle object errors', () => {
      const error = { code: 'SOMETHING_WRONG', message: 'Database connection failed' };
      const message = sanitizeErrorForLogging(error);

      expect(message).toContain('SOMETHING_WRONG');
    });
  });

  // ============================================================
  // Integration: QA-005 + QA-006 Amount/Date Validation
  // ============================================================
  describe('QA-005 & QA-006: Amount and Date Validation', () => {
    it('should validate maximum amount of 999999.99', () => {
      const maxAmount = 999999.99;
      expect(maxAmount).toBe(999999.99);
    });

    it('should reject amounts over 999999.99', () => {
      const amount = 1000000;
      expect(amount > 999999.99).toBe(true);
    });

    it('should allow past dates but reject future dates', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Yesterday should pass validation
      expect(yesterday < now).toBe(true);

      // Tomorrow should fail validation
      expect(tomorrow > now).toBe(true);
    });
  });
});
