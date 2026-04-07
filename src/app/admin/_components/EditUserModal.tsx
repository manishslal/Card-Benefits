/**
 * EditUserModal Component (Admin)
 * 
 * Allows admins to edit user profile information.
 * - Pre-fills form with existing user data
 * - Editable fields: firstName, lastName, email, isActive, role
 * - Validates form inputs with clear error messages
 * - API call: PATCH /api/admin/users/{userId}
 * - Displays errors via FormError component
 * - Closes on success
 */

'use client';

import { useState, useEffect } from 'react';
import { apiClient, getErrorMessage } from '@/features/admin/lib/api-client';
import { FormError } from '@/shared/components/forms';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { AdminUser } from '@/features/admin/types/admin';

interface EditUserModalProps {
  user: AdminUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditUserModal({
  user,
  isOpen,
  onClose,
  onSaved,
}: EditUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    isActive: true,
    role: 'USER' as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Pre-fill form when user data arrives
  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email,
        isActive: user.isActive,
        role: user.role as 'USER' | 'ADMIN' | 'SUPER_ADMIN',
      });
      setFieldErrors({});
      setFormError(null);
    }
  }, [isOpen, user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, type, value } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    
    // Clear field error when user starts editing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Validate firstName: optional, but max 50 chars if provided
    if (formData.firstName && formData.firstName.length > 50) {
      errors.firstName = 'First name must be 50 characters or less';
    }

    // Validate lastName: optional, but max 50 chars if provided
    if (formData.lastName && formData.lastName.length > 50) {
      errors.lastName = 'Last name must be 50 characters or less';
    }

    // Validate email: required, must be valid format
    if (!formData.email || formData.email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Invalid email format';
    }

    // Validate role: required, must be valid enum
    if (!formData.role || !['USER', 'ADMIN', 'SUPER_ADMIN'].includes(formData.role)) {
      errors.role = 'Role must be USER, ADMIN, or SUPER_ADMIN';
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // Validate form
      const errors = validateForm();
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setIsSubmitting(false);
        return;
      }

      if (!user) {
        setFormError('User not found');
        setIsSubmitting(false);
        return;
      }

      // PATCH /api/admin/users/{user.id}
      const response = await apiClient.patch(`/users/${user.id}`, {
        firstName: formData.firstName || null,
        lastName: formData.lastName || null,
        email: formData.email.trim(),
        isActive: formData.isActive,
        role: formData.role,
      });

      if (response.success) {
        onSaved();
      } else {
        setFormError(response.error || 'Failed to update user');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => {
      if (!open) onClose();
    }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="flex items-center justify-between mb-4">
            <DialogPrimitive.Title className="text-2xl font-bold text-slate-900 dark:text-white">
              Edit User
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                aria-label="Close dialog"
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={24} />
              </button>
            </DialogPrimitive.Close>
          </div>

          {formError && (
            <FormError message={formError} />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                First Name
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleInputChange}
                maxLength={50}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="John"
              />
              {fieldErrors.firstName && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.firstName}</p>
              )}
            </div>

            {/* Last Name field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Last Name
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleInputChange}
                maxLength={50}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="Doe"
              />
              {fieldErrors.lastName && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.lastName}</p>
              )}
            </div>

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="user@example.com"
              />
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Must be unique
              </p>
              {fieldErrors.email && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* isActive field - Toggle/Checkbox */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded border-slate-200 dark:border-slate-800 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
                <label htmlFor="isActive" className="block text-sm font-medium text-slate-900 dark:text-white">
                  Enabled
                </label>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                Unchecking prevents user login
              </p>
              {fieldErrors.isActive && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.isActive}</p>
              )}
            </div>

            {/* Role field */}
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1">
                Role *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                <option value="">Select a role</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
              {fieldErrors.role && (
                <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.role}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
