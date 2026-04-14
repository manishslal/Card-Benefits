'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * F-4: Pull-to-Refresh Hook for Mobile
 *
 * Tracks touchstart/touchmove/touchend events on the document.
 * Only activates when scrolled to top (scrollTop === 0).
 * Shows a spinner indicator when pulled past threshold (~80px).
 * Calls the provided refresh callback and animates back when done.
 * Only active on mobile viewports via matchMedia.
 *
 * Returns:
 * - isRefreshing: whether the refresh callback is running
 * - pullProgress: 0–1 value for how far the user has pulled (for animation)
 * - pullOffset: pixel offset for the pull indicator
 * - containerRef: ref to attach to the scroll container
 */

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  isEnabled?: boolean;
}

interface UsePullToRefreshResult {
  isRefreshing: boolean;
  pullOffset: number;
  pullProgress: number;
  indicatorRef: React.RefObject<HTMLDivElement | null>;
}

export function usePullToRefresh({
  onRefresh,
  isEnabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const isMobile = useRef(false);

  // Check if mobile viewport on mount and resize
  useEffect(() => {
    if (!isEnabled) return;

    const checkMobile = () => {
      isMobile.current = window.matchMedia('(max-width: 767px)').matches;
    };
    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isEnabled]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!isMobile.current || !isEnabled || isRefreshing) return;

      // Only activate when scrolled to top
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 0) return;

      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    },
    [isEnabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || !isMobile.current || !isEnabled || isRefreshing) return;

      const touchY = e.touches[0].clientY;
      const diff = touchY - touchStartY.current;

      // Only handle downward pulls
      if (diff <= 0) {
        setPullOffset(0);
        return;
      }

      // Apply rubber-band effect (diminishing returns)
      const dampened = Math.min(diff * 0.5, MAX_PULL);
      setPullOffset(dampened);

      // Prevent page scroll while pulling
      if (dampened > 10) {
        e.preventDefault();
      }
    },
    [isEnabled, isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || !isMobile.current || !isEnabled) return;

    isPulling.current = false;

    if (pullOffset >= PULL_THRESHOLD && !isRefreshing) {
      // Snap to a fixed offset while refreshing
      setPullOffset(PULL_THRESHOLD * 0.6);
      setIsRefreshing(true);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullOffset(0);
      }
    } else {
      // Snap back
      setPullOffset(0);
    }
  }, [pullOffset, isRefreshing, onRefresh, isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isEnabled]);

  const pullProgress = Math.min(pullOffset / PULL_THRESHOLD, 1);

  return {
    isRefreshing,
    pullOffset,
    pullProgress,
    indicatorRef,
  };
}
