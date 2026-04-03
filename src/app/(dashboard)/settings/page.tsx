'use client';

import React, { useState } from 'react';
import { SafeDarkModeToggle } from '@/components/SafeDarkModeToggle';
import Button from '@/components/ui/button';
import Input from '@/components/ui/Input';
import Link from 'next/link';
import { CreditCard, ArrowLeft } from 'lucide-react';


/**
 * Settings Page - User Preferences and Account Management
 * 
 * Features:
 * - User profile settings
 * - Email and password management
 * - Theme preferences (dark mode toggle)
 * - Notification preferences
 * - Data export/import
 * - Account deletion
 */

// Mark as dynamic page to avoid SSG issues with ThemeProvider
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'account'>('profile');
  const [formData, setFormData] = useState({
    name: 'John Doe',
    email: 'john@example.com',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    expiringBenefits: true,
    newFeatures: false,
    weeklyDigest: true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMessage('✓ Profile updated successfully');
    } catch (error) {
      setMessage('Error updating profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMessage('✓ Password changed successfully');
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      setMessage('Error changing password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <CreditCard size={20} />
            </div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              CardTrack
            </h1>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <SafeDarkModeToggle />
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft size={16} className="mr-1" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 md:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page title */}
          <h2
            className="font-bold text-[var(--color-text)] mb-8"
            style={{ fontSize: 'var(--text-h3)' }}
          >
            Settings
          </h2>

          {/* Tab navigation */}
          <div className="flex gap-2 mb-8 border-b" style={{ borderColor: 'var(--color-border)' }}>
            {(['profile', 'preferences', 'account'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg mb-6 text-sm ${
                message.startsWith('✓')
                  ? 'bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)]'
                  : 'bg-[var(--color-error)] bg-opacity-10 text-[var(--color-error)]'
              }`}
            >
              {message}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Account Information
                </h3>

                <div className="space-y-4">
                  <Input
                    label="Full Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={isLoading}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                  />

                  <Button
                    variant="primary"
                    onClick={handleSaveProfile}
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    Save Changes
                  </Button>
                </div>
              </section>

              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Change Password
                </h3>

                <div className="space-y-4">
                  <Input
                    label="Current Password"
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    error={errors.currentPassword}
                    disabled={isLoading}
                  />

                  <Input
                    label="New Password"
                    type="password"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    error={errors.newPassword}
                    disabled={isLoading}
                  />

                  <Input
                    label="Confirm New Password"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    error={errors.confirmPassword}
                    disabled={isLoading}
                  />

                  <Button
                    variant="primary"
                    onClick={handleChangePassword}
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    Change Password
                  </Button>
                </div>
              </section>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Display Preferences
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <div>
                      <p className="font-medium text-[var(--color-text)]">Dark Mode</p>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Toggle dark mode theme
                      </p>
                    </div>
                    <SafeDarkModeToggle />
                  </div>
                </div>
              </section>

              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Notifications
                </h3>

                <div className="space-y-4">
                  {[
                    {
                      key: 'expiringBenefits',
                      label: 'Expiring Benefits Alerts',
                      description: 'Get notified when your benefits are about to expire',
                    },
                    {
                      key: 'weeklyDigest',
                      label: 'Weekly Digest',
                      description: 'Receive a weekly summary of your cards and benefits',
                    },
                    {
                      key: 'newFeatures',
                      label: 'New Features',
                      description: 'Be notified about new features and updates',
                    },
                  ].map((pref) => (
                    <div
                      key={pref.key}
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                    >
                      <div>
                        <p className="font-medium text-[var(--color-text)]">{pref.label}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {pref.description}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifications[pref.key as keyof typeof notifications]}
                        onChange={(e) =>
                          setNotifications({
                            ...notifications,
                            [pref.key]: e.target.checked,
                          })
                        }
                        className="w-5 h-5 rounded cursor-pointer"
                      />
                    </div>
                  ))}
                </div>

                <Button
                  variant="primary"
                  className="mt-4"
                  onClick={() => setMessage('✓ Notification preferences saved')}
                >
                  Save Preferences
                </Button>
              </section>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Data Management
                </h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <p className="text-sm text-[var(--color-text)] mb-2">
                      Download all your data as a CSV file. You can import this data into another account or application.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                    >
                      Export Data
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <p className="text-sm text-[var(--color-text)] mb-2">
                      Import your card benefits data from a previous export.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                    >
                      Import Data
                    </Button>
                  </div>
                </div>
              </section>

              <section className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}>
                <h3
                  className="font-semibold text-[var(--color-text)] mb-4"
                  style={{ fontSize: 'var(--text-body-lg)' }}
                >
                  Danger Zone
                </h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-lg border-2"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.05)',
                      borderColor: 'var(--color-error)',
                    }}>
                    <p className="text-sm font-medium text-[var(--color-error)] mb-2">
                      Delete Your Account
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button
                      variant="danger"
                      size="sm"
                    >
                      Delete Account
                    </Button>
                  </div>

                  <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <p className="text-sm text-[var(--color-text)] mb-2">
                      Sign out from all devices
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        window.location.href = '/login';
                      }}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-6 mt-auto"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-8 text-center text-xs text-[var(--color-text-secondary)]">
          <p>&copy; 2024 CardTrack. Track your benefits with confidence.</p>
        </div>
      </footer>
    </div>
  );
}
