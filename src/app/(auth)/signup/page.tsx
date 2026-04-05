'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Button from '@/shared/components/ui/button';
import Input from '@/shared/components/ui/Input';
import { SafeDarkModeToggle } from '@/shared/components/ui';
import { FormError } from '@/shared/components/forms';
import { CreditCard } from 'lucide-react';

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
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one lowercase letter';
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number';
    } else if (!/[!@#$%^&*\-_]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one special character (!@#$%^&*-_)';
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
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          // Set field-level errors from API
          const fieldErrors: Record<string, string> = {};
          Object.entries(data.fieldErrors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages[0];
            }
          });
          setErrors(fieldErrors);
        }
        setMessage(data.error || 'Signup failed');
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
            {message && <FormError message={message} type="error" />}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
            {/* First Name Field */}
              <Input
                id="signup-firstname"
                label="First Name"
                type="text"
                name="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={handleChange}
                error={errors.firstName}
                disabled={isLoading}
              />

              {/* Last Name Field */}
              <Input
                id="signup-lastname"
                label="Last Name"
                type="text"
                name="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleChange}
                error={errors.lastName}
                disabled={isLoading}
              />

              {/* Email Field */}
              <Input
                id="signup-email"
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
                id="signup-password"
                label="Password"
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                disabled={isLoading}
                hint="At least 12 characters with uppercase, lowercase, number, and special character"
              />

              {/* Confirm Password Field */}
              <Input
                id="signup-confirm-password"
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
