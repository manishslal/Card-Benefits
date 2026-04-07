/**
 * Hook Tests for useBenefitUsage
 * Tests CRUD operations, state management, loading/error states
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBenefitUsage } from '../useBenefitUsage';
import { UsageRecord } from '@/types/benefits';

// Mock fetch
global.fetch = vi.fn();

describe('useBenefitUsage Hook', () => {
  const mockBenefitId = 'benefit-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ Initial State & Fetching', () => {
    it('should initialize with empty records', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.records).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('should fetch usage records on mount', async () => {
      const mockRecords = [
        {
          id: 'usage-1',
          benefitId: mockBenefitId,
          userId: 'user-123',
          usageAmount: 5000,
          notes: 'Test usage',
          category: 'Travel',
          usageDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockRecords }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.records.length).toBe(1);
      expect(result.current.records[0].usageAmount).toBe(5000);
    });

    it('should set loading=true during fetch', async () => {
      let resolveRequest: Function;
      (global.fetch as any).mockReturnValue(
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
      );

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      expect(result.current.loading).toBe(true);

      resolveRequest!({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should clear error on successful fetch', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('✅ Create Usage', () => {
    it('should create a new usage record', async () => {
      const mockNewRecord: UsageRecord = {
        id: 'usage-new',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 7500,
        notes: 'New usage',
        category: 'Dining',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Create usage
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockNewRecord }),
      });

      const createdRecord = await result.current.createUsage(
        7500,
        'New usage',
        new Date(),
        'Dining'
      );

      expect(createdRecord.usageAmount).toBe(7500);
      expect(result.current.records[0].id).toBe('usage-new');
    });

    it('should handle create error', async () => {
      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Failed create
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid amount' }),
      });

      await expect(
        result.current.createUsage(5000, 'Test', new Date())
      ).rejects.toThrow('Invalid amount');

      expect(result.current.error).toBe('Invalid amount');
    });

    it('should add new record to the beginning of list', async () => {
      // Initial fetch with one record
      const initialRecord: UsageRecord = {
        id: 'usage-1',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 5000,
        notes: 'Initial',
        category: 'Travel',
        usageDate: new Date('2025-04-01'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [initialRecord] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.records.length).toBe(1);
      });

      // Create new record
      const newRecord: UsageRecord = {
        id: 'usage-new',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 7500,
        notes: 'New',
        category: 'Dining',
        usageDate: new Date('2025-04-15'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: newRecord }),
      });

      await result.current.createUsage(7500, 'New', new Date(), 'Dining');

      expect(result.current.records[0].id).toBe('usage-new');
      expect(result.current.records[1].id).toBe('usage-1');
    });
  });

  describe('✅ Update Usage', () => {
    it('should update an existing usage record', async () => {
      const initialRecord: UsageRecord = {
        id: 'usage-1',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 5000,
        notes: 'Original',
        category: 'Travel',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [initialRecord] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.records.length).toBe(1);
      });

      // Update usage
      const updatedRecord = {
        ...initialRecord,
        notes: 'Updated',
        usageAmount: 6000,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: updatedRecord }),
      });

      await result.current.updateUsage('usage-1', {
        notes: 'Updated',
        usageAmount: 6000,
      });

      expect(result.current.records[0].notes).toBe('Updated');
      expect(result.current.records[0].usageAmount).toBe(6000);
    });

    it('should handle update error', async () => {
      const initialRecord: UsageRecord = {
        id: 'usage-1',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 5000,
        notes: 'Original',
        category: 'Travel',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [initialRecord] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.records.length).toBe(1);
      });

      // Failed update
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Update failed' }),
      });

      await expect(
        result.current.updateUsage('usage-1', { notes: 'Updated' })
      ).rejects.toThrow('Update failed');

      expect(result.current.error).toBe('Update failed');
    });
  });

  describe('✅ Delete Usage', () => {
    it('should delete a usage record', async () => {
      const record1: UsageRecord = {
        id: 'usage-1',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 5000,
        notes: 'First',
        category: 'Travel',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const record2: UsageRecord = {
        id: 'usage-2',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 7500,
        notes: 'Second',
        category: 'Dining',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [record1, record2] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.records.length).toBe(2);
      });

      // Delete first record
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await result.current.deleteUsage('usage-1');

      expect(result.current.records.length).toBe(1);
      expect(result.current.records[0].id).toBe('usage-2');
    });

    it('should handle delete error', async () => {
      const record: UsageRecord = {
        id: 'usage-1',
        benefitId: mockBenefitId,
        userId: 'user-123',
        usageAmount: 5000,
        notes: 'Test',
        category: 'Travel',
        usageDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [record] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.records.length).toBe(1);
      });

      // Failed delete
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Delete failed' }),
      });

      await expect(result.current.deleteUsage('usage-1')).rejects.toThrow(
        'Delete failed'
      );

      expect(result.current.error).toBe('Delete failed');
      expect(result.current.records.length).toBe(1); // Record still there on error
    });
  });

  describe('🔄 Manual Fetch', () => {
    it('should fetch with custom page and pageSize', async () => {
      // Initial fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Manual fetch with different params
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await result.current.fetchUsage(2, 50);

      const lastCall = (global.fetch as any).mock.calls[
        (global.fetch as any).mock.calls.length - 1
      ][0];

      expect(lastCall).toContain('page=2');
      expect(lastCall).toContain('pageSize=50');
    });
  });

  describe('❌ Error Handling', () => {
    it('should handle network error on initial fetch', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.loading).toBe(false);
    });

    it('should set error to null on successful operation', async () => {
      // Initial fetch (no error)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { result } = renderHook(() => useBenefitUsage(mockBenefitId));

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });
});
