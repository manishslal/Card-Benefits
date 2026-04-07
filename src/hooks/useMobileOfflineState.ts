/**
 * Hook for managing mobile offline state and sync
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { MobileOfflineState, SyncQueueItem } from '@/types/benefits';

export function useMobileOfflineState() {
  const [offlineState, setOfflineState] = useState<MobileOfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncInProgress: false,
    pendingSyncCount: 0,
    lastSyncTime: undefined,
    lastSyncError: undefined,
  });

  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOfflineState((prev) => ({
        ...prev,
        isOnline: true,
        lastSyncError: undefined,
      }));
      // Trigger sync when back online
      syncQueueToServer();
    };

    const handleOffline = () => {
      setOfflineState((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Add item to sync queue
  const queueForSync = useCallback((item: SyncQueueItem) => {
    setSyncQueue((prev) => [...prev, item]);
    setOfflineState((prev) => ({
      ...prev,
      pendingSyncCount: prev.pendingSyncCount + 1,
    }));

    // Store in localStorage for persistence
    const stored = localStorage.getItem('syncQueue') || '[]';
    const queue = JSON.parse(stored);
    queue.push(item);
    localStorage.setItem('syncQueue', JSON.stringify(queue));
  }, []);

  // Sync queue to server
  const syncQueueToServer = useCallback(async () => {
    if (!offlineState.isOnline || syncQueue.length === 0) {
      return;
    }

    setOfflineState((prev) => ({
      ...prev,
      syncInProgress: true,
    }));

    try {
      const response = await fetch('/api/mobile/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueItems: syncQueue }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();

      // Clear sync queue and localStorage
      setSyncQueue([]);
      localStorage.removeItem('syncQueue');

      setOfflineState((prev) => ({
        ...prev,
        syncInProgress: false,
        pendingSyncCount: 0,
        lastSyncTime: new Date(),
        lastSyncError: undefined,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setOfflineState((prev) => ({
        ...prev,
        syncInProgress: false,
        lastSyncError: errorMessage,
      }));
      throw error;
    }
  }, [syncQueue, offlineState.isOnline]);

  // Load sync queue from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('syncQueue') || '[]';
    const queue = JSON.parse(stored);
    setSyncQueue(queue);
    setOfflineState((prev) => ({
      ...prev,
      pendingSyncCount: queue.length,
    }));
  }, []);

  return {
    offlineState,
    syncQueue,
    queueForSync,
    syncQueueToServer,
  };
}
