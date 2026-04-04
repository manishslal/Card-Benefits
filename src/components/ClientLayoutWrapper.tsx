'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { useFocusManagement } from '@/hooks/useFocusManagement';

/**
 * ClientLayoutWrapper Component
 * 
 * Wraps the children with client-side layout features:
 * - Focus management for keyboard navigation
 * - Route change handling
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
      {children}
    </>
  );
}
