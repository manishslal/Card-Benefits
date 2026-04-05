'use client';

import React, { useState } from 'react';
import { SkeletonCard, SkeletonText, SkeletonList, LoadingSpinner, ProgressBar } from '@/shared/components/loaders';
import { Button } from '@/shared/components/ui/button';

/**
 * Loading States Demo Page
 * 
 * Demonstrates all loading state components:
 * - SkeletonCard
 * - SkeletonText
 * - SkeletonList
 * - LoadingSpinner
 * - ProgressBar
 */
export default function LoadingStatesPage() {
  const [progress, setProgress] = useState(0);

  const handleProgressClick = () => {
    setProgress((prev) => (prev >= 100 ? 0 : prev + 25));
  };

  return (
    <div className="min-h-screen p-8 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-[var(--color-text)]">Loading States Demo</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          Demonstrates all loading state components with accessibility features
        </p>

        {/* SkeletonCard Demo */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">SkeletonCard</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SkeletonCard rows={3} showImage={true} />
            <SkeletonCard rows={2} showImage={false} />
            <SkeletonCard rows={4} showImage={true} />
          </div>
        </section>

        {/* SkeletonText Demo */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">SkeletonText</h2>
          <div className="space-y-4">
            <SkeletonText lines={2} width="100%" />
            <SkeletonText lines={3} width="100%" />
            <SkeletonText lines={4} width="80%" />
          </div>
        </section>

        {/* SkeletonList Demo */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">SkeletonList (Cards)</h2>
          <SkeletonList count={3} itemType="card" />
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">SkeletonList (Rows)</h2>
          <SkeletonList count={5} itemType="row" />
        </section>

        {/* LoadingSpinner Demo */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">LoadingSpinner</h2>
          <div className="flex gap-8 items-center">
            <div className="text-center">
              <LoadingSpinner size="sm" ariaLabel="Loading small" />
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">Small</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="md" ariaLabel="Loading medium" />
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">Medium</p>
            </div>
            <div className="text-center">
              <LoadingSpinner size="lg" ariaLabel="Loading large" />
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">Large</p>
            </div>
          </div>
        </section>

        {/* ProgressBar Demo */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-text)]">ProgressBar</h2>
          <div className="space-y-8 max-w-2xl">
            <ProgressBar
              progress={progress}
              label={`Step ${Math.round(progress / 25) + 1} of 5`}
              showPercentage={true}
              animated={true}
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleProgressClick}
            >
              Increment Progress ({progress}%)
            </Button>
            <ProgressBar
              progress={75}
              label="Upload Progress"
              showPercentage={true}
              animated={true}
            />
            <ProgressBar
              progress={100}
              showPercentage={false}
              animated={false}
            />
          </div>
        </section>

        {/* Accessibility Notes */}
        <section className="mb-12 p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h2 className="text-lg font-semibold mb-3 text-[var(--color-text)]">Accessibility Features</h2>
          <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li>✓ All components have <code className="bg-[var(--color-bg)] px-1 rounded">role</code> attributes</li>
            <li>✓ Screen reader announcements via <code className="bg-[var(--color-bg)] px-1 rounded">aria-label</code></li>
            <li>✓ Proper contrast in light and dark modes</li>
            <li>✓ Smooth animations (no flashing or seizure triggers)</li>
            <li>✓ Minimum 200ms display time to avoid visual flashing</li>
            <li>✓ Keyboard navigation support</li>
            <li>✓ Semantic HTML structure</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
