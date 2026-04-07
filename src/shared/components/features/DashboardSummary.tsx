'use client';

import React from 'react';
import StatCard from '@/features/cards/components/ui/StatCard';

interface SummaryStatItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'gradient';
}

interface DashboardSummaryProps {
  stats: SummaryStatItem[];
  loading?: boolean;
}

/**
 * DashboardSummary Component - Responsive Statistics Grid
 * 
 * Features:
 * - Mobile (320px): 1 column
 * - Tablet (768px): 2 columns
 * - Desktop (1440px): 4 columns
 * - Staggered animation on load
 * - Loading skeleton states
 * - Uses StatCard for consistency
 */
const DashboardSummary = React.forwardRef<HTMLDivElement, DashboardSummaryProps>(
  ({ stats, loading = false }, ref) => {
    if (loading) {
      return (
        <div ref={ref} className="mb-8">
          <h2
            className="text-lg font-semibold mb-6"
            style={{ fontSize: 'var(--text-h4)' }}
          >
            Dashboard Overview
          </h2>

          {/* Enhancement 2: Mobile-first responsive grid - 2 cols on mobile, 3 on tablet, 4 on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg animate-pulse"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="mb-8">
        <h2
          className="text-lg font-semibold mb-6 text-[var(--color-text)]"
          style={{ fontSize: 'var(--text-h4)' }}
        >
          Dashboard Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              className="animate-fade-in"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <StatCard
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                change={stat.change}
                variant={stat.variant}
              />
            </div>
          ))}
        </div>

        {/* Animation keyframes */}
        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fade-in {
            animation: fadeIn 0.4s ease-out forwards;
          }
        `}</style>
      </div>
    );
  }
);

DashboardSummary.displayName = 'DashboardSummary';

export default DashboardSummary;
