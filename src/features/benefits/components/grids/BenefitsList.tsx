'use client';

import React from 'react';
import Badge from '@/shared/components/ui/Badge';
import Button from '@/shared/components/ui/button';
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

interface BenefitsListProps {
  benefits: Benefit[];
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
  onMarkUsed?: (benefitId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

/**
 * BenefitsList Component - Card-Based List View
 * 
 * Features:
 * - Vertical card list layout
 * - Benefit type icons (Plane, Tag, Utensils, DollarSign)
 * - Status badges (color-coded with icons)
 * - Expiration dates in human-readable format
 * - Action buttons (edit, delete, mark as used)
 * - Empty state handling
 * - Responsive spacing
 */
const BenefitsList = React.forwardRef<HTMLDivElement, BenefitsListProps>(
  (
    {
      benefits,
      onEdit,
      onDelete,
      onMarkUsed,
      loading = false,
      emptyMessage = 'No benefits found',
    },
    ref
  ) => {
    // Benefit type icons
    const getBenefitTypeIcon = (type?: string) => {
      const iconProps = { size: 18, className: 'flex-shrink-0' };
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
      if (!date) return 'No expiration';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const daysUntilExpiration = (date?: Date | string) => {
      if (!date) return null;
      const d = new Date(date);
      const now = new Date();
      const days = Math.ceil(
        (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? days : null;
    };

    if (loading) {
      return (
        <div ref={ref} className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg animate-pulse"
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
          className="p-8 rounded-lg border text-center"
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
      <div ref={ref} className="space-y-3">
        {benefits.map((benefit, index) => {
          const daysLeft = daysUntilExpiration(benefit.expirationDate);

          return (
            <div
              key={benefit.id}
              className="p-4 rounded-lg border transition-all duration-200 bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-md"
              style={{
                animation: `slideIn 0.3s ease-out forwards`,
                animationDelay: `${index * 50}ms`,
              }}
            >
              <div className="flex flex-col gap-3">
                {/* Header: Icon + Name + Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1">
                    <div className="mt-1 text-[var(--color-primary)]">
                      {getBenefitTypeIcon(benefit.type)}
                    </div>
                    <div className="flex-1">
                      <h3
                        className="font-semibold text-[var(--color-text)]"
                        style={{ fontSize: 'var(--text-body-md)' }}
                      >
                        {benefit.name}
                      </h3>
                      {benefit.description && (
                        <p
                          className="text-xs mt-1"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {benefit.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(benefit.status)}
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span
                      className="block font-semibold text-[var(--color-text-secondary)]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Expiration
                    </span>
                    <span
                      className="block mt-1 text-[var(--color-text)]"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {formatDate(benefit.expirationDate)}
                      {daysLeft && (
                        <span
                          className="ml-2 font-medium"
                          style={{
                            color:
                              daysLeft <= 30
                                ? 'var(--color-warning)'
                                : 'var(--color-success)',
                          }}
                        >
                          ({daysLeft}d)
                        </span>
                      )}
                    </span>
                  </div>

                  {benefit.value && (
                    <div>
                      <span
                        className="block font-semibold"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Value
                      </span>
                      <span
                        className="block mt-1 font-mono font-semibold text-[var(--color-success)]"
                        style={{ color: 'var(--color-success)' }}
                      >
                        ${benefit.value}
                      </span>
                    </div>
                  )}
                </div>

                {/* Usage bar if applicable */}
                {benefit.usage !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Usage
                      </span>
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {benefit.usage}%
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
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
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  {onMarkUsed && benefit.status === 'active' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onMarkUsed(benefit.id)}
                    >
                      Mark Used
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onEdit(benefit.id)}
                    >
                      Edit
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => onDelete(benefit.id)}
                      className="text-[var(--color-error)]"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Animation keyframes */}
        <style jsx>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-8px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    );
  }
);

BenefitsList.displayName = 'BenefitsList';

export default BenefitsList;
