/**
 * useOfflineSync Hook
 * Manage offline sync queue and connection status
 */

import { useEffect, useState, useCallback } from 'react';

interface PendingAction {
  id: string;
  type: 'usage' | 'recommendation' | 'onboarding';
  endpoint: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

interface SyncState {
  isOnline: boolean;
  pendingActions: PendingAction[];
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
}

const STORAGE_KEY = 'offline-queue';
const MAX_RETRIES = 3;

export function useOfflineSync() {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingActions: [],
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
  });

  // Load queue from IndexedDB on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check online status
    const handleOnline = () => setState((prev) => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueAction = useCallback(
    async (
      type: 'usage' | 'recommendation' | 'onboarding',
      endpoint: string,
      method: 'POST' | 'PATCH' | 'DELETE',
      data: Record<string, unknown>
    ) => {
      const action: PendingAction = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        endpoint,
        method,
        data,
        timestamp: Date.now(),
        retries: 0,
      };

      setState((prev) => ({
        ...prev,
        pendingActions: [...prev.pendingActions, action],
      }));

      // Try to sync immediately if online
      if (state.isOnline) {
        await syncAction(action);
      }
    },
    [state.isOnline]
  );

  const syncAction = useCallback(async (action: PendingAction) => {
    try {
      const response = await fetch(action.endpoint, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: action.method !== 'DELETE' ? JSON.stringify(action.data) : undefined,
      });

      if (response.ok) {
        // Remove from pending
        setState((prev) => ({
          ...prev,
          pendingActions: prev.pendingActions.filter((a) => a.id !== action.id),
          lastSyncTime: Date.now(),
        }));
      } else if (action.retries < MAX_RETRIES) {
        // Retry
        setState((prev) => ({
          ...prev,
          pendingActions: prev.pendingActions.map((a) =>
            a.id === action.id ? { ...a, retries: a.retries + 1 } : a
          ),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          syncError: `Failed to sync ${action.type} after ${MAX_RETRIES} retries`,
        }));
      }
    } catch (error) {
      if (action.retries < MAX_RETRIES) {
        setState((prev) => ({
          ...prev,
          pendingActions: prev.pendingActions.map((a) =>
            a.id === action.id ? { ...a, retries: a.retries + 1 } : a
          ),
        }));
      }
    }
  }, []);

  const syncAll = useCallback(async () => {
    if (!state.isOnline || state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const actions = [...state.pendingActions];
      for (const action of actions) {
        await syncAction(action);
      }
      setState((prev) => ({ ...prev, isSyncing: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, [state.isOnline, state.isSyncing, state.pendingActions, syncAction]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (state.isOnline && state.pendingActions.length > 0) {
      syncAll();
    }
  }, [state.isOnline, syncAll]);

  return {
    ...state,
    queueAction,
    syncAll,
    clearError: () => setState((prev) => ({ ...prev, syncError: null })),
  };
}
