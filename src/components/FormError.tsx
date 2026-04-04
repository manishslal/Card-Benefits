'use client';

import { AlertCircle } from 'lucide-react';

/**
 * FormError Component
 * 
 * Consistent error message styling across the entire application.
 * Used in forms to display validation and submission errors.
 * 
 * Features:
 * - Icon indicator for color-independent feedback
 * - Proper ARIA labeling for screen readers
 * - Responsive text sizing
 * - Accessibility compliance
 */
export function FormError({ message, className = '' }: { message?: string; className?: string }) {
  if (!message) return null;

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg bg-[var(--color-error)] bg-opacity-10 text-[var(--color-error)] text-sm ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
