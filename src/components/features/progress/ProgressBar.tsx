/**
 * ProgressBar - Visual progress bar component
 * Shows benefit usage with color-coded status
 */

'use client';

import React from 'react';
import { BenefitProgress } from '@/types/benefits';

interface ProgressBarProps {
  progress: BenefitProgress;
  showLabel?: boolean;
  showPercentage?: boolean;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'unused':
      return 'bg-gray-300 dark:bg-gray-600';
    case 'active':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'critical':
      return 'bg-orange-500';
    case 'exceeded':
      return 'bg-red-500';
    default:
      return 'bg-blue-500';
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'unused':
      return 'bg-gray-100 dark:bg-gray-800';
    case 'active':
      return 'bg-green-50 dark:bg-green-900/20';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/20';
    case 'critical':
      return 'bg-orange-50 dark:bg-orange-900/20';
    case 'exceeded':
      return 'bg-red-50 dark:bg-red-900/20';
    default:
      return 'bg-blue-50 dark:bg-blue-900/20';
  }
}

export function ProgressBar({
  progress,
  showLabel = true,
  showPercentage = true,
}: ProgressBarProps) {
  if (!progress.limit) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">
        No limit set for this benefit
      </div>
    );
  }

  const displayPercentage = Math.min(progress.percentage, 100);
  const statusColor = getStatusColor(progress.status);
  const statusBgColor = getStatusBgColor(progress.status);

  return (
    <div className={`p-4 rounded-lg ${statusBgColor}`}>
      <div className="flex items-center justify-between mb-2">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Usage
          </span>
        )}
        {showPercentage && (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {Math.round(progress.percentage)}%
          </span>
        )}
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${statusColor} transition-all duration-300`}
          style={{ width: `${displayPercentage}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress.percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(progress.percentage)}% of ${progress.limit} ${progress.unit}`}
        />
      </div>

      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Used ${(progress.used / 100).toFixed(2)} of $
        {(progress.limit / 100).toFixed(2)}
      </div>

      {progress.percentage > 100 && (
        <div className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          ⚠️ Over limit by ${((progress.used - progress.limit) / 100).toFixed(2)}
        </div>
      )}
    </div>
  );
}
