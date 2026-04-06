'use client';

import useSWR from 'swr';
import { apiClient, getErrorMessage } from '../lib/api-client';
import type {
  Card,
  CardListResponse,
  CardDetailResponse,
  CardCreateRequest,
  CardUpdateRequest,
  PaginationInfo,
} from '../types/admin';

interface UseCardsOptions {
  page?: number;
  limit?: number;
  search?: string;
  issuer?: string;
  isActive?: boolean;
}

interface UseCardsResult {
  cards: Card[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  mutate: () => void;
  createCard: (data: CardCreateRequest) => Promise<Card>;
  updateCard: (cardId: string, data: CardUpdateRequest) => Promise<Card>;
  deleteCard: (cardId: string) => Promise<void>;
}

export function useCards(options: UseCardsOptions = {}): UseCardsResult {
  const { page = 1, limit = 20, search = '' } = options;

  const {
    data,
    error: fetchError,
    isLoading,
    mutate,
  } = useSWR<CardListResponse>(
    [`/admin/cards`, page, limit, search].join('|'),
    async () => {
      try {
        return await apiClient.get<CardListResponse>('/cards', {
          params: {
            page,
            limit,
            search: search || undefined,
          },
        });
      } catch (err) {
        throw new Error(getErrorMessage(err));
      }
    }
  );

  const createCard = async (cardData: CardCreateRequest): Promise<Card> => {
    try {
      const response = await apiClient.post<CardDetailResponse>('/cards', cardData);
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const updateCard = async (cardId: string, updates: CardUpdateRequest): Promise<Card> => {
    try {
      const response = await apiClient.patch<CardDetailResponse>(`/cards/${cardId}`, updates);
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const deleteCard = async (cardId: string): Promise<void> => {
    try {
      await apiClient.delete(`/cards/${cardId}`);
      mutate();
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    cards: data?.data || [],
    isLoading,
    error: fetchError ? getErrorMessage(fetchError) : null,
    pagination: data?.pagination || null,
    mutate,
    createCard,
    updateCard,
    deleteCard,
  };
}
