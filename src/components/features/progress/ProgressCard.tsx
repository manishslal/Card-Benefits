/**
 * ProgressCard - Card displaying benefit progress
 */

'use client';

import React from 'react';
import { Benefit, BenefitProgress } from '@/types/benefits';
import { ProgressBar } from './ProgressBar';

interface ProgressCardProps {
  benefit: Benefit;
  progress: BenefitProgress | null;
  isLoading?: boolean;
}

export function ProgressCard({
  benefit,
  progress,
  isLoading = false,
}: ProgressCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {benefit.name}
        </h3>
        {benefit.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {benefit.description}
          </p>
        )}
      </div>

      {progress ? (
        <>
          <ProgressBar progress={progress} />
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Reset Cadence</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {benefit.resetCadence}
              </p>
            </div>
            {benefit.expirationDate && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Expires</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(benefit.expirationDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No progress data available
        </div>
      )}
    </div>
  );
}
