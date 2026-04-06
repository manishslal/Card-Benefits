'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import type { Benefit, PaginationInfo } from '@/features/admin/types/admin';

interface BenefitsListResponse {
  success: boolean;
  data: Benefit[];
  pagination: PaginationInfo;
}

export default function BenefitsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Update page title on mount
  useEffect(() => {
    document.title = 'Benefits - Admin Dashboard';
  }, []);

  const { data, isLoading, mutate } = useSWR<BenefitsListResponse>(
    `/admin/benefits?page=${page}&limit=20${search ? `&search=${search}` : ''}`,
    async () => {
      try {
        // Fetch benefits with pagination - limit is capped at 100 items per page on server
        return await apiClient.get('/benefits', {
          params: { page, limit: 20, search: search || undefined },
        });
      } catch (err) {
        // Log structured error with context for debugging data fetching issues
        console.error('[BenefitsPage] Failed to fetch benefits', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/benefits',
          params: { page, limit: 20, search },
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
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      // Log structured error with context for debugging delete operations
      console.error('[BenefitsPage] Failed to delete benefit', {
        error: message,
        endpoint: `/api/admin/benefits/${benefitId}`,
        benefitId,
        statusCode: err instanceof Error ? (err as any).response?.status : 'unknown',
      });
    }
  };

  const benefits = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      Value
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
    </div>
  );
}
