/**
 * Admin Cards Management Page
 * List, create, edit, and delete card types
 * 
 * Implements optimistic UI updates: immediately reflect user actions in UI,
 * revert on error if API call fails. This provides fast, responsive UX.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import type { Card, PaginationInfo } from '@/features/admin/types/admin';

interface CardsListResponse {
  success: boolean;
  data: Card[];
  pagination: PaginationInfo;
}

export default function CardsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Note: sortBy and sortOrder currently unused - can be added to query params when implementing sorting
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    issuer: '',
    cardName: '',
    defaultAnnualFee: '',
    cardImageUrl: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Update page title on mount
  useEffect(() => {
    document.title = 'Cards - Admin Dashboard';
  }, []);

  // Track request ID to prevent race condition - responses from older requests are ignored
  const requestIdRef = useRef(0);

  // Helper function to validate URL
  const isValidUrl = (url: string): boolean => {
    if (!url) return true; // Optional field
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Validation function for Create Card form
  const validateForm = (): string | null => {
    if (!formData.issuer.trim()) {
      return 'Issuer is required';
    }
    if (!formData.cardName.trim()) {
      return 'Card Name is required';
    }

    const fee = parseFloat(formData.defaultAnnualFee);
    if (isNaN(fee)) {
      return 'Annual Fee must be a valid number';
    }
    if (fee < 0) {
      return 'Annual Fee cannot be negative';
    }

    if (!isValidUrl(formData.cardImageUrl)) {
      return 'Card Image URL must be a valid URL';
    }

    return null; // No errors
  };

  // Escape key handler for Create Modal
  useEffect(() => {
    if (!showCreateModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    // Cleanup: Remove listener when modal closes or component unmounts
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showCreateModal]);

  // Escape key handler for Delete Modal
  useEffect(() => {
    if (!showDeleteModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    // Cleanup: Remove listener when modal closes or component unmounts
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showDeleteModal]);

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

  // TODO: Wire up sorting to column headers
  // handleSort and getSortIndicator functions prepared for future sorting UI

  // Fetch cards with pagination and request tracking for race condition prevention
  const { data, isLoading, mutate } = useSWR<CardsListResponse>(
    `/admin/cards?page=${page}&limit=20${search ? `&search=${search}` : ''}&status=${activeFilter === 'archived' ? 'archived' : activeFilter === 'active' ? 'active' : 'all'}`,
    async () => {
      // Increment request ID to track this request
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      try {
        const response = await apiClient.get('/cards', {
          params: {
            page,
            limit: 20,
            search: search || undefined,
            status: activeFilter === 'archived' ? 'archived' : activeFilter === 'active' ? 'active' : undefined,
          },
        });

        // Only update state if this is the latest request
        // This prevents out-of-order responses from overwriting newer data
        if (currentRequestId === requestIdRef.current) {
          return response;
        }
        return null;
      } catch (err) {
        console.error('Error fetching cards:', err);
        throw err;
      }
    }
  );

  const handleCreateCard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Validate before submit
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsSubmitting(true);

      // Create optimistic card object for UI update
      const optimisticCard: Card = {
        id: `temp-${Date.now()}`, // Temporary ID
        issuer: formData.issuer.trim(),
        cardName: formData.cardName.trim(),
        defaultAnnualFee: parseFloat(formData.defaultAnnualFee),
        cardImageUrl: formData.cardImageUrl.trim(),
        displayOrder: 0,
        isActive: true,
        isArchived: false,
        benefitCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store previous data for rollback in case of error
      const previousData = data;

      // Optimistically update UI with new card
      if (data) {
        mutate(
          {
            ...data,
            data: [optimisticCard, ...data.data],
          },
          false // Don't revalidate immediately
        );
      }

      try {
        await apiClient.post('/cards', {
          issuer: formData.issuer.trim(),
          cardName: formData.cardName.trim(),
          defaultAnnualFee: parseFloat(formData.defaultAnnualFee),
          cardImageUrl: formData.cardImageUrl.trim(),
        });

        setFormData({ issuer: '', cardName: '', defaultAnnualFee: '', cardImageUrl: '' });
        setShowCreateModal(false);
        setSuccess('Card created successfully');
        
        // Revalidate with server to get real card with actual ID
        mutate();
      } catch (err) {
        // Rollback optimistic update on error
        if (previousData) {
          mutate(previousData, false);
        }
        const message = getErrorMessage(err);
        setError(message);
        console.error('Error creating card:', err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, data, mutate]
  );

  const handleDeleteCardConfirm = useCallback(
    async () => {
      if (!deleteCardId) return;

      setIsDeleting(true);
      setError(null);

      // Store previous data for rollback in case of error
      const previousData = data;

      // Optimistically remove card from UI
      if (data) {
        mutate(
          {
            ...data,
            data: data.data.filter((card: Card) => card.id !== deleteCardId),
          },
          false // Don't revalidate immediately
        );
      }

      try {
        await apiClient.delete(`/cards/${deleteCardId}`);
        setSuccess('Card deleted successfully');
        setShowDeleteModal(false);
        setDeleteCardId(null);
        
        // Revalidate with server
        mutate();
      } catch (err) {
        // Rollback optimistic update on error
        if (previousData) {
          mutate(previousData, false);
        }
        const message = getErrorMessage(err);
        setError(message);
        console.error('Error deleting card:', err);
      } finally {
        setIsDeleting(false);
      }
    },
    [deleteCardId, data, mutate]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      setDeleteCardId(cardId);
      setShowDeleteModal(true);
    },
    []
  );

  // Reset page to 1 when search changes to prevent pagination inconsistency
  useEffect(() => {
    // This effect ensures when user types in search, page resets to 1
    // This prevents showing page 2 results with a new search query
    if (page !== 1) {
      setPage(1);
    }
  }, [search]);

  const cards = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Cards</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage master card types
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
        >
          + Add Card
        </button>
      </div>

      {/* Notifications */}
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

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // Reset to page 1 when searching
            }}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Status Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setActiveFilter('all');
              setPage(1);
            }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            All Cards
          </button>
          <button
            onClick={() => {
              setActiveFilter('active');
              setPage(1);
            }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeFilter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => {
              setActiveFilter('archived');
              setPage(1);
            }}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activeFilter === 'archived'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            Archived Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin">⏳</div>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Loading cards...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No cards found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Issuer
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Card Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Annual Fee
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Benefits
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {cards.map((card: Card) => (
                    <tr
                      key={card.id}
                      className={`transition-colors ${
                        card.id.startsWith('temp-')
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-medium">
                        {card.issuer}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {card.cardName}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${card.defaultAnnualFee}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {card.benefitCount || 0} benefits
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!card.id.startsWith('temp-') && (
                            <a
                              href={`/admin/cards/${card.id}`}
                              className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            >
                              View
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore || isLoading}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only close if clicking on backdrop, not on modal content
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Create New Card
            </h2>

            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Issuer *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="e.g., Visa, Mastercard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Card Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.cardName}
                  onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="e.g., Premium Card"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Annual Fee *
                </label>
                <input
                  type="number"
                  required
                  disabled={isSubmitting}
                  min="0"
                  step="0.01"
                  value={formData.defaultAnnualFee}
                  onChange={(e) => setFormData({ ...formData, defaultAnnualFee: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  disabled={isSubmitting}
                  value={formData.cardImageUrl}
                  onChange={(e) => setFormData({ ...formData, cardImageUrl: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <span className="animate-spin">⏳</span>}
                  {isSubmitting ? 'Creating...' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deleteCardId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Only close if clicking on backdrop, not on modal content
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Delete Card
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete this card? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCardConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting && <span className="animate-spin">⏳</span>}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
