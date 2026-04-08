/**
 * API client utilities for dashboard data fetching
 * Handles benefits loading, progress tracking, and toggle-used actions
 */

import { BenefitRowProps } from '../components/BenefitRow';

/**
 * API response types
 */
export interface BenefitApiResponse {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  expirationDate?: string | null;
  status?: string;
  isUsed?: boolean;
  description?: string;
}

export interface ProgressResponse {
  success: boolean;
  data?: {
    benefitId: string;
    used: number;
    limit: number | null;
    percentage: number;
    status: string;
  };
}

export interface PeriodResponse {
  success: boolean;
  data?: Array<{
    id: string;
    benefitId: string;
    startDate: string;
    endDate: string;
    resetCadence: string;
    periodNumber?: number;
    isArchived?: boolean;
  }>;
}

/**
 * Fetch all user benefits using /api/benefits/filters
 */
export async function fetchUserBenefits(): Promise<BenefitApiResponse[]> {
  try {
    const response = await fetch('/api/benefits/filters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        pageSize: 100, // Get all benefits in one fetch
        page: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch benefits: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to parse benefits response');
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching benefits:', error);
    throw error;
  }
}

/**
 * Fetch progress/usage for a specific benefit
 */
export async function fetchBenefitProgress(benefitId: string): Promise<ProgressResponse> {
  try {
    const response = await fetch(
      `/api/benefits/progress?benefitId=${encodeURIComponent(benefitId)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch benefit progress: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching benefit progress:', error);
    throw error;
  }
}

/**
 * Fetch period information for a benefit
 */
export async function fetchBenefitPeriods(benefitId: string): Promise<PeriodResponse> {
  try {
    const response = await fetch(
      `/api/benefits/periods?benefitId=${encodeURIComponent(benefitId)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch benefit periods: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching benefit periods:', error);
    throw error;
  }
}

/**
 * Toggle benefit as used/unused
 */
export async function toggleBenefitUsed(benefitId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(
      `/api/benefits/${encodeURIComponent(benefitId)}/toggle-used`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to toggle benefit: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error toggling benefit used:', error);
    throw error;
  }
}

/**
 * Fetch comprehensive dashboard data
 * Combines benefits, progress, and periods into a single call
 */
export async function fetchDashboardData(): Promise<{
  benefits: BenefitRowProps[];
  progress: Map<string, ProgressResponse>;
  periods: Map<string, PeriodResponse>;
}> {
  try {
    const benefits = await fetchUserBenefits();

    // Fetch progress and periods in parallel for all benefits
    const [progressResults, periodResults] = await Promise.all([
      Promise.allSettled(
        benefits.map((b) => fetchBenefitProgress(b.id))
      ),
      Promise.allSettled(
        benefits.map((b) => fetchBenefitPeriods(b.id))
      ),
    ]);

    // Build maps for easy lookup
    const progressMap = new Map<string, ProgressResponse>();
    const periodsMap = new Map<string, PeriodResponse>();

    benefits.forEach((benefit, index) => {
      const progressResult = progressResults[index];
      const periodResult = periodResults[index];

      if (progressResult.status === 'fulfilled' && progressResult.value) {
        progressMap.set(benefit.id, progressResult.value);
      }

      if (periodResult.status === 'fulfilled' && periodResult.value) {
        periodsMap.set(benefit.id, periodResult.value);
      }
    });

    return {
      benefits: transformBenefitsToRows(benefits, progressMap, periodsMap),
      progress: progressMap,
      periods: periodsMap,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
}

/**
 * Transform API benefit responses to BenefitRowProps
 */
function transformBenefitsToRows(
  benefits: BenefitApiResponse[],
  progressMap: Map<string, ProgressResponse>,
  periodsMap: Map<string, PeriodResponse>
): BenefitRowProps[] {
  return benefits.map((benefit) => {
    const progress = progressMap.get(benefit.id);
    const periods = periodsMap.get(benefit.id);
    const firstPeriod = periods?.data?.[0];

    const used = progress?.data?.used || 0;
    const available = progress?.data?.limit || benefit.stickerValue;

    // Determine status
    let status: 'active' | 'expiring_soon' | 'used' | 'expired' | 'pending' = 'active';
    if (benefit.status) {
      status = benefit.status.toLowerCase() as any;
    } else if (benefit.isUsed) {
      status = 'used';
    }

    return {
      id: benefit.id,
      name: benefit.name,
      issuer: '', // Will be populated from card data if available
      cardName: undefined,
      status,
      periodStart: firstPeriod?.startDate ? new Date(firstPeriod.startDate) : new Date(),
      periodEnd: firstPeriod?.endDate ? new Date(firstPeriod.endDate) : new Date(),
      available: Math.floor(available / 100), // Convert from cents
      used: Math.floor(used / 100),
      resetCadence: benefit.resetCadence,
    };
  });
}
