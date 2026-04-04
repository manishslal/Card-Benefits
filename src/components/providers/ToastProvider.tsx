'use client';

import { ToastContainer } from '@/components/ui/use-toast';

/**
 * ToastProvider Component
 * 
 * Renders the ToastContainer which displays all active toast notifications.
 * This should be rendered at the root level of the app so toasts can be
 * displayed throughout the application.
 */
export function ToastProvider() {
  return <ToastContainer />;
}
