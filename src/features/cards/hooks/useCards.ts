/**
 * useCards - Card management hook
 * 
 * Provides state management for card operations including:
 * - Fetching cards from the API
 * - Managing card selection and filtering
 * - Handling card CRUD operations
 * 
 * Usage:
 * ```tsx
 * const { cards, loading, error, addCard, deleteCard } = useCards(playerId);
 * ```
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CardDisplayModel } from '@/features/cards/types';

export interface UseCardsOptions {
  playerId?: string;
  autoFetch?: boolean;
}

export interface UseCardsReturn {
  cards: CardDisplayModel[];
  loading: boolean;
  error: string | null;
  addCard: (cardData: any) => Promise<CardDisplayModel | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  updateCard: (cardId: string, updates: any) => Promise<CardDisplayModel | null>;
  fetchCards: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing card state and operations
 * 
 * @param options - Configuration options for the hook
 * @returns Card management methods and state
 */
export function useCards(options: UseCardsOptions = {}): UseCardsReturn {
  const { playerId, autoFetch = true } = options;
  const [cards, setCards] = useState<CardDisplayModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch cards from the API
   */
  const fetchCards = useCallback(async () => {
    if (!playerId) {
      setError('Player ID is required to fetch cards');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/my-cards?playerId=${playerId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch cards: ${response.statusText}`);
      }

      const data = await response.json();
      setCards(data.cards || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching cards:', err);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  /**
   * Add a new card
   * 
   * @param cardData - Card data for creation
   * @returns New card or null if failed
   */
  const addCard = useCallback(async (cardData: any): Promise<CardDisplayModel | null> => {
    if (!playerId) {
      setError('Player ID is required to add cards');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cards/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerId,
          ...cardData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to add card: ${response.statusText}`);
      }

      const data = await response.json();
      const newCard = data.card;

      // Update local state
      setCards((prevCards) => [...prevCards, newCard]);
      return newCard;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error adding card:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  /**
   * Delete a card
   * 
   * @param cardId - ID of the card to delete
   * @returns True if successful, false otherwise
   */
  const deleteCard = useCallback(async (cardId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete card: ${response.statusText}`);
      }

      // Update local state
      setCards((prevCards) => prevCards.filter((card) => card.id !== cardId));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error deleting card:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update a card
   * 
   * @param cardId - ID of the card to update
   * @param updates - Partial updates to apply
   * @returns Updated card or null if failed
   */
  const updateCard = useCallback(
    async (cardId: string, updates: any): Promise<CardDisplayModel | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/cards/${cardId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to update card: ${response.statusText}`);
        }

        const data = await response.json();
        const updatedCard = data.card;

        // Update local state
        setCards((prevCards) =>
          prevCards.map((card) => (card.id === cardId ? updatedCard : card))
        );

        return updatedCard;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        console.error('Error updating card:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Auto-fetch cards on mount if playerId is provided
   */
  useEffect(() => {
    if (autoFetch && playerId) {
      fetchCards();
    }
  }, [playerId, autoFetch, fetchCards]);

  return {
    cards,
    loading,
    error,
    addCard,
    deleteCard,
    updateCard,
    fetchCards,
    clearError,
  };
}
