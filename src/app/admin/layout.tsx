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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            CB
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
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
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        {/* Footer Section with User Info and Exit Button */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {/* User Role Info */}
          <div className="text-xs">
            <p className="text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
              Role
            </p>
            <p className="text-sm text-slate-900 dark:text-white font-medium mt-1">
              {isLoading ? '...' : userRole || 'ADMIN'}
            </p>
          </div>

          {/* Back to Dashboard Button */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <span>←</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Admin Dashboard
            </h1>
            {/* Mobile back button */}
            <Link
              href="/dashboard"
              className="md:hidden px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
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
