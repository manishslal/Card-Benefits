/**
 * Admin Card Detail Page
 * Manage individual card and their benefits
 * 
 * Issue 11: Adds loading spinner while benefits are fetching
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 */

'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { formatCurrency } from '@/shared/lib/format-currency';
import type { Card, Benefit } from '@/features/admin/types/admin';
import { EditBenefitModal } from '../../_components/EditBenefitModal';
import { Loader2 } from 'lucide-react';

interface CardDetailResponse {
  success: boolean;
  data: Card & { benefits?: Benefit[] };
}

// ── Cadence badge color mapping (using CSS custom properties) ──
const CADENCE_COLORS: Record<string, { bg: string; color: string }> = {
  MONTHLY: { bg: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' },
  QUARTERLY: { bg: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' },
  SEMI_ANNUAL: { bg: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' },
  FLEXIBLE_ANNUAL: { bg: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' },
  ONE_TIME: { bg: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' },
};

const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMI_ANNUAL: 'Semi-Annual',
  FLEXIBLE_ANNUAL: 'Flex Annual',
  ONE_TIME: 'One Time',
};

export default function CardDetailPage() {
  const params = useParams();
  const cardId = params?.id as string;
  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
  const [benefitFormData, setBenefitFormData] = useState({
    name: '',
    type: 'INSURANCE',
    stickerValue: '',
    resetCadence: 'ANNUAL',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Fetch card data first
  const { data: cardData, isLoading, mutate } = useSWR<CardDetailResponse>(
    cardId ? `/admin/cards/${cardId}` : null,
    async () => {
      if (!cardId) return null;
      try {
        return await apiClient.get(`/cards/${cardId}`);
      } catch (err) {
        // Issue 13: Log structured error with context
        console.error('[CardDetailPage] Error fetching card', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: `/api/admin/cards/${cardId}`,
          cardId,
        });
        throw err;
      }
    }
  );

  const card = cardData?.data;
  const benefits = card?.benefits || [];

  // Issue 14: Standardized page title format - "Admin Dashboard - [Card Name]"
  useEffect(() => {
    if (cardData?.data?.cardName) {
      document.title = `Admin Dashboard - ${cardData.data.cardName}`;
    } else if (cardId) {
      document.title = `Admin Dashboard - Card`;
    }
  }, [cardData?.data?.cardName, cardId]);

  // Validation function for Add Benefit form
  const validateBenefitForm = (): string | null => {
    if (!benefitFormData.name.trim()) {
      return 'Benefit Name is required';
    }

    const stickerValue = parseFloat(benefitFormData.stickerValue);
    if (isNaN(stickerValue)) {
      return 'Sticker Value must be a valid number';
    }
    if (stickerValue < 0) {
      return 'Sticker Value cannot be negative';
    }

    return null; // No errors
  };

  // Escape key handler for Benefit Modal
  useEffect(() => {
    if (!showBenefitModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBenefitModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showBenefitModal]);

  // Manage success message timeout with cleanup
  useEffect(() => {
    if (!success) return;

    const timeoutId = setTimeout(() => {
      setSuccess(null);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [success]);

  // Manage error message timeout with cleanup
  useEffect(() => {
    if (!error) return;

    const timeoutId = setTimeout(() => {
      setError(null);
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [error]);

  const handleAddBenefit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cardId) return;
      setError(null);

      const validationError = validateBenefitForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsSubmitting(true);

      // Create optimistic benefit object for UI update
      const optimisticBenefit: Benefit = {
        id: `temp-${Date.now()}`,
        masterCardId: cardId,
        name: benefitFormData.name.trim(),
        type: benefitFormData.type as any,
        stickerValue: parseFloat(benefitFormData.stickerValue),
        resetCadence: benefitFormData.resetCadence as any,
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const previousData = cardData;

      if (cardData) {
        mutate(
          {
            ...cardData,
            data: {
              ...cardData.data,
              benefits: [...(cardData.data.benefits || []), optimisticBenefit],
            },
          },
          false
        );
      }

      try {
        await apiClient.post(`/cards/${cardId}/benefits`, {
          name: benefitFormData.name.trim(),
          type: benefitFormData.type,
          stickerValue: parseFloat(benefitFormData.stickerValue),
          resetCadence: benefitFormData.resetCadence,
        });

        setBenefitFormData({ name: '', type: 'INSURANCE', stickerValue: '', resetCadence: 'ANNUAL' });
        setShowBenefitModal(false);
        setSuccess('Benefit added successfully');
        
        // Revalidate with server to get real benefit with actual ID
        mutate();
      } catch (err) {
        // Rollback optimistic update on error
        if (previousData) {
          mutate(previousData, false);
        }
        // Issue 13: Use getErrorMessage() for consistent error formatting
        const message = getErrorMessage(err);
        setError(message);
        console.error('[CardDetailPage] Error adding benefit', {
          error: message,
          endpoint: `/api/admin/cards/${cardId}/benefits`,
          cardId,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [cardId, benefitFormData, cardData, mutate]
  );

  const handleDeleteBenefit = useCallback(
    async (benefitId: string) => {
      if (!cardId) return;
      if (!confirm('Are you sure you want to delete this benefit?')) return;
      setError(null);

      setIsDeleting(benefitId);

      const previousData = cardData;

      // Optimistically remove benefit from UI
      if (cardData) {
        mutate(
          {
            ...cardData,
            data: {
              ...cardData.data,
              benefits: (cardData.data.benefits || []).filter((b: Benefit) => b.id !== benefitId),
            },
          },
          false
        );
      }

      try {
        await apiClient.delete(`/cards/${cardId}/benefits/${benefitId}`);
        setSuccess('Benefit deleted successfully');
        
        // Revalidate with server
        mutate();
      } catch (err) {
        // Rollback optimistic update on error
        if (previousData) {
          mutate(previousData, false);
        }
        // Issue 13: Use getErrorMessage() for consistent error formatting
        const message = getErrorMessage(err);
        setError(message);
        console.error('[CardDetailPage] Error deleting benefit', {
          error: message,
          endpoint: `/api/admin/cards/${cardId}/benefits/${benefitId}`,
          cardId,
          benefitId,
        });
      } finally {
        setIsDeleting(null);
      }
    },
    [cardId, cardData, mutate]
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="inline-block animate-spin" size={20} />
        <p className="text-[var(--color-text-secondary)] mt-2">Loading card details...</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-8 text-center">
        <p className="text-[var(--color-text-secondary)]">Card not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">{card.cardName}</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">{card.issuer}</p>
        </div>
        <a
          href="/admin/cards"
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
        >
          ← Back
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
          {success}
        </div>
      )}

      <div className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Benefits ({benefits.length})
          </h2>
          <button
            onClick={() => setShowBenefitModal(true)}
            className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium text-sm"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            + Add Benefit
          </button>
        </div>

        {/* Issue 11: Add loading spinner while benefits are fetching */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className="h-16 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : benefits.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-8">
            No benefits added yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Type</th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-secondary)] font-medium">Value</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Reset</th>
                  <th className="text-left py-2 px-3 text-[var(--color-text-secondary)] font-medium">Cadence</th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-secondary)] font-medium">Per Period</th>
                  <th className="text-right py-2 px-3 text-[var(--color-text-secondary)] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {benefits.map((benefit: Benefit) => {
                  const needsCadenceWarning =
                    !benefit.claimingCadence && benefit.stickerValue > 0;
                  return (
                    <tr
                      key={benefit.id}
                      className={`border-b border-[var(--color-border)] transition-colors ${
                        benefit.id.startsWith('temp-')
                          ? 'opacity-70'
                          : !benefit.isActive
                            ? 'opacity-60'
                            : 'hover:bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <span className="font-medium text-[var(--color-text)]">
                          {benefit.name}
                        </span>
                        {!benefit.isActive && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                        {benefit.type}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--color-text)]">
                        {formatCurrency(benefit.stickerValue)}
                      </td>
                      <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                        {benefit.resetCadence}
                      </td>
                      <td className="py-3 px-3">
                        {benefit.claimingCadence ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: (CADENCE_COLORS[benefit.claimingCadence] || CADENCE_COLORS.ONE_TIME).bg,
                              color: (CADENCE_COLORS[benefit.claimingCadence] || CADENCE_COLORS.ONE_TIME).color,
                            }}
                          >
                            {CADENCE_LABELS[benefit.claimingCadence] || benefit.claimingCadence}
                          </span>
                        ) : needsCadenceWarning ? (
                          <span className="text-[var(--color-text-secondary)]" title="Claiming cadence not set">
                            ⚠️ Not set
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-secondary)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-[var(--color-text)]">
                        {benefit.claimingAmount != null
                          ? formatCurrency(benefit.claimingAmount)
                          : <span className="text-[var(--color-text-secondary)]">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingBenefit(benefit)}
                            className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
                            style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBenefit(benefit.id)}
                            disabled={isDeleting === benefit.id}
                            className="px-3 py-1 rounded text-sm hover:opacity-80 disabled:opacity-50 flex items-center gap-1 transition-colors"
                            style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
                          >
                            {isDeleting === benefit.id && <Loader2 className="animate-spin" size={14} />}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showBenefitModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBenefitModal(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg)] rounded-lg max-w-md w-full p-6 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">Add Benefit</h2>

            <form onSubmit={handleAddBenefit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={benefitFormData.name}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Type *
                </label>
                <select
                  disabled={isSubmitting}
                  value={benefitFormData.type}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, type: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                >
                  <option value="INSURANCE">Insurance</option>
                  <option value="CASHBACK">Cashback</option>
                  <option value="TRAVEL">Travel</option>
                  <option value="BANKING">Banking</option>
                  <option value="POINTS">Points</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Sticker Value *
                </label>
                <input
                  type="number"
                  required
                  disabled={isSubmitting}
                  min="0"
                  step="0.01"
                  value={benefitFormData.stickerValue}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, stickerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Reset Cadence *
                </label>
                <select
                  disabled={isSubmitting}
                  value={benefitFormData.resetCadence}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, resetCadence: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                >
                  <option value="DAILY">Daily</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUAL">Annual</option>
                  <option value="ONE_TIME">One Time</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBenefitModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Benefit Modal */}
      {editingBenefit && (
        <EditBenefitModal
          benefit={editingBenefit}
          isOpen={!!editingBenefit}
          onClose={() => setEditingBenefit(null)}
          onSaved={() => {
            setEditingBenefit(null);
            setSuccess('Benefit updated successfully');
            mutate();
          }}
        />
      )}
    </div>
  );
}
