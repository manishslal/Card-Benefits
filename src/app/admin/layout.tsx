/**
 * Admin Dashboard Layout
 * Main layout wrapper for all admin pages
 * Handles navigation, theme, and responsive design
 * 
 * Note: Auth is verified in middleware.ts before this layout is reached
 * Middleware ensures only ADMIN/SUPER_ADMIN users can access /admin routes
 */

'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminLayoutProps {
  children: ReactNode;
}

// Declare dynamic to match middleware auth verification
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user role on component mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/user/profile', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUserRole(data.user.role || 'ADMIN');
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 flex-col border-r" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
            CB
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            Admin
          </h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { href: '/admin', label: 'Dashboard', icon: '📊' },
            { href: '/admin/cards', label: 'Cards', icon: '💳' },
            { href: '/admin/benefits', label: 'Benefits', icon: '🎁' },
            { href: '/admin/users', label: 'Users', icon: '👥' },
            { href: '/admin/audit', label: 'Audit Log', icon: '📋' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors hover:opacity-80"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer Section with User Info and Exit Button */}
        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          {/* User Role Info */}
          <div className="text-xs">
            <p className="text-[var(--color-text-secondary)] uppercase tracking-wider font-semibold">
              Role
            </p>
            <p className="text-sm text-[var(--color-text)] font-medium mt-1">
              {isLoading ? '...' : userRole || 'ADMIN'}
            </p>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:opacity-80"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="border-b px-4 py-4" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[var(--color-text)]">
              Admin Dashboard
            </h1>
            {/* Mobile back button */}
            <Link
              href="/dashboard"
              className="md:hidden px-3 py-2 rounded-lg transition-colors text-sm hover:opacity-80"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
              }}
            >
              ← Back
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
