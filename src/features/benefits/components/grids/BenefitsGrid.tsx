'use client';

import React from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/button';
import { Plane, Tag, Utensils, DollarSign, Zap } from 'lucide-react';

interface Benefit {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string;
  value?: number;
  usage?: number; // 0-100 percentage
  type?: string; // travel, shopping, dining, cashback, other
}

interface BenefitsGridProps {
  benefits: Benefit[];
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
  onMarkUsed?: (benefitId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  gridColumns?: 'auto' | 2 | 3 | 4;
}

/**
 * BenefitsGrid Component - Grid View of Benefits
 * 
 * Features:
 * - Responsive grid layout
 * - Mobile (320px): 1 column
 * - Tablet (768px): 2 columns
 * - Desktop (1440px): 3 columns (default)
 * - Benefit type icons (Plane, Tag, Utensils, DollarSign)
 * - Status badges with icons
 * - Hover: lift effect, shadow elevation
 * - Compact card format
 * - Empty state handling
 */
const BenefitsGrid = React.forwardRef<HTMLDivElement, BenefitsGridProps>(
  (
    {
      benefits,
      onEdit,
      onDelete,
      onMarkUsed,
      loading = false,
      emptyMessage = 'No benefits found',
      gridColumns = 3,
    },
    ref
  ) => {
    // Benefit type icons
    const getBenefitTypeIcon = (type?: string) => {
      const iconProps = { size: 20, className: 'flex-shrink-0' };
      switch (type?.toLowerCase()) {
        case 'travel':
          return <Plane {...iconProps} aria-hidden="true" />;
        case 'shopping':
          return <Tag {...iconProps} aria-hidden="true" />;
        case 'dining':
          return <Utensils {...iconProps} aria-hidden="true" />;
        case 'cashback':
          return <DollarSign {...iconProps} aria-hidden="true" />;
        default:
          return <Zap {...iconProps} aria-hidden="true" />;
      }
    };

    const getStatusBadge = (status: Benefit['status']) => {
      const variants = {
        active: 'success',
        expiring: 'warning',
        expired: 'error',
        pending: 'info',
      } as const;

      const labels = {
        active: 'Active',
        expiring: 'Expiring Soon',
        expired: 'Expired',
        pending: 'Pending',
      };

      return (
        <Badge variant={variants[status]} size="sm" showStatusIcon>
          {labels[status]}
        </Badge>
      );
    };

    const formatDate = (date?: Date | string) => {
      if (!date) return 'No exp.';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    };

    const getGridColsClass = () => {
      if (gridColumns === 'auto') return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      if (gridColumns === 2) return 'grid-cols-1 md:grid-cols-2';
      if (gridColumns === 3) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      if (gridColumns === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
      return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    };

    if (loading) {
      return (
        <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-40 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--color-bg-secondary)' }}
            />
          ))}
        </div>
      );
    }

    if (benefits.length === 0) {
      return (
        <div
          ref={ref}
          className="p-8 rounded-lg border text-center col-span-full"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
        >
          <p
            className="text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {emptyMessage}
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className={`grid ${getGridColsClass()} gap-4`}>
        {benefits.map((benefit, index) => (
          <div
            key={benefit.id}
            className="p-4 rounded-lg border transition-all duration-200 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-lg hover:-translate-y-1"
            style={{
              animation: `scaleIn 0.3s ease-out forwards`,
              animationDelay: `${index * 50}ms`,
            }}
          >
            <div className="flex flex-col h-full gap-3">
              {/* Header: Icon + Name + Status Badge */}
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <div className="mt-0.5 text-[var(--color-primary)] flex-shrink-0">
                    {getBenefitTypeIcon(benefit.type)}
                  </div>
                  <h3
                    className="flex-1 font-semibold text-[var(--color-text)] line-clamp-2"
                    style={{ fontSize: 'var(--text-body-sm)' }}
                    title={benefit.name}
                  >
                    {benefit.name}
                  </h3>
                </div>
                {getStatusBadge(benefit.status)}
              </div>

              {/* Description (optional) */}
              {benefit.description && (
                <p
                  className="text-xs line-clamp-2 flex-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title={benefit.description}
                >
                  {benefit.description}
                </p>
              )}

              {/* Value and Expiration */}
              <div className="flex items-center justify-between text-xs gap-2">
                {benefit.value && (
                  <span
                    className="font-mono font-semibold"
                    style={{ color: 'var(--color-success)' }}
                  >
                    ${benefit.value}
                  </span>
                )}
                {benefit.expirationDate && (
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Exp: {formatDate(benefit.expirationDate)}
                  </span>
                )}
              </div>

              {/* Usage bar if applicable */}
              {benefit.usage !== undefined && (
                <div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${benefit.usage}%`,
                        backgroundColor:
                          benefit.usage > 75
                            ? 'var(--color-success)'
                            : benefit.usage > 50
                              ? 'var(--color-info)'
                              : 'var(--color-warning)',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs mt-1 block"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {benefit.usage}% used
                  </span>
                </div>
              )}

              {/* Action buttons - compact layout */}
              <div className="flex gap-1 mt-auto pt-2 flex-wrap">
                {onMarkUsed && benefit.status === 'active' && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => onMarkUsed(benefit.id)}
                    className="flex-1 min-w-0"
                  >
                    Used
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="tertiary"
                    size="xs"
                    onClick={() => onEdit(benefit.id)}
                    className="flex-1 min-w-0"
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="tertiary"
                    size="xs"
                    onClick={() => onDelete(benefit.id)}
                    className="text-[var(--color-error)]"
                  >
                    ×
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Animation keyframes */}
        <style jsx>{`
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }
);

BenefitsGrid.displayName = 'BenefitsGrid';

export default BenefitsGrid;
