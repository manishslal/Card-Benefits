/**
 * Custom hooks for data fetching and state management
 * 
 * Provides:
 * - Card operations (list, get, create, update, delete)
 * - Benefit operations
 * - User management
 * - Audit log retrieval
 * - Loading and error states
 */

import { useState, useEffect, useCallback } from 'react';
import {
  cardApi,
  benefitApi,
  userApi,
  auditApi,
  getErrorMessage,
} from '../lib/api-client';
import type {
  Card,
  Benefit,
  AdminUser,
  AuditLog,
  CardListQuery,
  BenefitListQuery,
  UserListQuery,
  AuditLogQuery,
  PaginationInfo,
} from '../types/admin';

/* ============================================================
   useCards Hook
   ============================================================ */

interface UseCardsReturn {
  cards: Card[];
  loading: boolean;
  error: string | null;
  pagination?: PaginationInfo;
  refetch: () => Promise<void>;
  createCard: (data: any) => Promise<Card>;
  updateCard: (cardId: string, data: any) => Promise<Card>;
  deleteCard: (cardId: string, options?: any) => Promise<void>;
  reorderCards: (cards: Array<{ id: string; displayOrder: number }>) => Promise<void>;
}

export function useCards(query?: CardListQuery): UseCardsReturn {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>();

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await cardApi.list(query);
      if (response.data) {
        setCards(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const createCard = useCallback(async (data: any) => {
    try {
      const response = await cardApi.create(data);
      if (response.data) {
        setCards((prev) => [response.data, ...prev]);
        return response.data;
      }
      throw new Error(response.error || 'Failed to create card');
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const updateCard = useCallback(async (cardId: string, data: any) => {
    try {
      const response = await cardApi.update(cardId, data);
      if (response.data) {
        setCards((prev) =>
          prev.map((card) => (card.id === cardId ? response.data : card))
        );
        return response.data;
      }
      throw new Error(response.error || 'Failed to update card');
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string, options?: any) => {
    try {
      await cardApi.delete(cardId, options);
      setCards((prev) => prev.filter((card) => card.id !== cardId));
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  const reorderCards = useCallback(
    async (cardList: Array<{ id: string; displayOrder: number }>) => {
      try {
        await cardApi.reorder({ cards: cardList });
        // Refetch to get updated order
        await fetchCards();
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    [fetchCards]
  );

  return {
    cards,
    loading,
    error,
    pagination,
    refetch: fetchCards,
    createCard,
    updateCard,
    deleteCard,
    reorderCards,
  };
}

/* ============================================================
   useBenefits Hook
   ============================================================ */

interface UseBenefitsReturn {
  benefits: Benefit[];
  loading: boolean;
  error: string | null;
  pagination?: PaginationInfo;
  refetch: () => Promise<void>;
  createBenefit: (cardId: string, data: any) => Promise<Benefit>;
  updateBenefit: (
    cardId: string,
    benefitId: string,
    data: any
  ) => Promise<Benefit>;
  toggleDefault: (
    cardId: string,
    benefitId: string,
    isDefault: boolean
  ) => Promise<Benefit>;
  deleteBenefit: (
    cardId: string,
    benefitId: string,
    options?: any
  ) => Promise<void>;
}

export function useBenefits(cardId: string, query?: BenefitListQuery): UseBenefitsReturn {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>();

  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await benefitApi.list(cardId, query);
      if (response.data) {
        setBenefits(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [cardId, query]);

  useEffect(() => {
    if (cardId) {
      fetchBenefits();
    }
  }, [cardId, fetchBenefits]);

  const createBenefit = useCallback(
    async (cId: string, data: any) => {
      try {
        const response = await benefitApi.create(cId, data);
        if (response.data) {
          setBenefits((prev) => [response.data, ...prev]);
          return response.data;
        }
        throw new Error(response.error || 'Failed to create benefit');
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    []
  );

  const updateBenefit = useCallback(
    async (cId: string, bId: string, data: any) => {
      try {
        const response = await benefitApi.update(cId, bId, data);
        if (response.data) {
          setBenefits((prev) =>
            prev.map((benefit) => (benefit.id === bId ? response.data : benefit))
          );
          return response.data;
        }
        throw new Error(response.error || 'Failed to update benefit');
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    []
  );

  const toggleDefault = useCallback(
    async (cId: string, bId: string, isDefault: boolean) => {
      try {
        const response = await benefitApi.toggleDefault(cId, bId, { isDefault });
        if (response.data) {
          setBenefits((prev) =>
            prev.map((benefit) => (benefit.id === bId ? response.data : benefit))
          );
          return response.data;
        }
        throw new Error(response.error || 'Failed to toggle benefit');
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    []
  );

  const deleteBenefit = useCallback(
    async (cId: string, bId: string, options?: any) => {
      try {
        await benefitApi.delete(cId, bId, options);
        setBenefits((prev) => prev.filter((benefit) => benefit.id !== bId));
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw err;
      }
    },
    []
  );

  return {
    benefits,
    loading,
    error,
    pagination,
    refetch: fetchBenefits,
    createBenefit,
    updateBenefit,
    toggleDefault,
    deleteBenefit,
  };
}

/* ============================================================
   useUsers Hook
   ============================================================ */

interface UseUsersReturn {
  users: AdminUser[];
  loading: boolean;
  error: string | null;
  pagination?: PaginationInfo;
  refetch: () => Promise<void>;
  assignRole: (userId: string, role: string) => Promise<AdminUser>;
}

export function useUsers(query?: UserListQuery): UseUsersReturn {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userApi.list(query);
      if (response.data) {
        setUsers(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const assignRole = useCallback(async (userId: string, role: string) => {
    try {
      const response = await userApi.assignRole(userId, role);
      if (response.data) {
        setUsers((prev) =>
          prev.map((user) => (user.id === userId ? response.data : user))
        );
        return response.data;
      }
      throw new Error(response.error || 'Failed to assign role');
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    }
  }, []);

  return {
    users,
    loading,
    error,
    pagination,
    refetch: fetchUsers,
    assignRole,
  };
}

/* ============================================================
   useAuditLogs Hook
   ============================================================ */

interface UseAuditLogsReturn {
  logs: AuditLog[];
  loading: boolean;
  error: string | null;
  pagination?: PaginationInfo;
  refetch: () => Promise<void>;
}

export function useAuditLogs(query?: AuditLogQuery): UseAuditLogsReturn {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auditApi.list(query);
      if (response.data) {
        setLogs(response.data);
        setPagination(response.pagination);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    error,
    pagination,
    refetch: fetchLogs,
  };
}
