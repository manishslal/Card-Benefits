'use client';

import React from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Button } from './button';
import { Sun, Moon } from 'lucide-react';

/**
 * DarkModeToggle - Theme Switcher Button
 * Allows users to toggle between light and dark modes
 * Uses Lucide React icons for a professional appearance
 */
export function DarkModeToggle() {
  const { isDark, setTheme } = useTheme();

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Button
      variant="ghost"
      size="md"
      onClick={handleToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun size={20} className="text-yellow-400" />
      ) : (
        <Moon size={20} className="text-slate-700" />
      )}
    </Button>
  );
}

export default DarkModeToggle;
