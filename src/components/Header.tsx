'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, CreditCard } from 'lucide-react';

/**
 * Header Component - Card Benefits Dashboard
 * 
 * Displays:
 * - Logo/title ("Card Benefits Dashboard")
 * - Dark mode toggle button (moon/sun icon)
 * 
 * Features:
 * - Sticky positioning (stays at top during scroll)
 * - Height: 64px (mobile), 72px (desktop)
 * - Dark mode preference persists to localStorage
 * - Smooth color transitions
 * 
 * Technical:
 * - Manages theme state via data-theme="dark" on <html> element
 * - Persists preference to localStorage("theme")
 * - Keyboard accessible (Tab navigation, Enter/Space to toggle)
 */
export default function Header() {
  const [isDark, setIsDark] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    // Check localStorage for saved preference
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    
    // Check system preference if no saved preference
    const prefersDark =
      savedTheme === 'dark' ||
      (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);

    setIsDark(prefersDark);
    applyTheme(prefersDark);
    setIsInitialized(true);
  }, []);

  /**
   * Apply theme to document and save preference.
   * Consolidates on Tailwind .dark class (removes data-theme attribute system).
   */
  const applyTheme = (dark: boolean) => {
    const htmlElement = document.documentElement;
    
    if (dark) {
      // Only use Tailwind .dark class system
      htmlElement.classList.add('dark');
    } else {
      // Remove Tailwind .dark class
      htmlElement.classList.remove('dark');
    }
    
    // Persist user preference to localStorage for next session
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }
  };

  /**
   * Toggle dark mode on/off
   */
  const toggleDarkMode = () => {
    const newDarkMode = !isDark;
    setIsDark(newDarkMode);
    applyTheme(newDarkMode);
  };

  // Avoid hydration mismatch by not rendering until client-side initialization
  if (!isInitialized) {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        height: 'var(--height-header-mobile)',
      }}
    >
      <div className="flex items-center justify-between h-full px-md md:px-tablet lg:px-desktop max-w-container mx-auto">
        {/* Logo & Title */}
        <div className="flex items-center gap-sm">
          {/* Logo - CreditCard icon from Lucide React (32×32px) */}
          <div
            className="rounded-md flex items-center justify-center flex-shrink-0 font-bold text-white"
            style={{
              backgroundColor: 'var(--color-primary-500)',
              width: '32px',
              height: '32px',
            }}
          >
            <CreditCard className="w-6 h-6 text-white" />
          </div>

          {/* Title */}
          <h1
            className="font-bold hidden sm:block text-text-primary"
            style={{ fontSize: 'var(--font-h3)' }}
          >
            Card Benefits
          </h1>
          <h1
            className="font-bold sm:hidden text-text-primary"
            style={{ fontSize: '16px' }}
          >
            Benefits
          </h1>
        </div>

        {/* Dark Mode Toggle Button */}
        <button
          onClick={toggleDarkMode}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          role="switch"
          aria-checked={isDark}
          className="flex items-center justify-center rounded-md transition-all duration-200"
          style={{
            width: '44px',
            height: '44px',
            backgroundColor: 'transparent',
            color: 'var(--color-text-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {isDark ? (
            // Sun icon for light mode toggle (when in dark mode)
            <Sun className="w-6 h-6" />
          ) : (
            // Moon icon for dark mode toggle (when in light mode)
            <Moon className="w-6 h-6" />
          )}
        </button>
      </div>
    </header>
  );
}
