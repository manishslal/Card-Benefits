/**
 * Hook for managing onboarding state
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { OnboardingState } from '@/types/benefits';

export function useOnboarding(userId: string) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch onboarding state
  const fetchState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding');

      if (!response.ok) {
        throw new Error('Failed to fetch onboarding state');
      }

      const data = await response.json();
      setState(data.data);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
    }
  }, []);

  // Complete step
  const completeStep = useCallback(async (step: number) => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_step',
          step,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete step');
      }

      const data = await response.json();
      setState(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Skip step
  const skipStep = useCallback(async (step: number) => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'skip_step',
          step,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to skip step');
      }

      const data = await response.json();
      setState(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Setup reminders
  const setupReminders = useCallback(async (
    email: string,
    frequency: string
  ) => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup_reminders',
          setupReminders: true,
          reminderEmail: email,
          reminderFrequency: frequency,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to setup reminders');
      }

      const data = await response.json();
      setState(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_onboarding',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      const data = await response.json();
      setState(data.data);
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchState();
    }
  }, [userId, fetchState]);

  return {
    state,
    loading,
    error,
    fetchState,
    completeStep,
    skipStep,
    setupReminders,
    completeOnboarding,
  };
}
