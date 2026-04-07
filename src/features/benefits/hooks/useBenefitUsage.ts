/**
 * useBenefitUsage Hook
 * Fetch and manage benefit usage history with pagination and caching
 */

import { useEffect, useState, useCallback } from 'react';
import type { BenefitUsageRecord, UsageHistoryResponse } from '@/features/benefits/types/benefits';

interface UsageState {
  records: BenefitUsageRecord[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  pages: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useBenefitUsage(benefitId: string, initialPage = 1) {
  const [state, setState] = useState<UsageState>({
    records: [],
    loading: false,
    error: null,
    page: initialPage,
    total: 0,
    pages: 0,
  });

  const [cache, setCache] = useState<Map<string, { data: UsageHistoryResponse; timestamp: number }>>(
    new Map()
  );

  const cacheKey = `usage-${benefitId}-${state.page}`;

  const fetchUsage = useCallback(
    async (page: number = 1) => {
      const currentCacheKey = `usage-${benefitId}-${page}`;

      // Check cache
      if (cache.has(currentCacheKey)) {
        const cached = cache.get(currentCacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          setState((prev) => ({
            ...prev,
            records: cached.data.usageRecords,
            total: cached.data.pagination?.total || 0,
            pages: cached.data.pagination?.pages || 0,
            page,
          }));
          return;
        }
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const response = await fetch(
          `/api/benefits/${benefitId}/usage?page=${page}&limit=20`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: UsageHistoryResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch usage');
        }

        // Update cache
        setCache((prev) => new Map(prev).set(currentCacheKey, { data, timestamp: Date.now() }));

        setState((prev) => ({
          ...prev,
          records: data.usageRecords,
          total: data.pagination?.total || 0,
          pages: data.pagination?.pages || 0,
          page,
          loading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
          loading: false,
        }));
      }
    },
    [benefitId, cache]
  );

  useEffect(() => {
    fetchUsage(state.page);
  }, [benefitId, state.page]);

  const goToPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const refresh = useCallback(() => {
    setCache(new Map());
    fetchUsage(1);
  }, [fetchUsage]);

  return {
    ...state,
    goToPage,
    refresh,
  };
}
