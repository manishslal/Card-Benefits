/**
 * Phase 2: Advanced Benefits Features - Type Definitions
 * 
 * Defines all TypeScript types for benefit tracking, progress, filtering,
 * recommendations, onboarding, and offline support.
 */

// ============================================================================
// BENEFIT USAGE TRACKING (Feature 1)
// ============================================================================

export interface BenefitUsageRecord {
  id: string;
  benefitId: string;
  periodId: string;
  userCardId: string;
  playerId: string;
  amount: number; // In cents or count
  description: string;
  category?: string | null;
  usageDate: Date;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUsageRecordInput {
  benefitId: string;
  amount: number;
  description: string;
  category?: string;
  usageDate: Date;
}

export interface UpdateUsageRecordInput {
  amount?: number;
  description?: string;
  category?: string;
  usageDate?: Date;
}

export interface UsageRecordsResponse {
  records: BenefitUsageRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// BENEFIT PERIOD TRACKING (Feature 1 & 2)
// ============================================================================

export interface BenefitPeriod {
  id: string;
  benefitId: string;
  playerId: string;
  startDate: Date;
  endDate: Date;
  resetCadence: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME';
  totalAmount: number;
  totalCount: number;
  lastUsedAt?: Date | null;
  periodNumber: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PeriodSummary {
  period: BenefitPeriod;
  usageRecords: BenefitUsageRecord[];
  percentageUsed: number;
  daysRemaining: number;
}

// ============================================================================
// BENEFIT PROGRESS INDICATORS (Feature 2)
// ============================================================================

export interface ProgressIndicator {
  benefitId: string;
  currentPeriodId: string;
  used: number;
  limit?: number | null;
  percentageUsed: number;
  status: 'ACTIVE' | 'USED' | 'EXPIRING' | 'EXPIRED';
  daysUntilReset: number;
  color: 'green' | 'yellow' | 'orange' | 'red';
  displayText: string;
}

export interface ProgressHistory {
  benefitId: string;
  periods: Array<{
    period: BenefitPeriod;
    percentageUsed: number;
    daysUsed: number;
  }>;
}

// ============================================================================
// BENEFIT FILTERING (Feature 3)
// ============================================================================

export interface BenefitFilterCriteria {
  status?: ('ACTIVE' | 'EXPIRING' | 'USED' | 'EXPIRED')[];
  cadence?: ('MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME')[];
  valueRange?: {
    min: number;
    max: number;
  };
  categories?: string[];
  searchText?: string;
}

export interface FilteredBenefitsResponse {
  benefits: Array<any>; // UserBenefit with progress/period info
  total: number;
  appliedFilters: BenefitFilterCriteria;
  summary: {
    byStatus: Record<string, number>;
    byCadence: Record<string, number>;
    totalPotentialValue: number;
  };
}

// ============================================================================
// BENEFIT RECOMMENDATIONS (Feature 4)
// ============================================================================

export interface BenefitRecommendation {
  id: string;
  benefitId: string;
  playerId: string;
  title: string;
  description: string;
  reasoning?: string | null;
  potentialValue: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  priority: number;
  spendingCategory?: string | null;
  spentThisMonth?: number | null;
  usedThisMonth?: number | null;
  remainingLimit?: number | null;
  isDismissed: boolean;
  viewCount: number;
  clickCount: number;
  engagementScore: number;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationsResponse {
  recommendations: BenefitRecommendation[];
  total: number;
  summary: {
    totalPotentialValue: number;
    byUrgency: Record<string, number>;
  };
}

export interface RecommendationRequest {
  benefitId: string;
}

export interface DismissRecommendationInput {
  reason?: string;
}

// ============================================================================
// ONBOARDING (Feature 5)
// ============================================================================

export interface OnboardingStep {
  id: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  content: string;
  actionText: string;
  optional: boolean;
}

export interface UserOnboardingState {
  id: string;
  playerId: string;
  userId: string;
  step: number;
  completedSteps: string; // Comma-separated
  skippedStepCount: number;
  setupReminders: boolean;
  reminderEmail?: string | null;
  reminderFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  startedAt: Date;
  completedAt?: Date | null;
  totalTimeSpent: number;
  usedSampleBenefit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingProgress {
  currentStep: number;
  completedSteps: number[];
  skippedSteps: number[];
  isCompleted: boolean;
  timeSpent: number;
  estimatedTimeRemaining: number;
}

export interface StartOnboardingInput {
  playerId: string;
}

export interface CompleteOnboardingStepInput {
  step: number;
  timeSpent?: number;
  usedSampleBenefit?: boolean;
}

export interface SetupRemindersInput {
  email: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

// ============================================================================
// MOBILE & OFFLINE (Feature 6)
// ============================================================================

export interface OfflineQueueItem {
  id: string;
  type: 'CREATE_USAGE' | 'UPDATE_USAGE' | 'DELETE_USAGE' | 'COMPLETE_ONBOARDING';
  payload: unknown;
  timestamp: number;
  retries: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
}

export interface SyncStatus {
  isOnline: boolean;
  pendingItems: number;
  syncInProgress: boolean;
  lastSyncTime?: number;
  syncError?: string | null;
}

export interface CachedBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
  status: string;
  currentPeriodUsed?: number;
  currentPeriodLimit?: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

export interface BenefitFiltersState {
  criteria: BenefitFilterCriteria;
  isLoading: boolean;
  error: Error | null;
  results?: FilteredBenefitsResponse;
  appliedAt: number;
  updateCriteria: (criteria: Partial<BenefitFilterCriteria>) => void;
  clearFilters: () => void;
  applyFilters: () => Promise<void>;
}

export interface RecommendationsState {
  recommendations: BenefitRecommendation[];
  isLoading: boolean;
  error: Error | null;
  lastFetch: number;
  dismissedCount: number;
  refresh: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export interface OnboardingContextState {
  state?: UserOnboardingState;
  progress?: OnboardingProgress;
  isLoading: boolean;
  error: Error | null;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  skipStep: () => Promise<void>;
  completeStep: (input: CompleteOnboardingStepInput) => Promise<void>;
  reset: () => Promise<void>;
}

export interface OfflineContextState {
  status: SyncStatus;
  queue: OfflineQueueItem[];
  addToQueue: (item: OfflineQueueItem) => Promise<void>;
  sync: () => Promise<void>;
  clearQueue: () => Promise<void>;
}
