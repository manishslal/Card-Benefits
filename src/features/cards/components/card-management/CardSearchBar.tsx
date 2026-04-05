/**
 * CardSearchBar Component
 *
 * Real-time search input with debouncing for card name, issuer, and custom name.
 * Includes clear button and search icon.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { Search, X } from 'lucide-react';

interface CardSearchBarProps {
  value: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

/**
 * CardSearchBar Component
 *
 * Debounced search input for filtering cards by name/issuer
 * - Debounces input by 200ms for performance
 * - Shows clear button when search has content
 * - Accessible with proper ARIA labels
 */
export function CardSearchBar({
  value,
  onSearchChange,
  placeholder = 'Search cards by name, issuer, or custom name...',
  debounceMs = 200
}: CardSearchBarProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Update local value when prop changes (from external reset)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the search callback
  const handleSearchChange = useCallback((newValue: string) => {
    setLocalValue(newValue);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      onSearchChange(newValue);
    }, debounceMs);

    setDebounceTimer(timer);
  }, [debounceTimer, debounceMs, onSearchChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onSearchChange('');
  }, [onSearchChange]);

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <Search className="h-4 w-4" />
      </div>

      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="pl-10 pr-10"
        aria-label="Search cards"
      />

      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default CardSearchBar;
