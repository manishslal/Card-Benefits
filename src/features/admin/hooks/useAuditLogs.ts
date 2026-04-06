'use client';

import useSWR from 'swr';
import { apiClient, getErrorMessage } from '../lib/api-client';
import type {
  AuditLog,
  AuditLogListResponse,
  PaginationInfo,
  AuditActionType,
  ResourceType,
} from '../types/admin';

interface UseAuditLogsOptions {
  page?: number;
  limit?: number;
  search?: string;
  actionType?: AuditActionType;
  resourceType?: ResourceType;
  startDate?: string;
  endDate?: string;
}

interface UseAuditLogsResult {
  logs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  mutate: () => void;
  exportCSV: () => Promise<void>;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}): UseAuditLogsResult {
  const {
    page = 1,
    limit = 50,
    search = '',
    actionType,
    resourceType,
    startDate,
    endDate,
  } = options;

  const {
    data,
    error: fetchError,
    isLoading,
    mutate,
  } = useSWR<AuditLogListResponse>(
    [`/admin/audit-logs`, page, limit, search, actionType, resourceType].join('|'),
    async () => {
      try {
        return await apiClient.get<AuditLogListResponse>('/audit-logs', {
          params: {
            page,
            limit,
            search: search || undefined,
            actionType: actionType || undefined,
            resourceType: resourceType || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
          },
        });
      } catch (err) {
        throw new Error(getErrorMessage(err));
      }
    }
  );

  const exportCSV = async (): Promise<void> => {
    try {
      const response = await fetch('/api/admin/audit-logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType,
          resourceType,
          startDate,
          endDate,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    logs: data?.data || [],
    isLoading,
    error: fetchError ? getErrorMessage(fetchError) : null,
    pagination: data?.pagination || null,
    mutate,
    exportCSV,
  };
}
