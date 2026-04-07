/**
 * RecommendationCard - Card for displaying a single recommendation
 */

'use client';

import React from 'react';
import { Recommendation } from '@/types/benefits';

interface RecommendationCardProps {
  recommendation: Recommendation;
  onDismiss?: (id: string) => void;
  onAction?: (id: string) => void;
  isDismissing?: boolean;
  isActioning?: boolean;
}

function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'HIGH':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
    case 'MEDIUM':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
    case 'LOW':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  }
}

export function RecommendationCard({
  recommendation,
  onDismiss,
  onAction,
  isDismissing = false,
  isActioning = false,
}: RecommendationCardProps) {
  const urgencyClass = getUrgencyColor(recommendation.urgency);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {recommendation.title}
          </h3>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(recommendation.id)}
            disabled={isDismissing}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl disabled:opacity-50"
            aria-label="Dismiss recommendation"
          >
            ✕
          </button>
        )}
      </div>

      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium border mb-3 ${urgencyClass}`}>
        {recommendation.urgency} Priority
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {recommendation.reason}
      </p>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">Potential Value</p>
        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
          ${(recommendation.value / 100).toFixed(2)}
        </p>
      </div>

      <div className="flex gap-3">
        {onAction && (
          <button
            onClick={() => onAction(recommendation.id)}
            disabled={isActioning}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition"
          >
            {isActioning ? 'Recording...' : 'Record Usage'}
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(recommendation.id)}
            disabled={isDismissing}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            {isDismissing ? 'Dismissing...' : 'Dismiss'}
          </button>
        )}
      </div>
    </div>
  );
}
