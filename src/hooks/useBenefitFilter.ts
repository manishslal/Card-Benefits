/**
 * Hook for filtering benefits
 * Applies multiple filter criteria with debouncing
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Benefit, FilterCriteria } from '@/types/benefits';

const DEBOUNCE_DELAY = 300;

export function useBenefitFilter(
  benefits: Benefit[],
  initialFilters: FilterCriteria = {}
) {
  const [filteredBenefits, setFilteredBenefits] = useState<Benefit[]>(benefits);
  const [filters, setFilters] = useState<FilterCriteria>(initialFilters);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced filter application
  const applyFilters = useCallback((newFilters: FilterCriteria) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setLoading(true);

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      const filtered = benefits.filter((benefit) => {
        // Status filter
        if (newFilters.status && newFilters.status.length > 0) {
          const status = determineStatus(benefit);
          if (!newFilters.status.includes(status)) {
            return false;
          }
        }

        // Value range filter
        const value = benefit.limit || 0;
        if (
          newFilters.minValue !== undefined &&
          value < newFilters.minValue
        ) {
          return false;
        }

        if (
          newFilters.maxValue !== undefined &&
          value > newFilters.maxValue
        ) {
          return false;
        }

        // Reset cadence filter
        if (
          newFilters.resetCadence &&
          newFilters.resetCadence.length > 0 &&
          !newFilters.resetCadence.includes(benefit.resetCadence)
        ) {
          return false;
        }

        // Expiration filter
        if (newFilters.expirationBefore && benefit.expirationDate) {
          if (benefit.expirationDate > newFilters.expirationBefore) {
            return false;
          }
        }

        // Search filter
        if (newFilters.searchTerm && newFilters.searchTerm.length > 0) {
          const term = newFilters.searchTerm.toLowerCase();
          const matches =
            benefit.name.toLowerCase().includes(term) ||
            (benefit.description &&
              benefit.description.toLowerCase().includes(term));
          if (!matches) {
            return false;
          }
        }

        return true;
      });

      setFilteredBenefits(filtered);
      setFilters(newFilters);
      setLoading(false);
    }, DEBOUNCE_DELAY);
  }, [benefits]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<FilterCriteria>) => {
    const combined = { ...filters, ...newFilters };
    applyFilters(combined);
  }, [filters, applyFilters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    applyFilters({});
  }, [applyFilters]);

  // Initialize with benefits
  useEffect(() => {
    applyFilters(filters);
  }, [benefits]);

  return {
    benefits: filteredBenefits,
    filters,
    loading,
    updateFilters,
    clearFilters,
    applyFilters,
  };
}

/**
 * Helper function to determine benefit status
 */
function determineStatus(benefit: Benefit): string {
  const now = new Date();

  if (benefit.expirationDate) {
    if (benefit.expirationDate < now) {
      return 'expired';
    }

    const daysUntilExpiration = Math.floor(
      (benefit.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration <= 7) {
      return 'expiring_soon';
    }
  }

  return 'active';
}
