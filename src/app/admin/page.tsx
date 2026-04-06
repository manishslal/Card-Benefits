/**
 * Admin Dashboard - Home Page
 * Displays system overview, recent activity, and quick actions
 */

'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { apiClient } from '@/features/admin/lib/api-client';
import type { DashboardMetrics, AuditLog, Card, AdminUser, Benefit } from '@/features/admin/types/admin';

interface DashboardData {
  metrics?: DashboardMetrics;
  cards?: Card[];
  users?: AdminUser[];
  benefits?: Benefit[];
  auditLogs?: AuditLog[];
}

export default function AdminDashboard() {
  const [mounted, setMounted] = useState(false);

  // Fetch dashboard metrics
  const { data: dashboardData, isLoading: metricsLoading, error: metricsError } = useSWR<any>(
    '/admin/cards',
    async () => {
      try {
        const cards = await apiClient.get('/cards', {
          params: { page: 1, limit: 100 },
        });
        return cards;
      } catch (error) {
        console.error('Error fetching cards:', error);
        throw error;
      }
    }
  );

  // Fetch recent audit logs
  const { data: auditData, isLoading: auditLoading } = useSWR<any>(
    '/admin/audit-logs?limit=10',
    async () => {
      try {
        const logs = await apiClient.get('/audit-logs', {
          params: { page: 1, limit: 10 },
        });
        return logs;
      } catch (error) {
        console.error('Error fetching audit logs:', error);
        return { data: [] };
      }
    }
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const cardCount = dashboardData?.data?.length || 0;
  const recentAudits = auditData?.data || [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          System overview and recent activity
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Cards', value: cardCount, icon: '💳' },
          { label: 'Users', value: '—', icon: '👥' },
          { label: 'Benefits', value: '—', icon: '🎁' },
          { label: 'Audit Logs', value: recentAudits.length, icon: '📋' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                  {stat.value}
                </p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Add New Card', href: '/admin/cards' },
            { label: 'Manage Benefits', href: '/admin/benefits' },
            { label: 'User Roles', href: '/admin/users' },
            { label: 'View Audit Log', href: '/admin/audit' },
          ].map((action, idx) => (
            <a
              key={idx}
              href={action.href}
              className="flex items-center justify-center px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium transition-colors"
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Recent Activity
        </h2>

        {auditLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : recentAudits.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400 text-center py-8">
            No recent activity
          </p>
        ) : (
          <div className="space-y-4">
            {recentAudits.map((log: AuditLog, idx: number) => (
              <div
                key={log.id || idx}
                className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                  {log.actionType?.[0] || '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {log.actionType || 'Unknown'} {log.resourceType || 'resource'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {log.adminUserEmail || 'Unknown user'}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {log.createdAt
                    ? new Date(log.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <a
            href="/admin/audit"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all activity →
          </a>
        </div>
      </div>
    </div>
  );
}
