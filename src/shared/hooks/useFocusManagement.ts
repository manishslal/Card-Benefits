'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * useFocusManagement Hook
 * 
 * Manages focus movement when navigating between routes.
 * Ensures keyboard users (particularly screen reader users) have focus
 * set to the main content area after navigation completes.
 * 
 * This improves accessibility by preventing focus from getting "stuck"
 * on navigation elements after the page changes.
 */
export function useFocusManagement() {
  const pathname = usePathname();

  useEffect(() => {
    // Move focus to main content after route change
    // This helps keyboard and screen reader users navigate efficiently
    const mainElement = document.querySelector('main');
    if (mainElement) {
      // Make main element focusable
      mainElement.setAttribute('tabIndex', '-1');
      // Focus the main element
      mainElement.focus();
      // Optional: also call skipToMain if you have that function
      mainElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [pathname]);
}
