/**
 * Integration Tests for GET /api/benefits/progress
 * Tests progress calculation, status indicators, and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import * as authContext from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

vi.mock('@/features/auth/context/auth-context');
vi.mock('@/shared/lib/prisma');

describe('GET /api/benefits/progress', () => {
  const mockUserId = 'user-123';
  const mockPlayerId = 'player-456';
  const mockBenefitId = 'benefit-789';

  beforeEach(() => {
    vi.clearAllMocks();
    (authContext.getAuthUserId as any).mockReturnValue(mockUserId);
    (prisma.player.findFirst as any).mockResolvedValue({
      id: mockPlayerId,
      userId: mockUserId,
      isActive: true,
    });
  });

  describe('✅ Happy Path', () => {
    it('should calculate progress for benefit with usage', async () => {
      const request = new NextRequest(
        `http://localhost/api/benefits/progress?benefitId=${mockBenefitId}`
      );

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
        stickerValue: 20000,
        resetCadence: 'ANNUAL',
      });

      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([
        { usageAmount: 5000 },
      ]);

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.used).toBe(5000);
      expect(data.data.limit).toBe(20000);
      expect(data.data.percentage).toBe(25);
      expect(data.data.status).toBe('active');
    });

    it('should return correct status for 75% usage (warning)', async () => {
      const request = new NextRequest(
        `http://localhost/api/benefits/progress?benefitId=${mockBenefitId}`
      );

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
        stickerValue: 10000,
        resetCadence: 'MONTHLY',
      });

      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([
        { usageAmount: 7500 },
      ]);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.percentage).toBe(75);
      expect(data.data.status).toBe('warning');
    });
  });

  describe('❌ Error Cases', () => {
    it('should return 401 if user not authenticated', async () => {
      (authContext.getAuthUserId as any).mockReturnValue(null);

      const request = new NextRequest(
        `http://localhost/api/benefits/progress?benefitId=${mockBenefitId}`
      );

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return 400 if benefitId missing', async () => {
      const request = new NextRequest(
        'http://localhost/api/benefits/progress'
      );

      const response = await GET(request);
      expect(response.status).toBe(400);
    });
  });

  describe('🔄 Edge Cases', () => {
    it('should handle zero usage', async () => {
      const request = new NextRequest(
        `http://localhost/api/benefits/progress?benefitId=${mockBenefitId}`
      );

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
        stickerValue: 10000,
        resetCadence: 'ANNUAL',
      });

      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.used).toBe(0);
      expect(data.data.status).toBe('unused');
    });
  });
});
