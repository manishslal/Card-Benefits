/**
 * MobileOptimizedBenefitCard - Mobile-optimized benefit display
 * Touch-friendly with responsive layout
 */

'use client';

import React from 'react';
import { Benefit, BenefitProgress } from '@/types/benefits';

interface MobileOptimizedBenefitCardProps {
  benefit: Benefit;
  progress?: BenefitProgress | null;
  onViewDetails?: () => void;
  onRecordUsage?: () => void;
}

export function MobileOptimizedBenefitCard({
  benefit,
  progress,
  onViewDetails,
  onRecordUsage,
}: MobileOptimizedBenefitCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition">
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2">
            {benefit.name}
          </h3>
          {benefit.expirationDate && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Expires {new Date(benefit.expirationDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar (if available) */}
      {progress && progress.limit ? (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              ${(progress.used / 100).toFixed(0)} / ${(progress.limit / 100).toFixed(0)}
            </span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">
              {Math.round(progress.percentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-full rounded-full transition-all ${
                progress.percentage < 50
                  ? 'bg-green-500'
                  : progress.percentage < 80
                  ? 'bg-yellow-500'
                  : progress.percentage < 100
                  ? 'bg-orange-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(progress.percentage, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Details */}
      <div className="mb-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>{benefit.resetCadence} Reset</p>
        {benefit.description && (
          <p className="line-clamp-2">{benefit.description}</p>
        )}
      </div>

      {/* Action Buttons - Touch-friendly min height */}
      <div className="flex gap-2">
        {onRecordUsage && (
          <button
            onClick={onRecordUsage}
            className="flex-1 px-3 py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition text-sm flex items-center justify-center"
            aria-label="Record usage for this benefit"
          >
            📝 Record
          </button>
        )}
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex-1 px-3 py-3 min-h-[44px] border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md transition text-sm flex items-center justify-center hover:bg-gray-50 dark:hover:bg-slate-700"
            aria-label="View details for this benefit"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * MobileOfflineIndicator - Shows offline status and sync progress
 */
interface MobileOfflineIndicatorProps {
  isOnline: boolean;
  syncInProgress: boolean;
  pendingSyncCount: number;
}

export function MobileOfflineIndicator({
  isOnline,
  syncInProgress,
  pendingSyncCount,
}: MobileOfflineIndicatorProps) {
  if (isOnline && !syncInProgress) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-300 dark:border-yellow-700 p-3 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-700 dark:text-gray-300">
              {syncInProgress ? 'Syncing...' : 'Online'}
            </span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <span className="text-gray-700 dark:text-gray-300">
              Offline Mode
            </span>
          </>
        )}
      </div>
      {pendingSyncCount > 0 && (
        <span className="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 px-2 py-1 rounded-full text-xs font-medium">
          {pendingSyncCount} pending
        </span>
      )}
    </div>
  );
}
