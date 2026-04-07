/**
 * Phase 2B - Benefits Tracking Types
 * Comprehensive type definitions for usage tracking, progress, recommendations, and onboarding
 */

// ============================================================================
// USAGE TRACKING TYPES
// ============================================================================

export interface BenefitUsageRecord {
  id: string;
  benefitId: string;
  playerId: string;
  userCardId: string;
  amount: string; // Decimal as string for precision
  usageDate: string;
  period: string;
  notes?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageInput {
  amount: number;
  usageDate?: Date;
  notes?: string;
  category?: string;
}

export interface UsageHistoryResponse {
  success: boolean;
  usageRecords: BenefitUsageRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

// ============================================================================
// PROGRESS TRACKING TYPES
// ============================================================================

export interface BenefitProgress {
  benefitId: string;
  benefitName: string;
  stickerValue: number;
  userValue?: number;
  currentPeriod: string;
  totalUsed: number;
  percentageUsed: number;
  daysRemaining: number;
  resetDate: string;
  status: 'ACTIVE' | 'EXPIRING' | 'USED' | 'EXPIRED';
  usageRecords: BenefitUsageRecord[];
}

export interface AllBenefitsProgress {
  playerId: string;
  totalBenefits: number;
  benefitsTracking: BenefitProgress[];
  overallPercentage: number;
  aggregateUsed: number;
  aggregateTotal: number;
}

export interface ProgressResponse {
  success: boolean;
  progress: BenefitProgress | AllBenefitsProgress;
  error?: string;
}

// ============================================================================
// FILTERING TYPES
// ============================================================================

export type FilterStatus = 'ACTIVE' | 'EXPIRING' | 'USED' | 'EXPIRED' | 'ALL';
export type ResetCadence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'CARDMEMBER_YEAR' | 'ONE_TIME';
export type BenefitCategory = 'TRAVEL' | 'DINING' | 'SHOPPING' | 'ENTERTAINMENT' | 'OTHER';

export interface BenefitFilters {
  status?: FilterStatus[];
  cadence?: ResetCadence[];
  minValue?: number;
  maxValue?: number;
  categories?: BenefitCategory[];
  searchQuery?: string;
  sortBy?: 'name' | 'value' | 'usage' | 'daysRemaining';
  sortOrder?: 'asc' | 'desc';
}

export interface FilteredBenefitsResponse {
  success: boolean;
  benefits: BenefitProgress[];
  appliedFilters: BenefitFilters;
  resultCount: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

// ============================================================================
// RECOMMENDATION TYPES
// ============================================================================

export interface BenefitRecommendationData {
  id: string;
  playerId: string;
  benefitId?: string;
  masterBenefitId?: string;
  benefitName?: string;
  reason: string;
  score: number;
  category?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  viewCount: number;
  lastViewedAt?: string;
  actionTaken: boolean;
  actionType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateRecommendationsInput {
  forceRefresh?: boolean;
  maxRecommendations?: number;
}

export interface RecommendationsResponse {
  success: boolean;
  recommendations: BenefitRecommendationData[];
  generatedAt: string;
  error?: string;
}

// ============================================================================
// ONBOARDING TYPES
// ============================================================================

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface OnboardingSessionData {
  id: string;
  playerId: string;
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: number;
  isCompleted: boolean;
  sessionData?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  lastStepAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStepData {
  id: string;
  sessionId: string;
  stepNumber: OnboardingStep;
  isCompleted: boolean;
  completedAt?: string;
  duration?: number;
  stepData?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingStateResponse {
  success: boolean;
  session: OnboardingSessionData;
  steps: OnboardingStepData[];
  completionPercentage: number;
  error?: string;
}

export interface StepCompleteInput {
  stepData?: Record<string, unknown>;
  duration?: number;
}

// ============================================================================
// GENERIC API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
