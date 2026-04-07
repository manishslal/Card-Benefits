/**
 * OnboardingFlow - Complete onboarding flow component
 */

'use client';

import React, { useState } from 'react';
import { OnboardingStep } from './OnboardingStep';

interface OnboardingFlowProps {
  onComplete?: () => void;
  onSkip?: () => void;
  // userId: string;
}

export function OnboardingFlow({
  onComplete,
  onSkip,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    setIsLoading(true);
    try {
      if (currentStep === 6) {
        await onComplete?.();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    try {
      await onSkip?.();
      setCurrentStep((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <OnboardingStep
            stepNumber={1}
            title="Welcome to Card Benefits"
            description="Let's get you started with smart benefit tracking"
            onNext={handleNext}
            onSkip={handleSkip}
            isFirst
            isLoading={isLoading}
          >
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                This platform helps you track and maximize the benefits of your credit cards.
              </p>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>✓ Track benefit usage across all your cards</li>
                <li>✓ Get notified about expiring benefits</li>
                <li>✓ Discover benefits you might be missing</li>
                <li>✓ See your benefit value at a glance</li>
              </ul>
            </div>
          </OnboardingStep>
        );

      case 2:
        return (
          <OnboardingStep
            stepNumber={2}
            title="Understanding Benefit Types"
            description="Learn about the different kinds of benefits"
            onNext={handleNext}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
            isLoading={isLoading}
          >
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Annual Benefits
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Reset once per year (e.g., $300 annual travel credit)
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Monthly Benefits
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Reset each month (e.g., $25 monthly dining credit)
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  One-Time Benefits
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Used once, no reset (e.g., Airport lounge access)
                </p>
              </div>
            </div>
          </OnboardingStep>
        );

      case 3:
        return (
          <OnboardingStep
            stepNumber={3}
            title="Record Your First Usage"
            description="Track a benefit you recently used"
            onNext={handleNext}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
            isLoading={isLoading}
          >
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Start by recording a recent benefit usage. This helps us understand your usage patterns.
              </p>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  💡 Tip: If you've used a travel credit, dining credit, or any other benefit recently, record it now.
                </p>
              </div>
            </div>
          </OnboardingStep>
        );

      case 4:
        return (
          <OnboardingStep
            stepNumber={4}
            title="Set Up Reminders"
            description="Get notified about expiring benefits"
            onNext={handleNext}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
            isLoading={isLoading}
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input type="checkbox" defaultChecked className="mt-1" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Email reminders for expiring benefits
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Get notified when a benefit is about to expire
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3">
                <input type="checkbox" defaultChecked className="mt-1" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Weekly usage summary
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    See a summary of your benefit usage each week
                  </p>
                </div>
              </label>
            </div>
          </OnboardingStep>
        );

      case 5:
        return (
          <OnboardingStep
            stepNumber={5}
            title="See Your Benefits"
            description="View all your tracked benefits"
            onNext={handleNext}
            onSkip={handleSkip}
            onPrevious={handlePrevious}
            isLoading={isLoading}
          >
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                Go to the dashboard to see all your benefits with real-time progress tracking.
              </p>
              <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white mb-2">
                  Dashboard Features:
                </p>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• View all benefits in one place</li>
                  <li>• Track usage with progress bars</li>
                  <li>• Get personalized recommendations</li>
                  <li>• Filter by status, value, or type</li>
                </ul>
              </div>
            </div>
          </OnboardingStep>
        );

      case 6:
        return (
          <OnboardingStep
            stepNumber={6}
            title="You're All Set!"
            description="Ready to maximize your benefits"
            onNext={handleNext}
            onPrevious={handlePrevious}
            isLast
            isLoading={isLoading}
          >
            <div className="space-y-4 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-gray-700 dark:text-gray-300 text-lg">
                You're ready to start tracking your benefits and discovering value!
              </p>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg mt-6">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Next Steps:
                </p>
                <ul className="text-sm text-green-700 dark:text-green-400 mt-2 space-y-1">
                  <li>• Visit the dashboard</li>
                  <li>• Add your first usage record</li>
                  <li>• Check your recommendations</li>
                </ul>
              </div>
            </div>
          </OnboardingStep>
        );

      default:
        return null;
    }
  };

  return <div className="py-8">{renderStepContent()}</div>;
}
