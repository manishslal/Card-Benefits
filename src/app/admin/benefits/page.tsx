/**
 * Admin Benefits Management Page
 * Manage system-wide benefit types and definitions
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 * 
 * Phase 5 Enhancements:
 * - Card column display showing associated MasterCard
 * - Filter by card dropdown (fetches all unique cards, not paginated)
 * - Edit benefit modal with type validation
 * - Currency formatting (cents to dollars display)
 * - Search debounce (400ms) to reduce API calls
 * - Search includes card names
 */

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { AdminBreadcrumb } from '../_components/AdminBreadcrumb';
import { CardFilterDropdown } from '../_components/CardFilterDropdown';
import { EditBenefitModal } from '../_components/EditBenefitModal';
import { formatCurrency } from '@/shared/lib/format-currency';
import type { Benefit, PaginationInfo } from '@/features/admin/types/admin';

// ============================================================
// Custom Hook: useDebounce
// ============================================================

/**
 * Hook to debounce a value with configurable delay.
 * Prevents excessive API calls when search input changes rapidly.
 * 
 * @param value The value to debounce
 * @param delayMs Debounce delay in milliseconds (default: 400ms)
 * @returns Debounced value
 */
function useDebounce<T>(value: T, delayMs: number = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up a timeout to update the debounced value after the delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // Clear the timeout if the value changes before the delay expires
    return () => clearTimeout(handler);
  }, [value, delayMs]);

  return debouncedValue;
}

// ============================================================
// Component
// ============================================================

interface BenefitsListResponse {
  success: boolean;
  data: Benefit[];
  pagination: PaginationInfo;
}

interface CardOption {
  id: string;
  cardName: string;
}

// Type definitions for sortable columns
type SortableBenefitColumn = 'name' | 'type' | 'stickerValue' | 'card';
type SortOrder = 'asc' | 'desc';

