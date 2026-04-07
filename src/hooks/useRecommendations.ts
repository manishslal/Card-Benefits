/**
 * Hook for fetching and managing benefit recommendations
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Recommendation } from '@/types/benefits';

interface UseRecommendationsState {
  recommendations: Recommendation[];
  loading: boolean;
  error: string | null;
}

export function useRecommendations(userId: string) {
  const [state, setState] = useState<UseRecommendationsState>({
    recommendations: [],
    loading: false,
    error: null,
  });

  // Fetch recommendations
  const fetchRecommendations = useCallback(async (limit = 5) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`/api/benefits/recommendations?limit=${limit}`);

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      setState((prev) => ({
        ...prev,
        recommendations: data.data || [],
        loading: false,
      }));
      return data.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  // Dismiss recommendation
  const dismissRecommendation = useCallback((recommendationId: string) => {
    setState((prev) => ({
      ...prev,
      recommendations: prev.recommendations.filter(
        (r) => r.id !== recommendationId
      ),
    }));
  }, []);

  // Refetch recommendations
  const refetch = useCallback(async () => {
    return fetchRecommendations();
  }, [fetchRecommendations]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchRecommendations();
    }
  }, [userId, fetchRecommendations]);

  return {
    recommendations: state.recommendations,
    loading: state.loading,
    error: state.error,
    fetchRecommendations,
    dismissRecommendation,
    refetch,
  };
}
