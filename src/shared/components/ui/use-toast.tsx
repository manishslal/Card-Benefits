'use client';

/**
 * Simple toast hook for user notifications.
 * Provides success, error, and info notifications.
 *
 * The global store + listener pattern lets both the `useToast` hook
 * and the standalone `toast()` function work from anywhere in the app.
 * The `Toaster` component (toaster.tsx) subscribes to the same store
 * and renders all active toasts — do NOT add a second renderer here.
 */

import { useState, useEffect } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error' | 'info';
  duration?: number;
}

// ---------------------------------------------------------------------------
// Global toast store
// ---------------------------------------------------------------------------
let toastStore: Toast[] = [];
const listeners: Set<(toasts: Toast[]) => void> = new Set();

// Timeout tracking map — allows clearing auto-dismiss on manual dismiss (M2)
const timeoutMap = new Map<string, NodeJS.Timeout>();

export const addToastListener = (listener: (toasts: Toast[]) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener([...toastStore]));
};

let idCounter = 0;
function generateId(): string {
  return `toast-${Date.now()}-${++idCounter}`;
}

function addToastToStore(toast: Omit<Toast, 'id'>): string {
  const id = generateId();
  const newToast: Toast = { ...toast, id };
  toastStore.push(newToast);
  notifyListeners();

  // Auto-remove after duration (cancelable via removeToastFromStore)
  if (toast.duration !== 0) {
    const duration = toast.duration || 5000;
    const timeoutId = setTimeout(() => {
      removeToastFromStore(id);
      timeoutMap.delete(id);
    }, duration);
    timeoutMap.set(id, timeoutId);
  }

  return id;
}

export const removeToastFromStore = (id: string) => {
  // Clear any pending auto-dismiss timeout (M2)
  const timeoutId = timeoutMap.get(id);
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutMap.delete(id);
  }
  toastStore = toastStore.filter((t) => t.id !== id);
  notifyListeners();
};

/**
 * Public `toast()` function – can be called from anywhere.
 */
export function toast(props: Omit<Toast, 'id'>): string {
  return addToastToStore(props);
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook to show toast notifications.
 *
 * Subscribes to the global toast store via useEffect so there is
 * exactly one listener per mounted component, cleaned up on unmount.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = addToastListener((updatedToasts) => setToasts(updatedToasts));
    return unsubscribe;
  }, []);

  return {
    toasts,
    toast,
    /**
     * Show success toast
     */
    success: (title: string, description?: string) =>
      toast({ title, description, variant: 'success', duration: 2000 }),
    /**
     * Show error toast
     */
    error: (title: string, description?: string) =>
      toast({ title, description, variant: 'error', duration: 4000 }),
    /**
     * Show info toast
     */
    info: (title: string, description?: string) =>
      toast({ title, description, variant: 'info', duration: 3000 }),
    /**
     * Dismiss a specific toast by ID
     */
    dismiss: (id: string) => removeToastFromStore(id),
    /**
     * Dismiss a specific toast by ID (alias)
     */
    dismissToast: removeToastFromStore,
  };
}
