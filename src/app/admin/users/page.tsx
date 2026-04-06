/**
 * Admin Users Management Page
 * Manage user roles and permissions
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import type { AdminUser, PaginationInfo } from '@/features/admin/types/admin';

interface UsersListResponse {
  success: boolean;
  data: AdminUser[];
  pagination: PaginationInfo;
}

// Type definitions for sortable columns
type SortableUserColumn = 'name' | 'email' | 'role';
type SortOrder = 'asc' | 'desc';

export default function UsersPage() {
  const searchParams = useSearchParams();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Issue 12: Sorting state - persist in URL query params
  const [sortBy, setSortBy] = useState<SortableUserColumn | null>(
    (searchParams?.get('sort') as SortableUserColumn | null) || null
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    (searchParams?.get('order') as SortOrder) || 'asc'
  );
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN' | 'SUPER_ADMIN'>('USER');

  // Issue 14: Standardize page title to "Admin Dashboard - Users"
  useEffect(() => {
    document.title = 'Admin Dashboard - Users';
  }, []);

  /**
   * Issue 12: Handle column header clicks to toggle sorting
   */
  const handleSort = (column: SortableUserColumn) => {
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
  const getSortIndicator = (column: SortableUserColumn): string => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Escape key handler for Role Change Modal
  useEffect(() => {
    if (!roleModalOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRoleModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [roleModalOpen]);

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
    let url = `/admin/users?page=${page}&limit=20`;
    if (search) url += `&search=${search}`;
    if (sortBy) {
      url += `&sort=${sortBy}&order=${sortOrder}`;
    }
    return url;
  };

  const { data, isLoading, mutate } = useSWR<UsersListResponse>(
    buildFetchUrl(),
    async () => {
      try {
        // Issue 12: Pass sort parameters to API
        return await apiClient.get('/users', {
          params: { 
            page, 
            limit: 20, 
            search: search || undefined,
            sort: sortBy || undefined,
            order: sortBy ? sortOrder : undefined,
          },
        });
      } catch (err) {
        console.error('[UsersPage] Failed to fetch users', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/users',
          params: { page, limit: 20, search, sort: sortBy, order: sortOrder },
        });
        throw err;
      }
    }
  );

  const handleRoleChange = async () => {
    if (!selectedUser) return;

    try {
      await apiClient.post(`/users/${selectedUser.id}/role`, {
        role: newRole,
      });

      setSuccess(`Role updated successfully`);
      setRoleModalOpen(false);
      mutate();
    } catch (err) {
      // Issue 13: Use getErrorMessage() for consistent error formatting
      const message = getErrorMessage(err);
      setError(message);
      console.error('[UsersPage] Failed to update user role', {
        error: message,
        endpoint: `/api/admin/users/${selectedUser?.id}/role`,
        userId: selectedUser?.id,
        newRole,
      });
    }
  };

  const users = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">Manage user roles</p>
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
          placeholder="Search users..."
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
            <p className="text-slate-600 dark:text-slate-400 mt-2">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No users found</p>
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
                        onClick={() => handleSort('email')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by email"
                      >
                        Email
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('email') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
                      <button
                        onClick={() => handleSort('role')}
                        className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        title="Click to sort by role"
                      >
                        Role
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('role') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((user: AdminUser) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.role === 'SUPER_ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                            : user.role === 'ADMIN'
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole('USER');
                            setRoleModalOpen(true);
                          }}
                          className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                        >
                          Change Role
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

      {roleModalOpen && selectedUser && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setRoleModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Change User Role
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Select a new role for {selectedUser.name}
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'USER' | 'ADMIN' | 'SUPER_ADMIN')}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRoleModalOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
