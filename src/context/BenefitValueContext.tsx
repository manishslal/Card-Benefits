/**
 * src/context/BenefitValueContext.tsx
 *
 * React Context for managing benefit values and ROI state globally.
 *
 * Provides:
 * - Real-time ROI cache management
 * - Centralized benefit value updates
 * - ROI invalidation on value changes
 * - Loading/error state management
 *
 * Design:
 * - Provider wraps entire dashboard
 * - useROI hook provides access to ROI data and functions
 * - Automatic cache invalidation when values update
 */

'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { getROI, invalidateROICache, clearROICache } from '@/lib/custom-values/roi-calculator';

/**
 * Context type definition
 */
interface BenefitValueContextType {
  // ROI cache with TTL
  roiCache: Map<string, { value: number; cachedAt: Date }>;

  // Operations
  getROI: (level: string, id: string, options?: { bypassCache?: boolean }) => Promise<number>;
  invalidateROI: (level: string, ids: string[]) => Promise<void>;
  clearCache: () => void;

  // UI state
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

/**
 * Create the context
 */
export const BenefitValueContext = createContext<BenefitValueContextType | null>(null);

/**
 * Provider component to wrap sections needing ROI state
 */
export function BenefitValueProvider({ children }: { children: React.ReactNode }) {
  const [roiCache] = useState(
    new Map<string, { value: number; cachedAt: Date }>()
  );
  const [isLoading] = useState(false); // Unused - reserved for future use
  const [error, setError] = useState<string | null>(null);

  /**
   * Get ROI with caching and error handling
   */
  const handleGetROI = useCallback(
    async (
      level: string,
      id: string,
      options?: { bypassCache?: boolean }
    ): Promise<number> => {
      try {
        setError(null);
        const roi = await getROI(
          level as 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
          id,
          options
        );
        return roi;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to calculate ROI';
        setError(message);
        throw err;
      }
    },
    []
  );

  /**
   * Invalidate ROI cache for affected entities
   */
  const handleInvalidateROI = useCallback(
    async (level: string, ids: string[]): Promise<void> => {
      try {
        setError(null);
        const keys = ids.map(id => `${level}:${id}`);
        invalidateROICache(keys);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to invalidate cache';
        setError(message);
        throw err;
      }
    },
    []
  );

  /**
   * Clear entire cache
   */
  const handleClearCache = useCallback(() => {
    try {
      setError(null);
      clearROICache();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(message);
    }
  }, []);

  const value: BenefitValueContextType = {
    roiCache,
    getROI: handleGetROI,
    invalidateROI: handleInvalidateROI,
    clearCache: handleClearCache,
    isLoading,
    error,
    setError,
  };

  return (
    <BenefitValueContext.Provider value={value}>
      {children}
    </BenefitValueContext.Provider>
  );
}

/**
 * Hook to use ROI context
 * Must be called within BenefitValueProvider
 */
export function useROI(): BenefitValueContextType {
  const context = useContext(BenefitValueContext);
  if (!context) {
    throw new Error('useROI must be used within BenefitValueProvider');
  }
  return context;
}

/**
 * Convenience hook for getting a specific ROI value
 */
export function useROIValue(
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
  id: string
): { roi: number | null; isLoading: boolean; error: string | null } {
  const { getROI: getRoiFn, isLoading, error } = useROI();
  const [roi, setROI] = React.useState<number | null>(null);
  const [localLoading, setLocalLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const fetchROI = async () => {
      try {
        setLocalLoading(true);
        const value = await getRoiFn(level, id);
        if (!cancelled) {
          setROI(value);
        }
      } catch (err) {
        if (!cancelled) {
          setROI(null);
        }
      } finally {
        if (!cancelled) {
          setLocalLoading(false);
        }
      }
    };

    fetchROI();

    return () => {
      cancelled = true;
    };
  }, [level, id, getRoiFn]);

  return {
    roi,
    isLoading: localLoading || isLoading,
    error,
  };
}
