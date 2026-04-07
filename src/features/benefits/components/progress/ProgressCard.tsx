/**
 * Progress Card Component
 * Display benefit progress with percentage and remaining days
 */

'use client';

import { useBenefitProgress } from '../../hooks';
import type { BenefitProgress } from '../../types/benefits';

interface ProgressCardProps {
  benefitId: string;
  className?: string;
}

export function ProgressCard({ benefitId, className }: ProgressCardProps) {
  const { progress, loading, error, refresh } = useBenefitProgress(benefitId);

  if (loading) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-700 text-sm font-medium">Failed to load progress</p>
        <button
          onClick={refresh}
          className="mt-2 text-red-600 hover:text-red-700 text-sm font-medium underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-800 border-green-200',
    EXPIRING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    USED: 'bg-blue-100 text-blue-800 border-blue-200',
    EXPIRED: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className={`p-4 bg-white border rounded-lg ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{progress.benefitName}</h3>
          <p className="text-sm text-gray-600">
            ${progress.totalUsed.toFixed(2)} / ${(progress.userValue || progress.stickerValue).toFixed(2)}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-medium rounded border ${statusColors[progress.status]}`}>
          {progress.status}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">{progress.percentageUsed}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              progress.percentageUsed < 50
                ? 'bg-green-500'
                : progress.percentageUsed < 75
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(progress.percentageUsed, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-600">
        <span>{progress.daysRemaining} days remaining</span>
        <button
          onClick={refresh}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
