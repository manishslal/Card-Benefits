/**
 * useRecommendations Hook
 * Fetch and manage benefit recommendations
 */

import { useEffect, useState, useCallback } from 'react';
import type { BenefitRecommendationData, RecommendationsResponse } from '@/features/benefits/types/benefits';

interface RecommendationState {
  recommendations: BenefitRecommendationData[];
  loading: boolean;
  error: string | null;
  generatedAt: string | null;
}

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
const cache = new Map<string, { data: RecommendationsResponse; timestamp: number }>();

export function useRecommendations() {
  const [state, setState] = useState<RecommendationState>({
    recommendations: [],
    loading: false,
    error: null,
    generatedAt: null,
  });

  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'recommendations';

    // Check cache if not forcing refresh
    if (!forceRefresh && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        setState((prev) => ({
          ...prev,
          recommendations: cached.data.recommendations,
          generatedAt: cached.data.generatedAt,
          loading: false,
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/recommendations', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: RecommendationsResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch recommendations');
      }

      // Update cache
      cache.set(cacheKey, { data, timestamp: Date.now() });

      setState((prev) => ({
        ...prev,
        recommendations: data.recommendations,
        generatedAt: data.generatedAt,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
    }
  }, []);

  const dismissRecommendation = useCallback(async (recommendationId: string) => {
    try {
      const response = await fetch(`/api/recommendations/${recommendationId}/dismiss`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update local state
      setState((prev) => ({
        ...prev,
        recommendations: prev.recommendations.filter((r) => r.id !== recommendationId),
      }));

      // Clear cache
      cache.delete('recommendations');
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to dismiss recommendation',
      }));
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return {
    ...state,
    fetchRecommendations,
    dismissRecommendation,
  };
}