export default function BenefitsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(''); // Raw search input for immediate UI update
  const [sortBy, setSortBy] = useState<SortableBenefitColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  // Debounce search input to reduce API calls
  const debouncedSearch = useDebounce(searchInput, 400);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // NEW: Filter and edit modal state
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [availableCards, setAvailableCards] = useState<CardOption[]>([]);
  const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);

  // Issue 14: Standardize page title to "Admin Dashboard - Benefits"
  // Issue 12: Initialize sort params from URL on mount
  useEffect(() => {
    document.title = 'Admin Dashboard - Benefits';
    
    // Read sorting and card filter params from URL query string
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sortParam = params.get('sort') as SortableBenefitColumn | null;
      const orderParam = params.get('order') as SortOrder | null;
      const cardParam = params.get('card') as string | null;
      
      if (sortParam) {
        setSortBy(sortParam);
      }
      if (orderParam) {
        setSortOrder(orderParam);
      }
      if (cardParam) {
        setSelectedCard(cardParam);
      }
    }
  }, []);

  /**
   * Issue 12: Handle column header clicks to toggle sorting
   */
  const handleSort = (column: SortableBenefitColumn) => {
    if (sortBy === column) {
      const newOrder: SortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      const params = new URLSearchParams();
      params.set('sort', column);
      params.set('order', newOrder);
      if (selectedCard) params.set('card', selectedCard);
      window.history.pushState({}, '', `?${params.toString()}`);
    } else {
      setSortBy(column);
      setSortOrder('asc');
      const params = new URLSearchParams();
      params.set('sort', column);
      params.set('order', 'asc');
      if (selectedCard) params.set('card', selectedCard);
      window.history.pushState({}, '', `?${params.toString()}`);
    }
    setPage(1);
  };

  /**
   * NEW: Handle card filter selection
   */
  const handleCardFilter = (cardId: string | null) => {
    setSelectedCard(cardId);
    setPage(1); // Reset to page 1 when filter changes
    
    // Update URL
    const params = new URLSearchParams();
    if (cardId) params.set('card', cardId);
    if (sortBy) {
      params.set('sort', sortBy);
      params.set('order', sortOrder);
    }
    window.history.pushState({}, '', params.toString() ? `?${params.toString()}` : '?');
  };

  /**
   * NEW: Handle edit button click
   */
  const handleEdit = (benefit: Benefit) => {
    setEditingBenefit(benefit);
  };

  /**
   * Issue 12: Render sort indicator for column headers
   */
  const getSortIndicator = (column: SortableBenefitColumn): string => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  /**
   * NEW (Phase 5): Handle debounced search changes
   * When debouncedSearch changes (after 400ms of user inactivity),
   * reset to page 1 to show fresh results
   */
  useEffect(() => {
    // Reset page to 1 whenever debounced search changes
    setPage(1);
  }, [debouncedSearch]);

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

  // Build fetch URL with sorting and card filter parameters
  const buildFetchUrl = (): string => {
    let url = `/admin/benefits?page=${page}&limit=20`;
    // Use debouncedSearch instead of raw search state for API calls
    if (debouncedSearch) url += `&search=${debouncedSearch}`;
    if (selectedCard) url += `&card=${selectedCard}`; // NEW: Add card filter
    if (sortBy) {
      url += `&sort=${sortBy}&order=${sortOrder}`;
    }
    return url;
  };

  const { data, isLoading, mutate } = useSWR<BenefitsListResponse>(
    buildFetchUrl(),
    async () => {
      try {
        return await apiClient.get('/benefits', {
          params: { 
            page, 
            limit: 20, 
            search: debouncedSearch || undefined, // Use debounced search for API calls
            card: selectedCard || undefined, // NEW: Pass card filter
            sort: sortBy || undefined,
            order: sortBy ? sortOrder : undefined,
          },
        });
      } catch (err) {
        console.error('[BenefitsPage] Failed to fetch benefits', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/benefits',
          params: { page, limit: 20, search: debouncedSearch, card: selectedCard, sort: sortBy, order: sortOrder },
        });
        throw err;
      }
    }
  );

  /**
   * NEW: Fetch all unique cards once on component mount
   * Replaces the old approach of deriving cards from paginated benefits data.
   * This ensures the dropdown shows ALL available cards regardless of current page.
   */
  useEffect(() => {
    const fetchAvailableCards = async () => {
      try {
        const response = await apiClient.get('/benefits/cards');
        if (response.success && response.data) {
          setAvailableCards(response.data);
        }
      } catch (err) {
        console.error('[BenefitsPage] Failed to fetch unique cards', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/benefits/cards',
        });
        // Don't block the page if card fetch fails - benefits still work
      }
    };
    
    fetchAvailableCards();
  }, []); // Empty dependency array - only fetch once on mount

  // REMOVED: Old useEffect that derived unique cards from paginated benefits data (lines 198-208)
  // That approach caused dropdown to change when navigating pages

  const handleDeleteBenefit = async (benefitId: string) => {
    if (!confirm('Delete this benefit?')) return;

    try {
      await apiClient.delete(`/benefits/${benefitId}`);
      setSuccess('Benefit deleted successfully');
      mutate();
    } catch (err) {
      // Issue 13: Use getErrorMessage() for consistent error formatting
      const message = getErrorMessage(err);
      setError(message);
      console.error('[BenefitsPage] Failed to delete benefit', {
        error: message,
        endpoint: `/api/admin/benefits/${benefitId}`,
        benefitId,
      });
    }
  };

  const benefits = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb currentPage="benefits" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Benefits</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage benefit types</p>
        </div>
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

      {/* NEW: Card Filter and Search Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
            Filter by Card
          </label>
          <CardFilterDropdown
            cards={availableCards}
            selectedCard={selectedCard}
            onCardSelect={handleCardFilter}
            disabled={isLoading}
          />
        </div>
         <div className="flex-1">
          <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search benefits..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value); // Update immediately for UI responsiveness
              // debouncedSearch effect handles reset to page 1
            }}
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            title="Type to search benefits by name, type, reset cadence, or card name. Search debounces to reduce API calls."
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin">⏳</div>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Loading benefits...</p>
          </div>
        ) : benefits.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No benefits found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    {/* Issue 12: Clickable sortable column headers */}
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      <button
                        onClick={() => handleSort('name')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by name"
                      >
                        Name
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('name') || '↕'}
                        </span>
                      </button>
                    </th>
                    {/* NEW: Card column */}
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      <button
                        onClick={() => handleSort('card')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by card"
                      >
                        Card
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('card') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      <button
                        onClick={() => handleSort('type')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by type"
                      >
                        Type
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('type') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      <button
                        onClick={() => handleSort('stickerValue')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by value"
                      >
                        Value
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('stickerValue') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {benefits.map((benefit: Benefit) => (
                    <tr key={benefit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {benefit.name}
                      </td>
                      {/* NEW: Card column cell */}
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {benefit.masterCard?.cardName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {benefit.type}
                      </td>
                      {/* NEW: Apply formatCurrency to display dollars instead of cents */}
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {formatCurrency(benefit.stickerValue)}
                      </td>
                      {/* NEW: Add Edit button before Delete */}
                      <td className="px-6 py-4 text-right flex gap-2 justify-end">
                        <button
                          onClick={() => handleEdit(benefit)}
                          disabled={isLoading}
                          className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBenefit(benefit.id)}
                          disabled={isLoading}
                          className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Issue 15: Enhanced pagination feedback */}
            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore || isLoading}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEW: Edit Benefit Modal */}
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
