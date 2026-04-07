/**
 * Unit & Integration Tests for POST/GET /api/benefits/usage
 * Tests usage record creation, retrieval, pagination, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import * as authContext from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

// Mock dependencies
vi.mock('@/features/auth/context/auth-context');
vi.mock('@/shared/lib/prisma');

describe('POST /api/benefits/usage', () => {
  const mockUserId = 'user-123';
  const mockBenefitId = 'benefit-456';

  beforeEach(() => {
    vi.clearAllMocks();
    (authContext.getAuthUserId as any).mockReturnValue(mockUserId);
  });

  describe('✅ Happy Path', () => {
    it('should create a usage record with valid input', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000, // $50
          notes: 'Used airline credit for flight',
          category: 'Travel',
          usageDate: '2025-04-15T00:00:00Z',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
        name: 'Airline Fee Credit',
        stickerValue: 20000,
      });

      (prisma.benefitUsageRecord.create as any).mockResolvedValue({
        id: 'usage-789',
        benefitId: mockBenefitId,
        userId: mockUserId,
        usageAmount: 5000,
        notes: 'Used airline credit for flight',
        category: 'Travel',
        usageDate: new Date('2025-04-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.usageAmount).toBe(5000);
      expect(data.data.notes).toBe('Used airline credit for flight');
      expect(data.message).toBe('Usage record created successfully');
    });

    it('should create usage record with minimum required fields', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 2500,
          notes: 'Test note',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
      });

      (prisma.benefitUsageRecord.create as any).mockResolvedValue({
        id: 'usage-789',
        benefitId: mockBenefitId,
        userId: mockUserId,
        usageAmount: 2500,
        notes: 'Test note',
        category: null,
        usageDate: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('❌ Error Cases - Authentication', () => {
    it('should return 401 if user not authenticated', async () => {
      (authContext.getAuthUserId as any).mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('❌ Input Validation Errors', () => {
    it('should return 400 if benefitId missing', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          usageAmount: 5000,
          notes: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('benefitId');
    });

    it('should return 400 if usageAmount is 0 or negative', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 0,
          notes: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('usageAmount');
    });

    it('should return 400 if usageAmount is negative', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: -1000,
          notes: 'Test',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should return 400 if notes exceed 500 characters', async () => {
      const longNotes = 'a'.repeat(501);
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: longNotes,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('500 characters');
    });

    it('should accept notes with exactly 500 characters', async () => {
      const validNotes = 'a'.repeat(500);
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: validNotes,
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
      });

      (prisma.benefitUsageRecord.create as any).mockResolvedValue({
        id: 'usage-789',
        benefitId: mockBenefitId,
        userId: mockUserId,
        usageAmount: 5000,
        notes: validNotes,
        category: null,
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });

  describe('❌ Authorization', () => {
    it('should return 404 if benefit not found', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: 'nonexistent',
          usageAmount: 5000,
          notes: 'Test',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue(null);

      const response = await POST(request);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Benefit not found');
    });

    it('should return 404 if benefit does not belong to user', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: 'Test',
        }),
      });

      // Benefit exists but doesn't belong to user
      (prisma.userBenefit.findFirst as any).mockResolvedValue(null);

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  describe('🔄 Edge Cases', () => {
    it('should accept very large amount (999999 cents)', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 999999.99,
          notes: 'Large charge',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
      });

      (prisma.benefitUsageRecord.create as any).mockResolvedValue({
        id: 'usage-789',
        benefitId: mockBenefitId,
        userId: mockUserId,
        usageAmount: 999999.99,
        notes: 'Large charge',
        category: null,
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    // QA-005: Test max amount validation
    it('should reject amount over 999999.99 (QA-005)', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 1000000,
          notes: 'Too large',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid amount');
    });

    // QA-006: Test future date validation
    it('should reject future usage date (QA-006)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: 'Future usage',
          usageDate: tomorrow.toISOString(),
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('future dates');
    });

    // QA-007: Test duplicate prevention
    it('should reject duplicate usage on same date (QA-007)', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: 'Duplicate',
          usageDate: '2025-04-15T00:00:00Z',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
      });

      // Simulate unique constraint violation
      (prisma.benefitUsageRecord.create as any).mockRejectedValue({
        code: 'P2002',
        message: 'Unique constraint failed',
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already recorded');
    });

    it('should set usageDate to current time if not provided', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage', {
        method: 'POST',
        body: JSON.stringify({
          benefitId: mockBenefitId,
          usageAmount: 5000,
          notes: 'Test without date',
        }),
      });

      (prisma.userBenefit.findFirst as any).mockResolvedValue({
        id: mockBenefitId,
      });

      (prisma.benefitUsageRecord.create as any).mockResolvedValue({
        id: 'usage-789',
        benefitId: mockBenefitId,
        userId: mockUserId,
        usageAmount: 5000,
        notes: 'Test without date',
        category: null,
        usageDate: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });
});

describe('GET /api/benefits/usage', () => {
  const mockUserId = 'user-123';
  const mockBenefitId = 'benefit-456';

  beforeEach(() => {
    vi.clearAllMocks();
    (authContext.getAuthUserId as any).mockReturnValue(mockUserId);
  });

  describe('✅ Happy Path', () => {
    it('should return usage records for authenticated user', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage');

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(5);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([
        {
          id: 'usage-1',
          benefitId: mockBenefitId,
          userId: mockUserId,
          usageAmount: 5000,
          notes: 'First usage',
          category: 'Travel',
          usageDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.total).toBe(5);
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(20);
    });

    it('should filter by benefitId', async () => {
      const request = new NextRequest(
        `http://localhost/api/benefits/usage?benefitId=${mockBenefitId}`
      );

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(3);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([
        {
          id: 'usage-1',
          benefitId: mockBenefitId,
          userId: mockUserId,
          usageAmount: 5000,
          notes: 'Usage 1',
          category: null,
          usageDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(3);
    });

    it('should support pagination', async () => {
      const request = new NextRequest(
        'http://localhost/api/benefits/usage?page=2&pageSize=10'
      );

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(25);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.page).toBe(2);
      expect(data.pageSize).toBe(10);
      expect(data.hasMore).toBe(true);
    });

    it('should sort by usageDate in descending order by default', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage');

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(1);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      await GET(request);

      expect(prisma.benefitUsageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { usageDate: 'desc' },
        })
      );
    });

    it('should allow sorting by createdAt', async () => {
      const request = new NextRequest(
        'http://localhost/api/benefits/usage?sortBy=createdAt&sortOrder=asc'
      );

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(1);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      await GET(request);

      expect(prisma.benefitUsageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });
  });

  describe('❌ Authentication Errors', () => {
    it('should return 401 if user not authenticated', async () => {
      (authContext.getAuthUserId as any).mockReturnValue(null);

      const request = new NextRequest('http://localhost/api/benefits/usage');

      const response = await GET(request);
      expect(response.status).toBe(401);
    });
  });

  describe('🔄 Edge Cases', () => {
    it('should return empty array if no records found', async () => {
      const request = new NextRequest('http://localhost/api/benefits/usage');

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(0);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual([]);
      expect(data.total).toBe(0);
      expect(data.hasMore).toBe(false);
    });

    it('should handle large page numbers gracefully', async () => {
      const request = new NextRequest(
        'http://localhost/api/benefits/usage?page=9999&pageSize=20'
      );

      (prisma.benefitUsageRecord.count as any).mockResolvedValue(100);
      (prisma.benefitUsageRecord.findMany as any).mockResolvedValue([]);

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.hasMore).toBe(false);
    });
  });
});
