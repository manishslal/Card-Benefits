/**
 * useOnboarding Hook
 * Manage onboarding session and step tracking
 */

import { useEffect, useState, useCallback } from 'react';
import type { OnboardingSessionData, OnboardingStateResponse, StepCompleteInput, OnboardingStep } from '@/features/benefits/types/benefits';

interface OnboardingState {
  session: OnboardingSessionData | null;
  currentStep: OnboardingStep;
  completionPercentage: number;
  loading: boolean;
  error: string | null;
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    session: null,
    currentStep: 1,
    completionPercentage: 0,
    loading: false,
    error: null,
  });

  const fetchState = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch('/api/onboarding/state', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: OnboardingStateResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch onboarding state');
      }

      setState((prev) => ({
        ...prev,
        session: data.session,
        currentStep: data.session.currentStep as OnboardingStep,
        completionPercentage: data.completionPercentage,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      }));
    }
  }, []);

  const completeStep = useCallback(async (stepData?: Record<string, unknown>, duration?: number) => {
    if (!state.session) return;

    try {
      const response = await fetch(
        `/api/onboarding/step/${state.currentStep}/complete`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ stepData, duration } as StepCompleteInput),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Refresh state
      await fetchState();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to complete step',
      }));
    }
  }, [state.session, state.currentStep, fetchState]);

  const goToStep = useCallback((step: OnboardingStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const reset = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding/reset', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Refresh state
      await fetchState();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to reset onboarding',
      }));
    }
  }, [fetchState]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return {
    ...state,
    fetchState,
    completeStep,
    goToStep,
    reset,
    isFirstStep: state.currentStep === 1,
    isLastStep: state.currentStep === 6,
  };
}
