'use client';

import useSWR from 'swr';
import { apiClient, getErrorMessage } from '../lib/api-client';
import type {
  Benefit,
  BenefitListResponse,
  BenefitCreateRequest,
  BenefitUpdateRequest,
  PaginationInfo,
} from '../types/admin';

interface UseBenefitsOptions {
  cardId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface UseBenefitsResult {
  benefits: Benefit[];
  isLoading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  mutate: () => void;
  createBenefit: (cardId: string, data: BenefitCreateRequest) => Promise<Benefit>;
  updateBenefit: (cardId: string, benefitId: string, data: BenefitUpdateRequest) => Promise<Benefit>;
  deleteBenefit: (cardId: string, benefitId: string) => Promise<void>;
  toggleDefault: (cardId: string, benefitId: string, isDefault: boolean) => Promise<Benefit>;
}

export function useBenefits(options: UseBenefitsOptions = {}): UseBenefitsResult {
  const { cardId, page = 1, limit = 20, search = '' } = options;

  const {
    data,
    error: fetchError,
    isLoading,
    mutate,
  } = useSWR<BenefitListResponse>(
    cardId ? [`/admin/benefits`, cardId, page, limit, search].join('|') : null,
    async () => {
      if (!cardId) return { success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false } };
      try {
        return await apiClient.get<BenefitListResponse>(`/cards/${cardId}/benefits`, {
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

  const createBenefit = async (cardId: string, benefitData: BenefitCreateRequest): Promise<Benefit> => {
    try {
      const response = await apiClient.post<any>(`/cards/${cardId}/benefits`, benefitData);
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const updateBenefit = async (cardId: string, benefitId: string, updates: BenefitUpdateRequest): Promise<Benefit> => {
    try {
      const response = await apiClient.patch<any>(`/cards/${cardId}/benefits/${benefitId}`, updates);
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const deleteBenefit = async (cardId: string, benefitId: string): Promise<void> => {
    try {
      await apiClient.delete(`/cards/${cardId}/benefits/${benefitId}`);
      mutate();
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const toggleDefault = async (cardId: string, benefitId: string, isDefault: boolean): Promise<Benefit> => {
    try {
      const response = await apiClient.patch<any>(
        `/cards/${cardId}/benefits/${benefitId}`,
        { isDefault }
      );
      mutate();
      return response.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    benefits: data?.data || [],
    isLoading,
    error: fetchError ? getErrorMessage(fetchError) : null,
    pagination: data?.pagination || null,
    mutate,
    createBenefit,
    updateBenefit,
    deleteBenefit,
    toggleDefault,
  };
}
