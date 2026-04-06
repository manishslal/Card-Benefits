/**
 * Admin Context - Simplified version
 * 
 * Note: Full context implementation is in AdminContext.tsx.bak
 * For Phase 3, we use SWR hooks for data fetching instead
 */

'use client';

import React, { createContext } from 'react';

interface AdminContextState {
  // Placeholder state
  ready: boolean;
}

export const AdminContext = createContext<AdminContextState | undefined>(undefined);

export function AdminContextProvider({ children }: { children: React.ReactNode }) {
  const value: AdminContextState = {
    ready: true,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminContext() {
  const context = React.useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within AdminContextProvider');
  }
  return context;
}
