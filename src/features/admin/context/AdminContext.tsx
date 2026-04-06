/**
 * Admin Context - Manages admin-wide state
 * 
 * State managed:
 * - Cards and card operations
 * - Benefits and benefit operations
 * - Users and role management
 * - Audit logs
 * - Pagination and filtering
 * - Sorting
 */

'use client';

import React, { createContext, useCallback, useState, useEffect } from 'react';
import type {
  AdminContextState,
  Card,
  Benefit,
  AdminUser,
  AuditLog,
  SortField,
  SortDirection,
} from '../types/admin';

export const AdminContext = createContext<AdminContextState | undefined>(undefined);

const initialState: AdminContextState = {
  cards: [],
  selectedCard: null,
  cardCount: 0,
  cardLoading: false,
  cardError: null,

  benefits: [],
  benefitLoading: false,
  benefitError: null,

  users: [],
  userCount: 0,
  userLoading: false,
  userError: null,

  auditLogs: [],
  auditLoading: false,
  auditError: null,

  currentPage: 1,
  pageSize: 20,
  filters: {},
  sortBy: 'displayOrder' as SortField,
  sortDirection: 'asc' as SortDirection,
};

interface AdminContextProviderProps {
  children: React.ReactNode;
}

/**
 * AdminContextProvider component
 * 
 * Wraps the application to provide admin state management.
 * Note: This is a simplified provider. In production, you might use
 * Redux or TanStack Query for more complex state management.
 */
export function AdminContextProvider({ children }: AdminContextProviderProps) {
  const [state, setState] = useState<AdminContextState>(initialState);

  // Cards - Setters
  const setCards = useCallback((cards: Card[]) => {
    setState((prev) => ({ ...prev, cards }));
  }, []);

  const setSelectedCard = useCallback((card: Card | null) => {
    setState((prev) => ({ ...prev, selectedCard: card }));
  }, []);

  const setCardLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, cardLoading: loading }));
  }, []);

  const setCardError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, cardError: error }));
  }, []);

  // Benefits - Setters
  const setBenefits = useCallback((benefits: Benefit[]) => {
    setState((prev) => ({ ...prev, benefits }));
  }, []);

  const setBenefitLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, benefitLoading: loading }));
  }, []);

  const setBenefitError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, benefitError: error }));
  }, []);

  // Users - Setters
  const setUsers = useCallback((users: AdminUser[]) => {
    setState((prev) => ({ ...prev, users }));
  }, []);

  const setUserLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, userLoading: loading }));
  }, []);

  const setUserError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, userError: error }));
  }, []);

  // Audit - Setters
  const setAuditLogs = useCallback((logs: AuditLog[]) => {
    setState((prev) => ({ ...prev, auditLogs: logs }));
  }, []);

  const setAuditLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, auditLoading: loading }));
  }, []);

  const setAuditError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, auditError: error }));
  }, []);

  // Pagination - Setters
  const setCurrentPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState((prev) => ({ ...prev, pageSize: size }));
  }, []);

  const setFilters = useCallback((filters: Record<string, any>) => {
    setState((prev) => ({ ...prev, filters }));
  }, []);

  const setSortBy = useCallback((sortBy: SortField) => {
    setState((prev) => ({ ...prev, sortBy }));
  }, []);

  const setSortDirection = useCallback((direction: SortDirection) => {
    setState((prev) => ({ ...prev, sortDirection: direction }));
  }, []);

  // Add card to state (optimistic update)
  const addCard = useCallback((card: Card) => {
    setState((prev) => ({
      ...prev,
      cards: [card, ...prev.cards],
      cardCount: prev.cardCount + 1,
    }));
  }, []);

  // Update card in state (optimistic update)
  const updateCard = useCallback((cardId: string, updates: Partial<Card>) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.map((card) =>
        card.id === cardId ? { ...card, ...updates } : card
      ),
      selectedCard:
        prev.selectedCard?.id === cardId
          ? { ...prev.selectedCard, ...updates }
          : prev.selectedCard,
    }));
  }, []);

  // Remove card from state
  const removeCard = useCallback((cardId: string) => {
    setState((prev) => ({
      ...prev,
      cards: prev.cards.filter((card) => card.id !== cardId),
      cardCount: Math.max(0, prev.cardCount - 1),
      selectedCard:
        prev.selectedCard?.id === cardId ? null : prev.selectedCard,
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const contextValue: AdminContextState = {
    ...state,
    // Note: In a real implementation, these setters would be passed
    // through a separate hook or actions object. For simplicity,
    // we're exposing them directly through the context.
  };

  return (
    <AdminContext.Provider value={contextValue}>
      {children}
    </AdminContext.Provider>
  );
}

/**
 * Hook to use admin context
 */
export function useAdminContext() {
  const context = React.useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdminContext must be used within AdminContextProvider');
  }
  return context;
}
