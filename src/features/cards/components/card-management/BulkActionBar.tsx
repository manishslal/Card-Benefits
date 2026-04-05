/**
 * BulkActionBar Component - Stub
 *
 * TODO: Implement in Phase 3
 */

'use client';

import React, { ReactElement } from 'react';
import { BulkActionBarProps } from '@/features/cards/types';

export function BulkActionBar({
  selectedCount,
  onClearSelection
}: BulkActionBarProps): ReactElement | null {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span className="text-sm font-medium">
          {selectedCount} card{selectedCount === 1 ? '' : 's'} selected
        </span>
        <button onClick={onClearSelection} className="text-blue-600">
          Clear Selection
        </button>
      </div>
    </div>
  );
}

export default BulkActionBar;
