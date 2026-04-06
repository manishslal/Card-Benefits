/**
 * Admin Dashboard Layout
 * Main layout wrapper for all admin pages
 * Handles navigation, theme, and responsive design
 */

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // Check authentication and admin role
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user has admin role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

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

        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {session.user.email}
          </div>
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
