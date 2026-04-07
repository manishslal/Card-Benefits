/**
 * useBenefitProgress Hook
 * Calculate and cache benefit progress for current period
 */

import { useEffect, useState, useCallback } from 'react';
import type { BenefitProgress, ProgressResponse } from '@/features/benefits/types/benefits';

interface ProgressState {
  progress: BenefitProgress | null;
  loading: boolean;
  error: string | null;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: BenefitProgress; timestamp: number }>();

export function useBenefitProgress(benefitId: string) {
  const [state, setState] = useState<ProgressState>({
    progress: null,
    loading: false,
    error: null,
  });

  const fetchProgress = useCallback(async () => {
    const cacheKey = `progress-${benefitId}`;

    // Check cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        setState((prev) => ({ ...prev, progress: cached.data, loading: false }));
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(`/api/benefits/${benefitId}/progress`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ProgressResponse = await response.json();

      if (!data.success || !data.progress || 'benefitId' in data.progress === false) {
        throw new Error(data.error || 'Failed to fetch progress');
      }

      const progress = data.progress as BenefitProgress;

      // Update cache
      cache.set(cacheKey, { data: progress, timestamp: Date.now() });

      setState((prev) => ({
        ...prev,
        progress,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
    }
  }, [benefitId]);

  useEffect(() => {
    fetchProgress();
  }, [benefitId, fetchProgress]);

  const refresh = useCallback(() => {
    cache.delete(`progress-${benefitId}`);
    fetchProgress();
  }, [benefitId, fetchProgress]);

  return {
    ...state,
    refresh,
  };
}
