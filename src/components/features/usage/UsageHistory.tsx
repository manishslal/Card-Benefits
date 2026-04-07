/**
 * UsageHistory - Display list of past usage records
 * Scrollable list with delete functionality
 */

'use client';

import React from 'react';
import { UsageRecord } from '@/types/benefits';

interface UsageHistoryProps {
  records: UsageRecord[];
  onDelete?: (id: string) => Promise<void>;
  isDeleting?: Record<string, boolean>;
  isLoading?: boolean;
  error?: string | null;
}

export function UsageHistory({
  records,
  onDelete,
  // isDeleting,
  isLoading = false,
  error = null,
}: UsageHistoryProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-gray-100 dark:bg-slate-700 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <p className="text-red-800 dark:text-red-200">Error loading history: {error}</p>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No usage records yet. Record your first benefit usage above.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
      <div className="p-6 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Usage History
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Showing {records.length} record{records.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-y-auto max-h-96">
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {records.map((record) => (
            <div
              key={record.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition flex items-start justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    ${(record.usageAmount / 100).toFixed(2)}
                  </span>
                  {record.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                      {record.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {record.notes}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {new Date(record.usageDate).toLocaleDateString()} at{' '}
                  {new Date(record.usageDate).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {onDelete && (
                <button
                  onClick={() => onDelete(record.id)}
                  disabled={false}
                  className="ml-4 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition disabled:opacity-50"
                  aria-label={`Delete usage record for ${record.notes}`}
                >
                  {false ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
