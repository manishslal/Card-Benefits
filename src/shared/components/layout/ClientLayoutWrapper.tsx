'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/shared/components/providers/ToastProvider';
import { useFocusManagement } from '@/shared/hooks/useFocusManagement';
import { SessionExpirationManager } from '@/features/auth/components/SessionExpirationManager';

/**
 * ClientLayoutWrapper Component
 * 
 * Wraps the children with client-side layout features:
 * - Focus management for keyboard navigation
 * - Route change handling
 * - Session expiration monitoring
 * 
 * This component must be rendered as a child of the root layout
 * so it can use client-side hooks and next/navigation.
 */
export function ClientLayoutWrapper({ children }: { children: ReactNode }) {
  // Enable focus management on route changes
  useFocusManagement();

  return (
    <>
      <ToastProvider />
      <SessionExpirationManager />
      {children}
    </>
  );
}
