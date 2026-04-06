/**
 * Admin Dashboard - Home Page
 * Displays system overview, recent activity, and quick actions
 */

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/features/admin/lib/api-client';
import type { AuditLog } from '@/features/admin/types/admin';

export default function AdminDashboard() {
  // Dashboard metrics state
  const [cardCount, setCardCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [benefitCount, setBenefitCount] = useState(0);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setError('');
      
      try {
        // Fetch cards count
        try {
          const cardsResponse = await apiClient.get<any>('/cards', {
            params: { page: 1, limit: 1 },
          });
          setCardCount(cardsResponse?.pagination?.total || 0);
          console.log('Cards count:', cardsResponse?.pagination?.total);
        } catch (err) {
          console.error('Error fetching cards count:', err);
          setError('Failed to load cards data');
        }

        // Fetch users count
        try {
          const usersResponse = await apiClient.get<any>('/users', {
            params: { page: 1, limit: 1 },
          });
          setUserCount(usersResponse?.pagination?.total || 0);
          console.log('Users count:', usersResponse?.pagination?.total);
        } catch (err) {
          console.error('Error fetching users count:', err);
        }

        // Fetch benefits count - try to get from cards endpoint
        try {
          const benefitsResponse = await apiClient.get<any>('/benefits', {
            params: { page: 1, limit: 1 },
          });
          setBenefitCount(benefitsResponse?.pagination?.total || 0);
          console.log('Benefits count:', benefitsResponse?.pagination?.total);
        } catch (err) {
          // If /benefits endpoint doesn't exist, calculate from cards
          console.warn('Could not fetch benefits count directly:', err);
          try {
            const cardsResponse = await apiClient.get<any>('/cards', {
              params: { page: 1, limit: 100 },
            });
            const totalBenefits = (cardsResponse?.data || []).reduce(
              (sum: number, card: any) => sum + (card.benefitCount || 0),
              0
            );
            setBenefitCount(totalBenefits);
            console.log('Calculated benefits count:', totalBenefits);
          } catch (e) {
            console.error('Error calculating benefits:', e);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    const fetchAuditLogs = async () => {
      setAuditLoading(true);
      try {
        const logsResponse = await apiClient.get<any>('/audit-logs', {
          params: { page: 1, limit: 10 },
        });
        setRecentAudits(logsResponse?.data || []);
        console.log('Audit logs:', logsResponse?.data);
      } catch (err) {
        console.error('Error fetching audit logs:', err);
        setRecentAudits([]);
      } finally {
        setAuditLoading(false);
      }
    };

    fetchDashboardData();
    fetchAuditLogs();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          System overview and recent activity
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { 
            label: 'Total Cards', 
            value: isLoading ? '...' : cardCount, 
            icon: '💳',
            loading: isLoading
          },
          { 
            label: 'Users', 
            value: isLoading ? '...' : userCount, 
            icon: '👥',
            loading: isLoading
          },
          { 
            label: 'Benefits', 
            value: isLoading ? '...' : benefitCount, 
            icon: '🎁',
            loading: isLoading
          },
          { 
            label: 'Audit Logs', 
            value: auditLoading ? '...' : recentAudits.length, 
            icon: '📋',
            loading: auditLoading
          },
        ].map((stat, idx) => (
          <div 
            key={idx} 
            className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 ${
              stat.loading ? 'animate-pulse' : ''
            }`}
          >
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
            {recentAudits.map((log: AuditLog, idx: number) => {
              // Format admin email - handle both old and new field names
              const adminEmail = (log as any).adminUserEmail || 
                                 (log as any).adminUser?.email || 
                                 (log as any).adminUser?.firstName ||
                                 'Unknown user';
              
              return (
                <div
                  key={log.id || idx}
                  className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {(log.actionType?.[0] || '—').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {log.actionType || 'Unknown'} {log.resourceType || 'resource'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {adminEmail}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {log.createdAt
                      ? new Date(log.createdAt).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              );
            })}
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
