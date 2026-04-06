'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { SafeDarkModeToggle } from '@/shared/components/ui';
import { FormError } from '@/shared/components/forms';
import { CreditCard } from 'lucide-react';

/**
 * Login Page - Redesigned with Session Expiration Handling
 * 
 * Features:
 * - Clean form layout with Input component
 * - Email and password fields with labels
 * - Form validation with error messages
 * - Detects ?expired=true query param and shows friendly "session expired" banner
 * - Sign up link at bottom
 * - Card container with rounded corners
 * - Dark mode support
 * - Responsive design
 */

// Mark as dynamic page to avoid SSG issues
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get('expired') === 'true';

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Auto-focus email field when page loads
  useEffect(() => {
    const emailInput = document.getElementById('login-email') as HTMLInputElement;
    if (emailInput) {
      setTimeout(() => emailInput.focus(), 100);
    }
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Login failed');
        return;
      }

      // Store userId in localStorage for API calls
      if (data.userId) {
        localStorage.setItem('userId', data.userId);
      }

      // Success - redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      setMessage('An error occurred. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <CreditCard size={20} />
            </div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              CardTrack
            </h1>
          </Link>
          <SafeDarkModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Session Expired Banner - Shows when ?expired=true in query params */}
          {isSessionExpired && (
            <div
              className="mb-6 p-4 border-l-4 rounded"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: '#f59e0b',
              }}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  {/* Alert icon */}
                  <svg
                    className="h-5 w-5"
                    style={{ color: '#f59e0b' }}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: '#92400e' }}>
                    Session Expired
                  </h3>
                  <p className="text-sm mt-1" style={{ color: '#92400e' }}>
                    Your session has expired. Please log in again to continue.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card Container */}
          <div
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Title */}
            <h2
              className="text-2xl font-bold text-center mb-2 text-[var(--color-text)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Welcome Back
            </h2>
            <p
              className="text-center text-sm mb-8 text-[var(--color-text-secondary)]"
            >
              Sign in to access your card benefits
            </p>

            {/* Error Message */}
            {message && <FormError message={message} type="error" />}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <Input
                id="login-email"
                label="Email Address"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                disabled={isLoading}
              />

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-[var(--color-text)]"
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] rounded"
                    aria-label="Forgot password? Reset your password"
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  disabled={isLoading}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
              <span
                className="text-xs text-[var(--color-text-secondary)]"
              >
                OR
              </span>
              <div
                className="flex-1 h-px"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Don't have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold text-[var(--color-primary)] hover:underline"
              >
                Sign up
              </Link>
            </p>
          </div>

          {/* Footer Info */}
          <p
            className="text-center text-xs mt-8 text-[var(--color-text-secondary)]"
          >
            By signing in, you agree to our{' '}
            <a href="#" className="underline hover:no-underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:no-underline">
              Privacy Policy
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
