'use client';

import { useParams } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/features/admin/lib/api-client';
import type { Card, Benefit } from '@/features/admin/types/admin';

interface CardDetailResponse {
  success: boolean;
  data: Card & { benefits?: Benefit[] };
}

export default function CardDetailPage() {
  const params = useParams();
  const cardId = params?.id as string;
  const [showBenefitModal, setShowBenefitModal] = useState(false);
  const [benefitFormData, setBenefitFormData] = useState({
    name: '',
    type: 'INSURANCE',
    stickerValue: '',
    resetCadence: 'ANNUAL',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

    // Cleanup: Remove listener when modal closes or component unmounts
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

  const { data: cardData, isLoading, mutate } = useSWR<CardDetailResponse>(
    cardId ? `/admin/cards/${cardId}` : null,
    async () => {
      if (!cardId) return null;
      try {
        return await apiClient.get(`/cards/${cardId}`);
      } catch (err) {
        console.error('Error fetching card:', err);
        throw err;
      }
    }
  );

  const card = cardData?.data;
  const benefits = card?.benefits || [];

  const handleAddBenefit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cardId) return;
      setError(null);

      // Validate before submit
      const validationError = validateBenefitForm();
      if (validationError) {
        setError(validationError);
        return;
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
        mutate();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add benefit';
        setError(message);
      }
    },
    [cardId, benefitFormData, mutate]
  );

  const handleDeleteBenefit = useCallback(
    async (benefitId: string) => {
      if (!cardId) return;
      if (!confirm('Are you sure you want to delete this benefit?')) return;
      setError(null);

      try {
        await apiClient.delete(`/cards/${cardId}/benefits/${benefitId}`);
        setSuccess('Benefit deleted successfully');
        mutate();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete benefit';
        setError(message);
      }
    },
    [cardId, mutate]
  );

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin">⏳</div>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Loading card details...</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 dark:text-slate-400">Card not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{card.cardName}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{card.issuer}</p>
        </div>
        <a
          href="/admin/cards"
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          ← Back
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Benefits ({benefits.length})
          </h2>
          <button
            onClick={() => setShowBenefitModal(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm"
          >
            + Add Benefit
          </button>
        </div>

        {benefits.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400 text-center py-8">
            No benefits added yet
          </p>
        ) : (
          <div className="space-y-3">
            {benefits.map((benefit: Benefit) => (
              <div
                key={benefit.id}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900 dark:text-white">{benefit.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {benefit.type} • ${benefit.stickerValue}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBenefit(benefit.id)}
                  className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBenefitModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only close if clicking on backdrop, not on modal content
            if (e.target === e.currentTarget) {
              setShowBenefitModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Add Benefit</h2>

            <form onSubmit={handleAddBenefit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={benefitFormData.name}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Type *
                </label>
                <select
                  value={benefitFormData.type}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, type: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Sticker Value *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={benefitFormData.stickerValue}
                  onChange={(e) =>
                    setBenefitFormData({ ...benefitFormData, stickerValue: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBenefitModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
