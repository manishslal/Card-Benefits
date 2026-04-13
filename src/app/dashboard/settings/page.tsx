'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/shared/components/ui/button';
import { AppHeader } from '@/shared/components/layout';
import { DarkModeToggle } from '@/shared/components/ui/DarkModeToggle';
import { Mail, Lock, Shield } from 'lucide-react';

/**
 * Settings Page
 *
 * Tabs:
 * - Profile: Display user information
 * - Preferences: Toggle dark mode and other settings
 * - Account: Password and security settings
 * - Admin: Admin panel link (only for admin users)
 */

type ActiveTab = 'profile' | 'preferences' | 'account' | 'admin';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
        setError('Failed to load your profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'profile', label: 'Profile' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'account', label: 'Account' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col safe-area-bottom" style={{ backgroundColor: 'var(--color-bg)' }}>
        <AppHeader backHref="/dashboard" backLabel="Back to Dashboard" />
        <main id="main-content" className="flex-1 px-4 md:px-8 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="h-10 w-48 bg-[var(--color-border)] rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-[var(--color-border)] rounded animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col safe-area-bottom" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader backHref="/dashboard" backLabel="Back to Dashboard" />

      {/* Main Content */}
      <main id="main-content" className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[var(--color-text)]">Settings</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-2">
              Manage your account, preferences, and security
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="p-4 rounded-lg mb-6 border"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'var(--color-error)',
              }}
            >
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Tabs Navigation */}
          <div
            className="flex border-b mb-8 overflow-x-auto"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <section
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <h3
                    className="font-semibold text-[var(--color-text)] mb-4"
                    style={{ fontSize: 'var(--text-body-lg)' }}
                  >
                    Profile Information
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                        Full Name
                      </label>
                      <p className="text-sm text-[var(--color-text)] mt-1">
                        {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase flex items-center gap-2">
                        <Mail size={14} />
                        Email
                      </label>
                      <p className="text-sm text-[var(--color-text)] mt-1">
                        {user?.email || 'Loading...'}
                      </p>
                    </div>

                    {user && (
                      <div>
                        <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase flex items-center gap-2">
                          <Shield size={14} />
                          Role
                        </label>
                        <p className="text-sm text-[var(--color-text)] mt-1 capitalize">
                          {user.role.toLowerCase()}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <section
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <h3
                    className="font-semibold text-[var(--color-text)] mb-4"
                    style={{ fontSize: 'var(--text-body-lg)' }}
                  >
                    Display Preferences
                  </h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text)]">Dark Mode</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                          Toggle between light and dark theme
                        </p>
                      </div>
                      <DarkModeToggle />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <section
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <h3
                    className="font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2"
                    style={{ fontSize: 'var(--text-body-lg)' }}
                  >
                    <Lock size={18} />
                    Security & Account
                  </h3>

                  <div className="space-y-4">
                    <div className="py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                        Change Password
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                        Update your password regularly to keep your account secure
                      </p>
                      <Button variant="outline" size="sm">
                        Change Password
                      </Button>
                    </div>

                    <div className="py-3">
                      <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                        Sessions
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                        Sign out from all other devices
                      </p>
                      <Button variant="outline" size="sm">
                        Sign Out Other Sessions
                      </Button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Admin Tab */}
            {activeTab === 'admin' && isAdmin && (
              <div className="space-y-6">
                <section
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <h3
                    className="font-semibold text-[var(--color-text)] mb-2"
                    style={{ fontSize: 'var(--text-body-lg)' }}
                  >
                    Admin Dashboard
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    Manage cards, benefits, users and audit logs from the admin panel.
                  </p>
                  <Link href="/admin">
                    <Button variant="primary">Go to Admin Dashboard</Button>
                  </Link>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
