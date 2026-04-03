'use client';

/**
 * BulkValueEditor Component - STUB
 * 
 * NOTE: This is a stub component. The custom values feature is incomplete.
 * Full implementation will be completed in a future phase.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface BulkValueEditorProps {
  cardId: string;
  benefits: any[];
  onSave: (updates: any[]) => Promise<void>;
  isLoading?: boolean;
}

export const BulkValueEditor = React.forwardRef<
  HTMLDivElement,
  BulkValueEditorProps
>(
  ({ benefits, isLoading = false },  ref) => {
    return (
      <div ref={ref} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Bulk editing {benefits?.length || 0} benefits
        </p>
        <Button disabled={isLoading} className="mt-3" size="sm">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    );
  }
);

BulkValueEditor.displayName = 'BulkValueEditor';
