/**
 * Hook for managing benefit usage records
 * Handles CRUD operations and state management for usage data
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { UsageRecord } from '@/types/benefits';

interface UseBenefitUsageState {
  records: UsageRecord[];
  loading: boolean;
  error: string | null;
}

export function useBenefitUsage(benefitId: string) {
  const [state, setState] = useState<UseBenefitUsageState>({
    records: [],
    loading: false,
    error: null,
  });

  // Fetch usage records
  const fetchUsage = useCallback(async (page = 1, pageSize = 20) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(
        `/api/benefits/usage?benefitId=${benefitId}&page=${page}&pageSize=${pageSize}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch usage records');
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        records: data.data.map((r: any) => ({
          ...r,
          date: new Date(r.date),
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.updatedAt),
        })),
        loading: false,
      }));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, [benefitId]);

  // Create usage record
  const createUsage = useCallback(async (
    amount: number,
    description: string,
    date: Date,
    category?: string
  ) => {
    try {
      const response = await fetch('/api/benefits/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benefitId,
          amount,
          description,
          date,
          category,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create usage record');
      }

      const data = await response.json();
      const newRecord = {
        ...data.data,
        date: new Date(data.data.date),
        createdAt: new Date(data.data.createdAt),
        updatedAt: new Date(data.data.updatedAt),
      };

      setState((prev) => ({
        ...prev,
        records: [newRecord, ...prev.records],
      }));

      return newRecord;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [benefitId]);

  // Update usage record
  const updateUsage = useCallback(async (
    id: string,
    updates: Partial<UsageRecord>
  ) => {
    try {
      const response = await fetch(`/api/benefits/usage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update usage record');
      }

      const data = await response.json();
      const updated = {
        ...data.data,
        date: new Date(data.data.date),
        createdAt: new Date(data.data.createdAt),
        updatedAt: new Date(data.data.updatedAt),
      };

      setState((prev) => ({
        ...prev,
        records: prev.records.map((r) =>
          r.id === id ? updated : r
        ),
      }));

      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Delete usage record (soft delete)
  const deleteUsage = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/benefits/usage/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete usage record');
      }

      setState((prev) => ({
        ...prev,
        records: prev.records.filter((r) => r.id !== id),
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    records: state.records,
    loading: state.loading,
    error: state.error,
    fetchUsage,
    createUsage,
    updateUsage,
    deleteUsage,
  };
}
