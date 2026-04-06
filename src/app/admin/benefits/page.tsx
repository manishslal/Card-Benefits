/**
 * Admin Benefits Management Page
 * Manage system-wide benefit types and definitions
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 */

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { AdminBreadcrumb } from '../_components/AdminBreadcrumb';
import type { Benefit, PaginationInfo } from '@/features/admin/types/admin';

interface BenefitsListResponse {
  success: boolean;
  data: Benefit[];
  pagination: PaginationInfo;
}

// Type definitions for sortable columns
type SortableBenefitColumn = 'name' | 'type' | 'stickerValue';
type SortOrder = 'asc' | 'desc';
export default function BenefitsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Issue 12: Sorting state - persist in URL query params (initialize as null, read in useEffect)
  const [sortBy, setSortBy] = useState<SortableBenefitColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Issue 14: Standardize page title to "Admin Dashboard - Benefits"
  // Issue 12: Initialize sort params from URL on mount
  useEffect(() => {
    document.title = 'Admin Dashboard - Benefits';
    
    // Read sorting params from URL query string using window.location (avoids useSearchParams SSR issues)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sortParam = params.get('sort') as SortableBenefitColumn | null;
      const orderParam = params.get('order') as SortOrder | null;
      
      if (sortParam) {
        setSortBy(sortParam);
      }
      if (orderParam) {
        setSortOrder(orderParam);
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
      window.history.pushState({}, '', `?${params.toString()}`);
    } else {
      setSortBy(column);
      setSortOrder('asc');
      const params = new URLSearchParams();
      params.set('sort', column);
      params.set('order', 'asc');
      window.history.pushState({}, '', `?${params.toString()}`);
    }
    setPage(1);
  };

  /**
   * Issue 12: Render sort indicator for column headers
   */
  const getSortIndicator = (column: SortableBenefitColumn): string => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

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

  // Build fetch URL with sorting parameters - Issue 12
  const buildFetchUrl = (): string => {
    let url = `/admin/benefits?page=${page}&limit=20`;
    if (search) url += `&search=${search}`;
    if (sortBy) {
      url += `&sort=${sortBy}&order=${sortOrder}`;
    }
    return url;
  };

  const { data, isLoading, mutate } = useSWR<BenefitsListResponse>(
    buildFetchUrl(),
    async () => {
      try {
        // Issue 12: Pass sort parameters to API
        return await apiClient.get('/benefits', {
          params: { 
            page, 
            limit: 20, 
            search: search || undefined,
            sort: sortBy || undefined,
            order: sortBy ? sortOrder : undefined,
          },
        });
      } catch (err) {
        console.error('[BenefitsPage] Failed to fetch benefits', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/benefits',
          params: { page, limit: 20, search, sort: sortBy, order: sortOrder },
        });
        throw err;
      }
    }
  );

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

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search benefits..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {benefit.type}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        ${benefit.stickerValue}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteBenefit(benefit.id)}
                          className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
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
    </div>
  );
}
