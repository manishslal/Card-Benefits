'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/Input';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';

/**
 * Signup Page - Redesigned
 * 
 * Features:
 * - Multi-field form (name, email, password, confirm password)
 * - Form validation with error messages
 * - "Already have an account?" link at bottom
 * - Card container with rounded corners
 * - Dark mode support
 * - Responsive design
 */

// Mark as dynamic page to avoid SSG issues
export const dynamic = 'force-dynamic';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

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

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Signup failed');
        return;
      }

      // Success - redirect to login or dashboard
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
              💳
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
              Create Account
            </h2>
            <p
              className="text-center text-sm mb-8 text-[var(--color-text-secondary)]"
            >
              Start tracking your credit card benefits
            </p>

            {/* Error Message */}
            {message && (
              <div
                className="p-3 rounded-lg mb-6 text-sm text-white"
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                {message}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name Field */}
              <Input
                label="Full Name"
                type="text"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                disabled={isLoading}
              />

              {/* Email Field */}
              <Input
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
              <Input
                label="Password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                disabled={isLoading}
                hint="At least 6 characters"
              />

              {/* Confirm Password Field */}
              <Input
                label="Confirm Password"
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                disabled={isLoading}
              />

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
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

            {/* Sign In Link */}
            <p className="text-center text-sm text-[var(--color-text-secondary)]">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-[var(--color-primary)] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Footer Info */}
          <p
            className="text-center text-xs mt-8 text-[var(--color-text-secondary)]"
          >
            By creating an account, you agree to our{' '}
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
