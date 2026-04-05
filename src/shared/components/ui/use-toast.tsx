'use client';

/**
 * Simple toast hook for user notifications.
 * Provides success, error, and info notifications.
 */

import React, { useState, useCallback, useEffect } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'default' | 'success' | 'error' | 'info';
  duration?: number;
}

// Global toast state (simple implementation)
let toastStore: Toast[] = [];
let listeners: Set<(toasts: Toast[]) => void> = new Set();

const addToastListener = (listener: (toasts: Toast[]) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = () => {
  listeners.forEach((listener) => listener(toastStore));
};

const addToastToStore = (toast: Toast) => {
  toastStore.push(toast);
  notifyListeners();

  // Auto-remove after duration
  if (toast.duration !== 0) {
    const duration = toast.duration || 3000;
    setTimeout(() => {
      toastStore = toastStore.filter((t) => t.id !== toast.id);
      notifyListeners();
    }, duration);
  }
};

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const [, setToasts] = useState<Toast[]>([]);

  // Subscribe to toast updates
  const subscribe = useCallback(() => {
    return addToastListener((toasts) => {
      setToasts(toasts);
    });
  }, []);

  const toast = useCallback(
    (props: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        ...props,
        id,
      };
      addToastToStore(newToast);
      return id;
    },
    []
  );

  // Subscribe on first use
  if (!('_subscribed' in toast)) {
    subscribe();
  }

  return {
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
    dismiss: (id: string) => {
      toastStore = toastStore.filter((t) => t.id !== id);
      notifyListeners();
    },
  };
}

/**
 * Toast container component to render all active toasts
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = addToastListener(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed bottom-0 right-0 z-50 space-y-2 p-4 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg p-4 text-white shadow-lg animate-slide-in ${
            toast.variant === 'success'
              ? 'bg-green-500'
              : toast.variant === 'error'
                ? 'bg-red-500'
                : 'bg-blue-500'
          }`}
        >
          <div className="font-semibold">{toast.title}</div>
          {toast.description && (
            <div className="text-sm opacity-90">{toast.description}</div>
          )}
        </div>
      ))}
    </div>
  );
}
