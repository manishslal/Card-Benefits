/**
 * AddCardModal Component - Stub
 *
 * TODO: Implement in Phase 2
 */

'use client';

import React, { ReactElement } from 'react';
import { AddCardModalProps } from '@/types/card-management';

export function AddCardModal({
  isOpen,
  onClose
}: AddCardModalProps): ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full">
        <p className="text-sm text-gray-500">Add card modal - Phase 2</p>
        <button onClick={onClose} className="mt-4 text-blue-600">Close</button>
      </div>
    </div>
  );
}

export default AddCardModal;
