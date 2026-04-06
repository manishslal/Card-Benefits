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

  // Issue 14: Standardize page title to "Admin Dashboard - Dashboard"
  useEffect(() => {
    document.title = 'Admin Dashboard - Dashboard';
  }, []);

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
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">
          System overview and recent activity
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-3 rounded-lg border" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-error)' }}>
          <p style={{ color: 'var(--color-error)' }}>{error}</p>
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
            className={`rounded-lg border p-6 ${
              stat.loading ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
                  {stat.value}
                </p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
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
              className="flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors hover:opacity-80"
              style={{
                backgroundColor: 'rgba(51, 86, 208, 0.1)',
                color: 'var(--color-primary)',
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border p-6" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          Recent Activity
        </h2>

        {auditLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-16 rounded-lg animate-pulse"
                style={{ backgroundColor: 'var(--color-border)' }}
              />
            ))}
          </div>
        ) : recentAudits.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-center py-8">
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
                  className="flex items-center gap-4 p-4 rounded-lg"
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm" style={{ backgroundColor: 'rgba(51, 86, 208, 0.15)', color: 'var(--color-primary)' }}>
                    {(log.actionType?.[0] || '—').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      {log.actionType || 'Unknown'} {log.resourceType || 'resource'}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {adminEmail}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
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
            className="text-sm font-medium hover:underline transition-colors"
            style={{ color: 'var(--color-primary)' }}
          >
            View all activity →
          </a>
        </div>
      </div>
    </div>
  );
}
