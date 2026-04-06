/**
 * UI Context - Manages global UI state
 * 
 * State managed:
 * - Theme (light/dark)
 * - Sidebar collapse state
 * - Modal state
 * - Toast notifications
 * - Breadcrumb
 * - Loading states
 */

'use client';

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type { UIContextState, ModalState, Toast, BreadcrumbItem } from '../types/admin';

export const UIContext = createContext<UIContextState | undefined>(undefined);

const initialState: UIContextState = {
  theme: 'light',
  prefersDark: false,
  sidebarCollapsed: false,
  modal: {
    isOpen: false,
    type: null,
  },
  toasts: [],
  breadcrumb: [],
  isLoading: false,
};

interface UIContextProviderProps {
  children: React.ReactNode;
}

/**
 * UIContextProvider component
 * 
 * Manages all global UI state including theme, modals, and notifications.
 */
export function UIContextProvider({ children }: UIContextProviderProps) {
  const [state, setState] = useState<UIContextState>(initialState);
  const [mounted, setMounted] = useState(false);

  // Initialize theme preference on mount
  useEffect(() => {
    setMounted(true);
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setState((prev) => ({ ...prev, prefersDark }));
    
    // Check localStorage for theme preference
    const savedTheme = localStorage.getItem('admin-theme');
    if (savedTheme) {
      setState((prev) => ({ ...prev, theme: savedTheme as any }));
      applyTheme(savedTheme as any);
    } else if (prefersDark) {
      setState((prev) => ({ ...prev, theme: 'system' }));
      applyTheme('system');
    }
  }, []);

  // Apply theme to document
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const html = document.documentElement;
    const isDark =
      theme === 'dark' || (theme === 'system' && state.prefersDark);
    
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  };

  // Theme - Setters
  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setState((prev) => ({ ...prev, theme }));
    localStorage.setItem('admin-theme', theme);
    applyTheme(theme);
  }, []);

  // Sidebar - Setters
  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, sidebarCollapsed: collapsed }));
    localStorage.setItem('admin-sidebar-collapsed', String(collapsed));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed,
    }));
  }, []);

  // Modal - Setters
  const openModal = useCallback(
    (modal: Omit<ModalState, 'isOpen'>) => {
      setState((prev) => ({
        ...prev,
        modal: { ...modal, isOpen: true },
      }));
    },
    []
  );

  const closeModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      modal: {
        isOpen: false,
        type: null,
      },
    }));
  }, []);

  const updateModal = useCallback(
    (updates: Partial<ModalState>) => {
      setState((prev) => ({
        ...prev,
        modal: { ...prev.modal, ...updates },
      }));
    },
    []
  );

  // Toast - Setters
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    const newToast: Toast = { ...toast, id };

    setState((prev) => ({
      ...prev,
      toasts: [...prev.toasts, newToast],
    }));

    // Auto-remove toast after duration
    if (toast.duration !== Infinity) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 3000);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      toasts: prev.toasts.filter((toast) => toast.id !== id),
    }));
  }, []);

  const clearToasts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      toasts: [],
    }));
  }, []);

  // Breadcrumb - Setters
  const setBreadcrumb = useCallback((breadcrumb: BreadcrumbItem[]) => {
    setState((prev) => ({
      ...prev,
      breadcrumb,
    }));
  }, []);

  // Loading - Setters
  const setIsLoading = useCallback((loading: boolean) => {
    setState((prev) => ({
      ...prev,
      isLoading: loading,
    }));
  }, []);

  // Toast convenience methods
  const showSuccess = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'success', title, message });
    },
    [addToast]
  );

  const showError = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'error', title, message });
    },
    [addToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'warning', title, message });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string) => {
      return addToast({ type: 'info', title, message });
    },
    [addToast]
  );

  if (!mounted) {
    return <>{children}</>;
  }

  const contextValue: UIContextState = {
    ...state,
  };

  return (
    <UIContext.Provider value={contextValue}>
      {children}
    </UIContext.Provider>
  );
}

/**
 * Hook to use UI context
 */
export function useUIContext() {
  const context = React.useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUIContext must be used within UIContextProvider');
  }
  return context;
}

/**
 * Hook for theme management
 */
export function useTheme() {
  const context = useUIContext();
  // Return theme state and setter (would be passed from context)
  return {
    theme: context.theme,
    prefersDark: context.prefersDark,
  };
}

/**
 * Hook for modal management
 */
export function useModal() {
  const context = useUIContext();
  return {
    modal: context.modal,
  };
}

/**
 * Hook for toast notifications
 */
export function useToast() {
  const context = useUIContext();
  return {
    toasts: context.toasts,
  };
}
