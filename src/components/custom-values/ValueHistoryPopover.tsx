'use client';

/**
 * ValueHistoryPopover Component - STUB
 * 
 * NOTE: This is a stub component. The custom values feature is incomplete.
 * Full implementation will be completed in a future phase.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface ValueHistoryPopoverProps {
  benefitId: string;
  onClose?: () => void;
}

export const ValueHistoryPopover: React.FC<ValueHistoryPopoverProps> = ({ onClose }) => {
  return (
    <div className="w-64 rounded-lg border border-gray-200 p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Value history feature coming soon
      </p>
      {onClose && (
        <Button onClick={onClose} size="sm" variant="ghost" className="mt-3 w-full">
          Close
        </Button>
      )}
    </div>
  );
};

ValueHistoryPopover.displayName = 'ValueHistoryPopover';
