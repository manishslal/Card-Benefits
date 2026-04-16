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
import { usePathname } from 'next/navigation';
import { CreditCard, LayoutDashboard, Gift, Users, FileText, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

// Declare dynamic to match middleware auth verification
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
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

  const getPageTitle = (path: string): string => {
    if (path === '/admin') return 'Dashboard';
    if (path.startsWith('/admin/cards/')) return 'Card Detail';
    if (path === '/admin/cards') return 'Cards';
    if (path === '/admin/benefits') return 'Benefits';
    if (path === '/admin/users') return 'Users';
    if (path === '/admin/audit') return 'Audit Log';
    return 'Admin';
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Skip to main content link for keyboard/screen-reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--color-primary)] focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 flex-col border-r" role="complementary" aria-label="Admin navigation" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
            <CreditCard size={20} />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            CardTrack <span className="text-xs font-normal text-[var(--color-text-secondary)]">Admin</span>
          </h1>
        </div>

        <nav aria-label="Admin navigation" className="flex-1 px-4 py-6 space-y-2">
          {([
            { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
            { href: '/admin/cards', label: 'Cards', icon: CreditCard },
            { href: '/admin/benefits', label: 'Benefits', icon: Gift },
            { href: '/admin/users', label: 'Users', icon: Users },
            { href: '/admin/audit', label: 'Audit Log', icon: FileText },
          ] as { href: string; label: string; icon: LucideIcon }[]).map((item) => {
            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)] font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
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
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
            style={{
              color: 'var(--color-text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header
          className="sticky top-0 z-30 safe-area-top safe-area-x"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            boxShadow: 'var(--header-shadow)',
          }}
        >
          <div className="py-2.5">
            <div className="flex items-center justify-between max-w-7xl mx-auto w-full px-4 md:px-8">
            <h1 className="text-xl font-bold text-[var(--color-text)]">
              {getPageTitle(pathname)}
            </h1>
            {/* Mobile back button */}
            <Link
              href="/dashboard"
              className="md:hidden flex items-center gap-1 px-3 py-2 rounded-lg transition-colors text-sm hover:bg-[var(--color-bg-secondary)]"
              style={{
                color: 'var(--color-text-secondary)',
              }}
            >
              <ArrowLeft size={14} /> <span>Back</span>
            </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 overflow-auto bg-[var(--color-bg)] scroll-mt-header-safe">
          <div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
