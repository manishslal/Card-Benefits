/**
 * Admin Cards Management Page
 * List, create, edit, and delete card types
 * 
 * Implements optimistic UI updates: immediately reflect user actions in UI,
 * revert on error if API call fails. This provides fast, responsive UX.
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { AdminBreadcrumb } from '../_components/AdminBreadcrumb';
import { Loader2, Plus } from 'lucide-react';
import type { Card, PaginationInfo } from '@/features/admin/types/admin';

interface CardsListResponse {
  success: boolean;
  data: Card[];
  pagination: PaginationInfo;
}

// Type definitions for sortable columns - only these columns support sorting
type SortableCardColumn = 'issuer' | 'cardName' | 'defaultAnnualFee';
type SortOrder = 'asc' | 'desc';

export default function CardsPage() {
  // State management
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'archived'>('all');
  
  // Issue 12: Sorting state - persist in URL query params (initialize as null, read in useEffect)
  const [sortBy, setSortBy] = useState<SortableCardColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Modal and form state
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

  // Issue 14: Standardize page title to "Admin Dashboard - Cards"
  // Issue 12: Initialize sort params from URL on mount
  useEffect(() => {
    document.title = 'Admin Dashboard - Cards';
    
    // Read sorting params from URL query string using window.location (avoids useSearchParams SSR issues)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sortParam = params.get('sort') as SortableCardColumn | null;
      const orderParam = params.get('order') as SortOrder | null;
      
      if (sortParam) {
        setSortBy(sortParam);
      }
      if (orderParam) {
        setSortOrder(orderParam);
      }
    }
  }, []);

  // Track request ID to prevent race condition
  const requestIdRef = useRef(0);

  /**
   * Issue 12: Handle column header clicks to toggle sorting
   * Supports ascending/descending sort on specific columns
   * Updates URL query params to persist sort preference
   */
  const handleSort = (column: SortableCardColumn) => {
    if (sortBy === column) {
      // Toggle sort order if clicking same column
      const newOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      // Update URL query params
      const params = new URLSearchParams();
      params.set('sort', column);
      params.set('order', newOrder);
      window.history.pushState({}, '', `?${params.toString()}`);
    } else {
      // New column selected, start with ascending
      setSortBy(column);
      setSortOrder('asc');
      // Update URL query params
      const params = new URLSearchParams();
      params.set('sort', column);
      params.set('order', 'asc');
      window.history.pushState({}, '', `?${params.toString()}`);
    }
    setPage(1); // Reset to page 1 when sorting changes
  };

  /**
   * Issue 12: Render sort indicator (arrow) for column headers
   * Returns ↑ for ascending, ↓ for descending, empty for unsorted
   */
  const getSortIndicator = (column: SortableCardColumn): string => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

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

  // Build query string for SWR key with sorting parameters - Issue 12
  const buildFetchUrl = (): string => {
    let url = `/admin/cards?page=${page}&limit=20`;
    if (search) url += `&search=${search}`;
    if (activeFilter !== 'all') {
      url += `&status=${activeFilter === 'archived' ? 'archived' : 'active'}`;
    }
    // Issue 12: Include sort params in query string
    if (sortBy) {
      url += `&sort=${sortBy}&order=${sortOrder}`;
    }
    return url;
  };

  // Fetch cards with pagination, filtering, and sorting
  const { data, isLoading, mutate } = useSWR<CardsListResponse>(
    buildFetchUrl(),
    async () => {
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      try {
        // Issue 12: Pass sort parameters to API
        const response = await apiClient.get('/cards', {
          params: {
            page,
            limit: 20,
            search: search || undefined,
            status: activeFilter === 'archived' ? 'archived' : activeFilter === 'active' ? 'active' : undefined,
            sort: sortBy || undefined,
            order: sortBy ? sortOrder : undefined,
          },
        });

        if (currentRequestId === requestIdRef.current) {
          return response;
        }
        return null;
      } catch (err) {
        console.error('[CardsPage] Failed to fetch cards', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/cards',
          params: { page, limit: 20, search, status: activeFilter, sort: sortBy, order: sortOrder },
          requestId: currentRequestId,
        });
        throw err;
      }
    }
  );

  const handleCreateCard = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }

      setIsSubmitting(true);

      const optimisticCard: Card = {
        id: `temp-${Date.now()}`,
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

      const previousData = data;

      if (data) {
        mutate(
          {
            ...data,
            data: [optimisticCard, ...data.data],
          },
          false
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
        mutate();
      } catch (err) {
        if (previousData) {
          mutate(previousData, false);
        }
        // Issue 13: Use getErrorMessage() for consistent error formatting
        const message = getErrorMessage(err);
        setError(message);
        console.error('[CardsPage] Failed to create card', {
          error: message,
          endpoint: '/api/admin/cards',
          payload: { issuer: formData.issuer, cardName: formData.cardName },
        });
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

      const previousData = data;

      if (data) {
        mutate(
          {
            ...data,
            data: data.data.filter((card: Card) => card.id !== deleteCardId),
          },
          false
        );
      }

      try {
        await apiClient.delete(`/cards/${deleteCardId}`);
        setSuccess('Card deleted successfully');
        setShowDeleteModal(false);
        setDeleteCardId(null);
        mutate();
      } catch (err) {
        if (previousData) {
          mutate(previousData, false);
        }
        // Issue 13: Use getErrorMessage() for consistent error formatting
        const message = getErrorMessage(err);
        setError(message);
        console.error('[CardsPage] Failed to delete card', {
          error: message,
          endpoint: `/api/admin/cards/${deleteCardId}`,
          cardId: deleteCardId,
        });
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

  // Reset page to 1 when search changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [search]);

  const cards = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <AdminBreadcrumb currentPage="cards" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Cards</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Manage master card types
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors flex items-center gap-1"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus size={16} /> Add Card
        </button>
      </div>

      {/* Notifications */}
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

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search cards..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                ? 'text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:opacity-80'
            }`}
            style={activeFilter === 'all' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : undefined}
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
                ? 'text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:opacity-80'
            }`}
            style={activeFilter === 'active' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : undefined}
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
                ? 'text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:opacity-80'
            }`}
            style={activeFilter === 'archived' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : undefined}
          >
            Archived Only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="inline-block animate-spin" size={20} />
            <p className="text-[var(--color-text-secondary)] mt-2">Loading cards...</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--color-text-secondary)]">No cards found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    {/* Issue 12: Make column headers clickable with sort indicators */}
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('issuer')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                        title="Click to sort by issuer"
                      >
                        Issuer
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('issuer') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('cardName')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                        title="Click to sort by card name"
                      >
                        Card Name
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('cardName') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('defaultAnnualFee')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
                        title="Click to sort by annual fee"
                      >
                        Annual Fee
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('defaultAnnualFee') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      Benefits
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-[var(--color-text)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {cards.map((card: Card) => (
                    <tr
                      key={card.id}
                      className={`transition-colors ${
                        card.id.startsWith('temp-')
                          ? 'opacity-70'
                          : 'hover:bg-[var(--color-bg-secondary)]'
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-[var(--color-text)] font-medium">
                        {card.issuer}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        {card.cardName}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        ${card.defaultAnnualFee}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        {card.benefitCount || 0} benefits
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!card.id.startsWith('temp-') && (
                            <Link
                              href={`/admin/cards/${card.id}`}
                              className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
                              style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
                            >
                              View
                            </Link>
                          )}
                          <button
                            onClick={() => handleDeleteCard(card.id)}
                            className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
                            style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
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

            {/* Issue 15: Enhanced pagination - ensure proper disabled/cursor states */}
            <div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                  className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore || isLoading}
                  className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
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
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg)] rounded-lg max-w-md w-full p-6 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">
              Create New Card
            </h2>

            <form onSubmit={handleCreateCard} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Issuer *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.issuer}
                  onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                  placeholder="e.g., Visa, Mastercard"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Card Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={formData.cardName}
                  onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                  placeholder="e.g., Premium Card"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
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
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  disabled={isSubmitting}
                  value={formData.cardImageUrl}
                  onChange={(e) => setFormData({ ...formData, cardImageUrl: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={16} />}
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
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-[var(--color-bg)] rounded-lg max-w-md w-full p-6 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">
              Delete Card
            </h2>

            <p className="text-[var(--color-text-secondary)] mb-6">
              Are you sure you want to delete this card? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCardConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                {isDeleting && <Loader2 className="animate-spin" size={16} />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
