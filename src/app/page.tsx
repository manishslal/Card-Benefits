'use client';

import Link from 'next/link';
import Button from '@/shared/components/ui/button';
import { SafeDarkModeToggle } from '@/shared/components/ui';
import React from 'react';
import {
  CreditCard,
  ListChecks,
  Clock,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';

/**
 * Homepage / Landing Page - Redesigned
 * 
 * Features:
 * - Hero section with compelling headline and CTAs
 * - Feature highlights with Lucide icons
 * - Call-to-action sections
 * - Responsive design (mobile, tablet, desktop)
 * - Dark mode support
 * - Professional fintech aesthetic
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

export default function Homepage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header / Navigation */}
      <header
        className="sticky top-0 z-50 border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <CreditCard size={20} />
            </div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              CardTrack
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              Features
            </a>
            <a
              href="#benefits"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
            >
              Why Us
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <SafeDarkModeToggle />
            <Link href="/login">
              <Button variant="outline" size="sm">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="flex-1 flex items-center justify-center px-4 py-20 md:py-32"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-2xl text-center">
          {/* Main Headline */}
          <h2
            className="font-bold text-3xl md:text-5xl mb-6 text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Track Credit Card Benefits
            <br />
            <span style={{ color: 'var(--color-primary)' }}>
              Across Multiple Cards
            </span>
          </h2>

          {/* Subheading */}
          <p
            className="text-base md:text-lg mb-8 text-[var(--color-text-secondary)] leading-relaxed"
          >
            Never miss a benefit again. Organize your cards, track expiring perks, and maximize your spending value with our intuitive benefits tracker.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/signup">
              <Button
                size="lg"
                variant="primary"
                className="w-full sm:w-auto"
              >
                Get Started Free
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
              >
                Learn More
              </Button>
            </a>
          </div>

          {/* Trust badge */}
          <p
            className="text-xs text-[var(--color-text-secondary)]"
          >
            ✓ Free • No credit card required • Takes 2 minutes
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          {/* Section title */}
          <h3
            className="text-2xl md:text-3xl font-bold text-center mb-12 text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Powerful Features for Benefit Tracking
          </h3>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: ListChecks,
                title: 'Organize Your Cards',
                description: 'Keep all your credit cards in one place with custom names and details.',
              },
              {
                icon: Clock,
                title: 'Track Benefits & Expiration',
                description: 'Never miss a benefit. Get alerts before perks expire.',
              },
              {
                icon: Lightbulb,
                title: 'Smart Recommendations',
                description: 'Discover which cards offer the best value for your spending.',
              },
              {
                icon: TrendingUp,
                title: 'Maximize Your Value',
                description: 'Identify underutilized benefits and unlock more value from your cards.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="p-6 rounded-lg border transition-all duration-200 hover:border-[var(--color-primary)] hover:shadow-md"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="mb-3 text-[var(--color-primary)]">
                  <feature.icon size={32} strokeWidth={1.5} />
                </div>
                <h4
                  className="font-semibold text-[var(--color-text)] mb-2"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  {feature.title}
                </h4>
                <p
                  className="text-sm text-[var(--color-text-secondary)]"
                >
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section
        id="benefits"
        className="px-4 py-20 md:py-32"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Section title */}
          <h3
            className="text-2xl md:text-3xl font-bold text-center mb-12 text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Why Choose CardTrack?
          </h3>

          {/* Benefits list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { number: '1M+', label: 'Benefits Tracked' },
              { number: '100K+', label: 'Active Users' },
              { number: '4.8/5', label: 'User Rating' },
            ].map((stat, idx) => (
              <div key={idx} className="text-center">
                <div
                  className="text-3xl md:text-4xl font-bold mb-2 text-[var(--color-primary)]"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {stat.number}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="px-4 py-20 md:py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h3
            className="text-2xl md:text-3xl font-bold mb-6 text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Ready to Take Control?
          </h3>
          <p
            className="text-base mb-8 text-[var(--color-text-secondary)]"
          >
            Start tracking your credit card benefits today. It's free and takes less than 2 minutes to set up.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                variant="primary"
                className="w-full sm:w-auto"
              >
                Create Your Free Account
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
              >
                Sign In to Existing Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t py-8 mt-auto"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <p>&copy; 2024 CardTrack. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-[var(--color-text)] transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-[var(--color-text)] transition-colors">
                Terms
              </a>
              <a href="#" className="hover:text-[var(--color-text)] transition-colors">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
