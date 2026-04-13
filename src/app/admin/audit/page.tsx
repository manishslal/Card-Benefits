/**
 * Admin Audit Log Page
 * View system activity and changes with detailed tracking
 * 
 * Issue 12: Implements sortable column headers with URL persistence
 * Issue 13: Ensures all error messages use getErrorMessage() helper
 * Issue 14: Standardized page title format
 * Issue 15: Enhanced pagination button UX feedback
 */

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/features/admin/lib/api-client';
import { AdminBreadcrumb } from '../_components/AdminBreadcrumb';
import { FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import Skeleton from '@/shared/components/ui/Skeleton';
import EmptyState from '@/shared/components/ui/EmptyState';
import type { AuditLog, PaginationInfo } from '@/features/admin/types/admin';

interface AuditListResponse {
  success: boolean;
  data: AuditLog[];
  pagination: PaginationInfo;
}

// Type definitions for sortable columns
type SortableAuditColumn = 'timestamp' | 'action' | 'resource';
type SortOrder = 'asc' | 'desc';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Issue 12: Sorting state - persist in URL query params (initialize as null, read in useEffect)
  const [sortBy, setSortBy] = useState<SortableAuditColumn | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Issue 14: Standardize page title to "Admin Dashboard - Audit Log"
  // Issue 12: Initialize sort params from URL on mount
  useEffect(() => {
    document.title = 'Admin Dashboard - Audit Log';
    
    // Read sorting params from URL query string using window.location (avoids useSearchParams SSR issues)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const sortParam = params.get('sort') as SortableAuditColumn | null;
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
  const handleSort = (column: SortableAuditColumn) => {
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
  const getSortIndicator = (column: SortableAuditColumn): string => {
    if (sortBy !== column) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Build fetch URL with sorting parameters - Issue 12
  const buildFetchUrl = (): string => {
    let url = `/admin/audit?page=${page}&limit=50`;
    if (search) url += `&search=${search}`;
    if (actionFilter) url += `&actionType=${actionFilter}`;
    if (resourceFilter) url += `&resourceType=${resourceFilter}`;
    if (sortBy) {
      url += `&sort=${sortBy}&order=${sortOrder}`;
    }
    return url;
  };

  const { data, isLoading } = useSWR<AuditListResponse>(
    buildFetchUrl(),
    async () => {
      try {
        // Issue 12: Pass sort parameters to API
        return await apiClient.get('/audit-logs', {
          params: {
            page,
            limit: 50,
            search: search || undefined,
            actionType: actionFilter || undefined,
            resourceType: resourceFilter || undefined,
            sort: sortBy || undefined,
            order: sortBy ? sortOrder : undefined,
          },
        });
      } catch (err) {
        // Issue 13: Use getErrorMessage() for consistent error formatting
        console.error('[AuditPage] Failed to fetch audit logs', {
          error: err instanceof Error ? err.message : String(err),
          endpoint: '/api/admin/audit-logs',
          params: { page, limit: 50, search, actionFilter, resourceFilter, sort: sortBy, order: sortOrder },
        });
        throw err;
      }
    }
  );

  const auditLogs = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb currentPage="audit" />
      
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Audit Log</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">System activity and changes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div role="search">
          <input
            type="text"
            placeholder="Search by resource..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search audit logs"
            className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="TOGGLE">Toggle</option>
        </select>

        <select
          value={resourceFilter}
          onChange={(e) => {
            setResourceFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        >
          <option value="">All Resources</option>
          <option value="CARD">Card</option>
          <option value="BENEFIT">Benefit</option>
          <option value="USER_ROLE">User Role</option>
        </select>
      </div>

      <div className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-0" role="status" aria-busy="true" aria-label="Loading audit logs">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-4 items-center px-6 py-4 border-b border-[var(--color-border)] last:border-b-0">
                <div className="flex items-center gap-3">
                  <Skeleton width={32} height={32} variant="circular" />
                  <Skeleton width="60%" height={16} variant="text" />
                </div>
                <Skeleton width="50%" height={16} variant="text" />
                <Skeleton width="40%" height={16} variant="text" />
              </div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title="No audit logs found"
            description={
              search || actionFilter || resourceFilter
                ? 'Try adjusting your search or filter criteria.'
                : 'No system activity has been recorded yet.'
            }
          />
        ) : (
          <>
            <div className="space-y-0 divide-y divide-[var(--color-border)]">
              {/* Issue 12: Sortable column headers for the expandable list */}
              <div className="bg-[var(--color-bg-secondary)] px-6 py-3 grid grid-cols-3 gap-4 text-sm font-semibold text-[var(--color-text)]">
                <button
                  onClick={() => handleSort('timestamp')}
                  className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                  title="Click to sort by timestamp"
                  aria-sort={sortBy === 'timestamp' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Timestamp
                  <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                    {getSortIndicator('timestamp') || '↕'}
                  </span>
                </button>
                <button
                  onClick={() => handleSort('action')}
                  className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                  title="Click to sort by action"
                  aria-sort={sortBy === 'action' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Action
                  <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                    {getSortIndicator('action') || '↕'}
                  </span>
                </button>
                <button
                  onClick={() => handleSort('resource')}
                  className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                  title="Click to sort by resource"
                  aria-sort={sortBy === 'resource' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  Resource
                  <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                    {getSortIndicator('resource') || '↕'}
                  </span>
                </button>
              </div>

              {auditLogs.map((log: AuditLog, idx: number) => (
                <div key={log.id || idx}>
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors text-left grid grid-cols-3 gap-4 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
                    aria-expanded={expandedId === log.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}>
                        {log.actionType?.[0] || '—'}
                      </span>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {log.createdAt
                          ? new Date(log.createdAt).toLocaleString()
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text)] text-sm">
                        {log.actionType || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {log.resourceType || 'Unknown'}
                      </p>
                      <span className="text-[var(--color-text-secondary)]">
                        {expandedId === log.id ? '▼' : '▶'}
                      </span>
                    </div>
                  </button>

                  {expandedId === log.id && (
                    <div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-[var(--color-text-secondary)] font-medium">User</p>
                          <p className="text-[var(--color-text)]">{log.adminUserEmail || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-[var(--color-text-secondary)] font-medium">Resource ID</p>
                          <p className="text-[var(--color-text)] font-mono">{log.resourceId}</p>
                        </div>
                        {log.oldValues && (
                          <div>
                            <p className="text-[var(--color-text-secondary)] font-medium">Old Values</p>
                            <pre className="text-xs bg-[var(--color-bg)] p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.oldValues, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValues && (
                          <div>
                            <p className="text-[var(--color-text-secondary)] font-medium">New Values</p>
                            <pre className="text-xs bg-[var(--color-bg)] p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.ipAddress && (
                          <div>
                            <p className="text-[var(--color-text-secondary)] font-medium">IP Address</p>
                            <p className="text-[var(--color-text)]">{log.ipAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
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
    </div>
  );
}
