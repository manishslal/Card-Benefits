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
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '', email: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isClearingSessions, setIsClearingSessions] = useState(false);

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

  const handleChangePassword = () => {
    setIsChangingPassword(true);
    // TODO: Open change password modal or form
    // This would typically open a modal with password fields
    setTimeout(() => {
      alert('Change password feature will be implemented');
      setIsChangingPassword(false);
    }, 500);
  };

  const handleClearSessions = async () => {
    setIsClearingSessions(true);
    try {
      const response = await fetch('/api/auth/logout-all-sessions', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to clear sessions');
      }

      setError(null);
      alert('All other sessions have been cleared');
    } catch (err) {
      console.error('Error clearing sessions:', err);
      setError('Failed to clear sessions. Please try again.');
    } finally {
      setIsClearingSessions(false);
    }
  };

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: 'profile', label: 'Profile' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'account', label: 'Account' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
        <AppHeader backHref="/dashboard" backLabel="Back to Dashboard" />
        <main className="flex-1 px-4 md:px-8 py-8">
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <AppHeader backHref="/dashboard" backLabel="Back to Dashboard" />

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8">
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
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
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
                  className="p-6 rounded-lg border relative"
                  style={{
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3
                      className="font-semibold text-[var(--color-text)]"
                      style={{ fontSize: 'var(--text-body-lg)' }}
                    >
                      Profile Information
                    </h3>
                    <Button
                      variant={isEditingProfile ? "primary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isEditingProfile && user) {
                          // Handle save
                          console.log('Save profile:', editFormData);
                          // TODO: Wire to /api/user/profile endpoint
                          setIsEditingProfile(false);
                        } else if (user) {
                          setEditFormData({
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email
                          });
                          setIsEditingProfile(true);
                        }
                      }}
                    >
                      {isEditingProfile ? 'Save' : 'Edit'}
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                        First Name
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded border text-sm"
                          style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <p className="text-sm text-[var(--color-text)] mt-1">
                          {user?.firstName || '—'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
                        Last Name
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="text"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded border text-sm"
                          style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <p className="text-sm text-[var(--color-text)] mt-1">
                          {user?.lastName || '—'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase flex items-center gap-2">
                        <Mail size={14} />
                        Email
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          className="w-full mt-1 px-3 py-2 rounded border text-sm"
                          style={{
                            backgroundColor: 'var(--color-bg-secondary)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }}
                        />
                      ) : (
                        <p className="text-sm text-[var(--color-text)] mt-1">
                          {user?.email || 'Loading...'}
                        </p>
                      )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangePassword}
                        isLoading={isChangingPassword}
                        disabled={isChangingPassword}
                      >
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearSessions}
                        isLoading={isClearingSessions}
                        disabled={isClearingSessions}
                      >
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
