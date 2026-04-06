/**
 * Layout Components - Admin Dashboard Shell
 */

'use client';

import React, { ReactNode } from 'react';
import { AdminContextProvider } from '../context/AdminContext';
import { UIContextProvider } from '../context/UIContext';

interface AdminLayoutProps {
  children: ReactNode;
}

/**
 * AdminLayout - Root wrapper providing context and layout structure
 * 
 * Provides:
 * - Admin context (cards, benefits, users, audit logs)
 * - UI context (theme, modals, toasts, sidebar)
 * - Basic layout structure
 */
export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminContextProvider>
      <UIContextProvider>
        <div className="admin-container">
          {children}
        </div>
      </UIContextProvider>
    </AdminContextProvider>
  );
}

/**
 * Sidebar component - Navigation menu
 */
interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Cards', href: '/admin/cards', icon: '🎴' },
    { label: 'Users', href: '/admin/users', icon: '👥' },
    { label: 'Audit Logs', href: '/admin/audit', icon: '📋' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <aside className={`admin-sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation">
      <div style={{ padding: 'var(--space-md)' }}>
        <button
          className="btn btn-sm"
          onClick={() => onToggleCollapse?.(!collapsed)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        {menuItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="sidebar-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-md)',
              color: 'var(--color-text)',
              textDecoration: 'none',
              borderLeft: '3px solid transparent',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-hover)';
              (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </a>
        ))}
      </nav>
    </aside>
  );
}

/**
 * TopNavBar component - Header with user menu and theme toggle
 */
interface TopNavBarProps {
  title?: string;
  onThemeToggle?: (theme: 'light' | 'dark' | 'system') => void;
  currentTheme?: 'light' | 'dark' | 'system';
}

export function TopNavBar({ title, onThemeToggle, currentTheme = 'light' }: TopNavBarProps) {
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  return (
    <header className="admin-topnav" role="banner">
      {title && <h1 style={{ margin: 0, fontSize: 'var(--text-h4)' }}>{title}</h1>}

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button
        className="btn btn-icon"
        onClick={() => {
          const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
          const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
          onThemeToggle?.(nextTheme);
        }}
        aria-label="Toggle theme"
        title={`Current theme: ${currentTheme}`}
      >
        {currentTheme === 'light' ? '☀️' : currentTheme === 'dark' ? '🌙' : '🔄'}
      </button>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button
          className="btn btn-sm"
          onClick={() => setShowUserMenu(!showUserMenu)}
          aria-label="User menu"
          aria-expanded={showUserMenu}
        >
          👤 Admin
        </button>

        {showUserMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 'var(--space-sm)',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1000,
              minWidth: '150px',
            }}
            role="menu"
          >
            <button
              style={{
                display: 'block',
                width: '100%',
                padding: 'var(--space-md)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--color-text)',
                textAlign: 'left',
              }}
              onClick={() => {
                setShowUserMenu(false);
                // Handle logout
              }}
              role="menuitem"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * PageHeader component - Per-page title and controls
 */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, filters }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-top">
        <div>
          <h1 className="page-header-title">{title}</h1>
          {subtitle && (
            <p
              style={{
                margin: 'var(--space-sm) 0 0 0',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-body-sm)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
      {filters && <div className="page-header-filters">{filters}</div>}
    </div>
  );
}
