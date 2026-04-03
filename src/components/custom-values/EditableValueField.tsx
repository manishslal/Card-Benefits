'use client';

/**
 * EditableValueField Component - STUB
 * 
 * NOTE: This is a stub component. The custom values feature is incomplete.
 * Full implementation will be completed in a future phase.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface EditableValueFieldProps {
  benefitId: string;
  currentValue: number;
  masterValue: number;
  onSave: (value: number) => Promise<void>;
  isLoading?: boolean;
}

export const EditableValueField = React.forwardRef<
  HTMLDivElement,
  EditableValueFieldProps
>(
  ({ currentValue, masterValue, isLoading = false }, ref) => {
    const [isEditing, setIsEditing] = useState(false);

    return (
      <div ref={ref} className="space-y-2">
        <div className="text-sm">
          <p className="font-medium">Current: ${(currentValue / 100).toFixed(2)}</p>
          <p className="text-gray-600 dark:text-gray-400">Master: ${(masterValue / 100).toFixed(2)}</p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          disabled={isLoading}
          size="sm"
          variant="outline"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </Button>
      </div>
    );
  }
);

EditableValueField.displayName = 'EditableValueField';
