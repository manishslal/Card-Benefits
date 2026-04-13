/**
 * Admin Users Management Page
 * Manage user roles and permissions
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 * 
 * Phase 5 Enhancement:
 * - Fixed Name column to display "LastName, FirstName" format
 */

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/features/admin/lib/api-client';
import { AdminBreadcrumb } from '../_components/AdminBreadcrumb';
import { EditUserModal } from '../_components/EditUserModal';
import { Users as UsersIcon, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import Skeleton from '@/shared/components/ui/Skeleton';
import EmptyState from '@/shared/components/ui/EmptyState';
import type { AdminUser, PaginationInfo } from '@/features/admin/types/admin';

// ============================================================
// Utility Function
// ============================================================

/**
 * Format user name from firstName and lastName in "LastName, FirstName" format.
 * Handles edge cases where firstName or lastName might be null or empty.
 * 
 * @param firstName User's first name (nullable)
 * @param lastName User's last name (nullable)
 * @returns Formatted name or 'N/A' if both are missing
 */
const formatUserName = (firstName: string | null, lastName: string | null): string => {
  if (!firstName && !lastName) return 'N/A';
  if (lastName && firstName) return `${lastName}, ${firstName}`;
  return firstName || lastName || 'N/A';
};

// ============================================================
// Component
// ============================================================

interface UsersListResponse {
  success: boolean;
  data: AdminUser[];
  pagination: PaginationInfo;
}

// Type definitions for sortable columns
type SortableUserColumn = 'name' | 'email' | 'role';
type SortOrder = 'asc' | 'desc';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  // Issue 12: Sorting state - persist in URL query params (initialize as null, read in useEffect)
  const [sortBy, setSortBy] = useState<SortableUserColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Edit user modal state (replaces old role change modal)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);

  // Issue 14: Standardize page title to "Admin Dashboard - Users"
  // Issue 12: Initialize sort params from URL on mount
  useEffect(() => {
    document.title = 'Admin Dashboard - Users';
    
    // Read sorting params from URL query string using window.location (avoids useSearchParams SSR issues)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sortParam = params.get('sort') as SortableUserColumn | null;
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


  const users = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb currentPage="users" />
      
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Users</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Manage user roles</p>
      </div>

      {error && (
        <div className="flex items-center p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 rounded hover:bg-red-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
          <span>{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto p-1 rounded hover:bg-green-200/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            aria-label="Dismiss success"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-4" role="search">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search users"
          className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      <div className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-0" role="status" aria-busy="true" aria-label="Loading users">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-b-0">
                <Skeleton width="20%" height={16} variant="text" />
                <Skeleton width="25%" height={16} variant="text" />
                <Skeleton width="12%" height={16} variant="text" />
                <Skeleton width="10%" height={16} variant="text" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={28} />}
            title="No users found"
            description={
              search
                ? 'Try adjusting your search criteria.'
                : 'No users have been registered yet.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    {/* Issue 12: Clickable sortable column headers */}
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('name')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                        title="Click to sort by name"
                        aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        Name
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('name') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('email')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                        title="Click to sort by email"
                        aria-sort={sortBy === 'email' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        Email
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('email') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
                      <button
                        onClick={() => handleSort('role')}
                        className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                        title="Click to sort by role"
                        aria-sort={sortBy === 'role' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        Role
                        <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                          {getSortIndicator('role') || '↕'}
                        </span>
                      </button>
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-[var(--color-text)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {users.map((user: AdminUser) => (
                    <tr key={user.id} className="hover:bg-[var(--color-bg-secondary)]">
                      <td className="px-6 py-4 text-sm font-medium text-[var(--color-text)]">
                        {formatUserName(user.firstName, user.lastName)}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={
                            user.role === 'SUPER_ADMIN'
                              ? { backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }
                              : user.role === 'ADMIN'
                              ? { backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }
                              : { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }
                          }
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            setSelectedUserForEdit(user);
                            setIsEditModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Issue 15: Enhanced pagination feedback */}
            <div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <EditUserModal
        user={selectedUserForEdit}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaved={() => {
          setIsEditModalOpen(false);
          setSuccess('User updated successfully');
          mutate();
        }}
      />
    </div>
  );
}
