/**
 * UI Context - Minimal implementation for Phase 3
 */

'use client';

import React, { createContext, useState } from 'react';
import type { UIContextState } from '../types/admin';

export const UIContext = createContext<UIContextState | undefined>(undefined);

const initialState: UIContextState = {
  theme: 'system',
  prefersDark: false,
  sidebarCollapsed: false,
  modal: { isOpen: false, type: null },
  toasts: [],
  breadcrumb: [],
  isLoading: false,
};

export function UIContextProvider({ children }: { children: React.ReactNode }) {
  const [state] = useState<UIContextState>(initialState);

  return (
    <UIContext.Provider value={state}>
      {children}
    </UIContext.Provider>
  );
}

export function useUIContext() {
  const context = React.useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within UIContextProvider');
  }
  return context;
}
