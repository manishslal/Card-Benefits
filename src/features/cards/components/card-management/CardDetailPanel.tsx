/**
 * CardDetailPanel Component - Stub
 *
 * TODO: Implement in Phase 2
 */

'use client';

import React, { ReactElement } from 'react';
import { CardDetailPanelProps } from '@/features/cards/types';

export function CardDetailPanel({
  card,
  isOpen,
  onClose
}: CardDetailPanelProps): ReactElement | null {
  if (!isOpen || !card) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-lg">
      <div className="p-4">
        <p className="text-sm text-gray-500">Card detail panel - Phase 2</p>
        <button onClick={onClose} className="mt-4 text-blue-600">Close</button>
      </div>
    </div>
  );
}

export default CardDetailPanel;
