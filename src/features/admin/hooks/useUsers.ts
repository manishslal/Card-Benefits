'use client';

import useSWR from 'swr';
import { apiClient, getErrorMessage } from '../lib/api-client';
import type {
  AdminUser,
  UserListResponse,
  RoleAssignmentResponse,
  PaginationInfo,
  UserRole,
} from '../types/admin';

interface UseUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
}

interface UseUsersResult {
  users: AdminUser[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  mutate: () => void;
  assignRole: (userId: string, role: UserRole) => Promise<AdminUser>;
}

export function useUsers(options: UseUsersOptions = {}): UseUsersResult {
  const { page = 1, limit = 20, search = '', role } = options;

  const {
    data,
    error: fetchError,
    isLoading,
    mutate,
  } = useSWR<UserListResponse>(
    [`/admin/users`, page, limit, search, role].join('|'),
    async () => {
      try {
        return await apiClient.get<UserListResponse>('/users', {
          params: {
            page,
            limit,
            search: search || undefined,
            role: role || undefined,
          },
        });
      } catch (err) {
        throw new Error(getErrorMessage(err));
      }
    }
  );

  const assignRole = async (userId: string, newRole: UserRole): Promise<AdminUser> => {
    try {
      const response = await apiClient.post<RoleAssignmentResponse>(`/users/${userId}/role`, {
        role: newRole,
      });
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    users: data?.data || [],
    isLoading,
    error: fetchError ? getErrorMessage(fetchError) : null,
    pagination: data?.pagination || null,
    mutate,
    assignRole,
  };
}
