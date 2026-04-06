'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/features/admin/lib/api-client';
import type { AuditLog, PaginationInfo } from '@/features/admin/types/admin';

interface AuditListResponse {
  success: boolean;
  data: AuditLog[];
  pagination: PaginationInfo;
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Update page title on mount
  useEffect(() => {
    document.title = 'Audit Logs - Admin Dashboard';
  }, []);

  const { data, isLoading } = useSWR<AuditListResponse>(
    `/admin/audit?page=${page}&limit=50${search ? `&search=${search}` : ''}${
      actionFilter ? `&actionType=${actionFilter}` : ''
    }${resourceFilter ? `&resourceType=${resourceFilter}` : ''}`,
    async () => {
      try {
        return await apiClient.get('/audit-logs', {
          params: {
            page,
            limit: 50,
            search: search || undefined,
            actionType: actionFilter || undefined,
            resourceType: resourceFilter || undefined,
          },
        });
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        throw err;
      }
    }
  );

  const auditLogs = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Audit Log</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">System activity and changes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Search by resource..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Resources</option>
          <option value="CARD">Card</option>
          <option value="BENEFIT">Benefit</option>
          <option value="USER_ROLE">User Role</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">Loading audit logs...</p>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400">No audit logs found</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {auditLogs.map((log: AuditLog, idx: number) => (
                <div key={log.id || idx}>
                  <button
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="w-full px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {log.actionType?.[0] || '—'}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {log.actionType} {log.resourceType}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {log.adminUserEmail || 'Unknown'} • {log.createdAt
                              ? new Date(log.createdAt).toLocaleString()
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-400 dark:text-slate-600">
                      {expandedId === log.id ? '▼' : '▶'}
                    </span>
                  </button>

                  {expandedId === log.id && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="text-slate-600 dark:text-slate-400 font-medium">Resource ID</p>
                          <p className="text-slate-900 dark:text-white font-mono">{log.resourceId}</p>
                        </div>
                        {log.oldValues && (
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">Old Values</p>
                            <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.oldValues, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.newValues && (
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">New Values</p>
                            <pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.ipAddress && (
                          <div>
                            <p className="text-slate-600 dark:text-slate-400 font-medium">IP Address</p>
                            <p className="text-slate-900 dark:text-white">{log.ipAddress}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!pagination.hasMore}
                  className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 disabled:opacity-50"
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
