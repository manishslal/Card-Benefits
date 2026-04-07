/**
 * useBenefitFilters Hook
 * Manage benefit filtering state with localStorage persistence
 */

import { useState, useCallback, useEffect } from 'react';
import type { BenefitFilters, FilterStatus, ResetCadence, BenefitCategory } from '@/features/benefits/types/benefits';

const STORAGE_KEY = 'benefit-filters';

export function useBenefitFilters(initialFilters?: BenefitFilters) {
  const [filters, setFilters] = useState<BenefitFilters>(() => {
    // Try to load from localStorage first
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored) as BenefitFilters;
      } catch (error) {
        console.error('Failed to load filters from storage:', error);
      }
    }
    return initialFilters || {};
  });

  // Persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
      } catch (error) {
        console.error('Failed to save filters to storage:', error);
      }
    }
  }, [filters]);

  const setStatus = useCallback((status: FilterStatus[]) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setCadence = useCallback((cadence: ResetCadence[]) => {
    setFilters((prev) => ({ ...prev, cadence }));
  }, []);

  const setValueRange = useCallback((minValue: number, maxValue: number) => {
    setFilters((prev) => ({ ...prev, minValue, maxValue }));
  }, []);

  const setCategories = useCallback((categories: BenefitCategory[]) => {
    setFilters((prev) => ({ ...prev, categories }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setSortBy = useCallback(
    (sortBy: 'name' | 'value' | 'usage' | 'daysRemaining', sortOrder?: 'asc' | 'desc') => {
      setFilters((prev) => ({
        ...prev,
        sortBy,
        sortOrder: sortOrder || prev.sortOrder || 'asc',
      }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = useCallback(() => {
    return Object.values(filters).some((v) => v !== undefined && v !== null && v !== '');
  }, [filters]);

  return {
    filters,
    setStatus,
    setCadence,
    setValueRange,
    setCategories,
    setSearchQuery,
    setSortBy,
    clearFilters,
    hasActiveFilters: hasActiveFilters(),
  };
}
