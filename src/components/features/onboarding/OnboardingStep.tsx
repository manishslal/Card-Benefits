/**
 * OnboardingStep - A single step in the onboarding flow
 */

'use client';

import React from 'react';

interface OnboardingStepProps {
  stepNumber: number;
  title: string;
  description: string;
  children?: React.ReactNode;
  onNext?: () => void;
  onSkip?: () => void;
  onPrevious?: () => void;
  isLast?: boolean;
  isFirst?: boolean;
  isLoading?: boolean;
}

export function OnboardingStep({
  stepNumber,
  title,
  description,
  children,
  onNext,
  onSkip,
  onPrevious,
  isLast = false,
  isFirst = false,
  isLoading = false,
}: OnboardingStepProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Step {stepNumber} of 6</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full ${
                  i <= stepNumber
                    ? 'bg-white'
                    : 'bg-blue-300 dark:bg-blue-700'
                }`}
              />
            ))}
          </div>
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-blue-100 mt-1">{description}</p>
      </div>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-between">
        <div className="flex gap-3">
          {!isFirst && (
            <button
              onClick={onPrevious}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              ← Previous
            </button>
          )}
          {!isLast && (
            <button
              onClick={onSkip}
              disabled={isLoading}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition disabled:opacity-50"
            >
              Skip
            </button>
          )}
        </div>

        <button
          onClick={onNext}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition"
        >
          {isLoading ? 'Loading...' : isLast ? 'Complete' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
