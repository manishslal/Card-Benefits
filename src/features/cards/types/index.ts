/**
 * Card Management Feature Types
 * 
 * Comprehensive type definitions for the Card Management feature,
 * including display models, filters, state management, and API contracts.
 */

// ============================================================================
// Card Status
// ============================================================================

/**
 * Card status enum - valid values for card state
 * Using string type since SQLite doesn't support native enums
 */
export type CardStatus = 'ACTIVE' | 'PENDING' | 'PAUSED' | 'ARCHIVED' | 'DELETED';

/**
 * Valid state transitions for cards
 * Maps each current status to an array of valid next statuses
 */
export const VALID_CARD_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  ACTIVE: ['PENDING', 'PAUSED', 'ARCHIVED', 'DELETED'],
  PENDING: ['ACTIVE', 'ARCHIVED', 'DELETED'],
  PAUSED: ['ACTIVE', 'ARCHIVED', 'DELETED'],
  ARCHIVED: ['ACTIVE', 'DELETED'],
  DELETED: [] // Final state, no transitions out
};

/**
 * Renewal status indicators for UI display
 */
export type RenewalStatus = 'DueNow' | 'DueSoon' | 'Coming' | 'Safe' | 'Overdue';

// ============================================================================
// Card Display Models
// ============================================================================

/**
 * CardDisplayModel - used in list/grid views
 * Contains all information needed to display a card in the wallet
 */
export interface CardDisplayModel {
  id: string;
  issuer: string;
  cardName: string;
  customName: string | null;
  defaultAnnualFee: number; // In cents
  actualAnnualFee: number | null; // In cents (null = use default)
  effectiveAnnualFee: number; // actualAnnualFee ?? defaultAnnualFee

  renewalDate: Date;
  daysUntilRenewal: number; // Calculated daily
  renewalStatus: RenewalStatus; // Visual indicator for renewal urgency

  status: CardStatus;
  isOpen: boolean; // Derived from status (for backward compatibility)
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;

  // Derived metrics
  benefitsCount: number;
  activeBenefitsCount: number;
  claimedBenefitsCount: number;
  cardROI: number; // Percentage
  annualValue: number; // In cents

  // Issuer branding
  issuerLogo?: string; // CDN URL
  cardImageUrl: string; // CDN URL
}

/**
 * CardDetailsModel - used in detail panel
 * Extends CardDisplayModel with additional detail information
 */
export interface CardDetailsModel extends CardDisplayModel {
  masterCard: {
    id: string;
    issuer: string;
    cardName: string;
    defaultAnnualFee: number;
  };
  userBenefits: Array<{
    id: string;
    name: string;
    type: string;
    stickerValue: number;
    userDeclaredValue: number | null;
    resetCadence: string;
    isUsed: boolean;
    expirationDate: Date | null;
  }>;

  benefitsSummary: {
    unclaimed: number; // Total unclaimed value
    claimed: number; // Total claimed value
    total: number; // Sum of all benefits
    count: number; // Number of benefits
    activeCount: number; // Non-expired count
    expiredCount: number; // Expired count
  };

  diagnostics: {
    warnings: DiagnosticWarning[];
    suggestions: DiagnosticSuggestion[];
  };

  relatedStats: {
    percentOfWallet: number; // Card value / Total wallet value
    monthlyROI: number; // ROI amortized monthly
    monthlyAnnualFee: number; // Annual fee amortized monthly
  };
}

/**
 * Diagnostic warning for cards with issues
 */
export interface DiagnosticWarning {
  type: 'RENEWAL_OVERDUE' | 'NO_BENEFITS' | 'EXPIRED_BENEFITS' | 'MISSING_BENEFITS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  suggestedAction: string;
}

/**
 * Diagnostic suggestion for improvement
 */
export interface DiagnosticSuggestion {
  type: 'ADD_BENEFIT' | 'UPDATE_RENEWAL' | 'REVIEW_FEE' | 'CLAIM_BENEFIT';
  message: string;
  actionLabel: string;
}

// ============================================================================
// Card Filters & Search
// ============================================================================

/**
 * Card filter state - all available filters
 */
export interface CardFilters {
  search: string; // Search across name, issuer, custom name
  status: CardStatus[]; // Filter by status
  issuer: string[]; // Filter by issuer
  feeRange: [min: number, max: number]; // Annual fee range in cents
  renewalRange: [start: Date, end: Date]; // Renewal date range
  hasBenefits: boolean | null; // null = no filter, true/false = has/no benefits
}

/**
 * Reset filters to default values
 */
export const DEFAULT_FILTERS: CardFilters = {
  search: '',
  status: ['ACTIVE'],
  issuer: [],
  feeRange: [0, 10000 * 100], // $0 to $10,000
  renewalRange: [new Date(), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)], // Next year
  hasBenefits: null
};

/**
 * Saved filter - allows users to save and reuse filter combinations
 */
export interface SavedFilter {
  id: string;
  name: string;
  filters: CardFilters;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Sorting & Ordering
// ============================================================================

/**
 * Fields that can be sorted
 */
export type SortField = 'name' | 'issuer' | 'fee' | 'renewal' | 'roi' | 'benefits';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

// ============================================================================
// Card Management State
// ============================================================================

/**
 * Complete card management state for React Context/Zustand
 */
export interface CardManagementState {
  // Data
  cards: CardDisplayModel[];
  selectedCard: CardDetailsModel | null;
  selectedCardIds: Set<string>; // For bulk operations
  filteredCards: CardDisplayModel[];

  // UI State
  viewMode: 'grid' | 'list' | 'compact';
  sortBy: SortField;
  sortDir: SortDirection;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: CardFilters;
  savedFilters: SavedFilter[];
  selectedFilterId: string | null;

  // Actions
  setViewMode: (mode: 'grid' | 'list' | 'compact') => void;
  setSortBy: (sortBy: SortField, dir: SortDirection) => void;
  setFilters: (filters: Partial<CardFilters>) => void;
  clearFilters: () => void;
  selectCard: (cardId: string | null) => void;
  toggleCardSelection: (cardId: string) => void;
  setCards: (cards: CardDisplayModel[]) => void;
  applyFilters: () => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ============================================================================
// Card Operations Requests/Responses
// ============================================================================

/**
 * Request to fetch cards with filters
 */
export interface GetCardsRequest {
  playerId: string;
  status?: CardStatus | 'ALL'; // Default: 'ACTIVE'
  search?: string; // Search name/issuer/custom name
  issuer?: string[]; // Filter by issuers
  sortBy?: SortField; // Default: 'renewalDate'
  sortDir?: SortDirection; // Default: 'asc'
  limit?: number; // Default: 50
  offset?: number; // Default: 0
}

/**
 * Response when fetching cards
 */
export interface GetCardsResponse {
  success: true;
  data: {
    cards: CardDisplayModel[];
    total: number;
    limit: number;
    offset: number;
    stats: CardWalletStats;
  };
}

/**
 * Wallet statistics
 */
export interface CardWalletStats {
  totalCards: number;
  activeCards: number;
  archivedCards: number;
  pendingCards: number;
  pausedCards: number;
  totalROI: number; // Percentage
  walletValue: number; // Total annual value in cents
  totalAnnualFee: number; // Total annual fees in cents
}

/**
 * Request to create a card
 */
export interface CreateCardRequest {
  playerId: string;
  masterCardId: string;
  customName?: string; // 1-100 chars
  actualAnnualFee?: number; // Non-negative cents
  renewalDate: string; // ISO date string
}

/**
 * Response when creating a card
 */
export interface CreateCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    benefitsAdded: number;
  };
}

/**
 * Request to update a card
 */
export interface UpdateCardRequest {
  customName?: string;
  actualAnnualFee?: number;
  renewalDate?: string; // ISO date string
  status?: CardStatus;
}

/**
 * Response when updating a card
 */
export interface UpdateCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    changes: {
      roiImpact?: number; // Percent change
      affectedBenefits: number;
      statusChanged?: boolean;
    };
  };
}

/**
 * Request to archive a card
 */
export interface ArchiveCardRequest {
  reason?: string;
}

/**
 * Response when archiving a card
 */
export interface ArchiveCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    roiImpact: number; // Percentage change
  };
}

/**
 * Response when unarchiving a card
 */
export interface UnarchiveCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    roiImpact: number; // Percentage change
  };
}

/**
 * Request to delete a card
 */
export interface DeleteCardRequest {
  confirmation: string; // Must match card name exactly
}

/**
 * Response when deleting a card
 */
export interface DeleteCardResponse {
  success: true;
  message: string;
}

/**
 * Request for bulk operations
 */
export interface BulkUpdateRequest {
  cardIds: string[];
  updates: {
    status?: CardStatus;
    actualAnnualFee?: number;
    renewalDate?: string; // ISO date string
  };
}

/**
 * Response from bulk operations
 */
export interface BulkUpdateResponse {
  success: boolean;
  data: {
    updated: number;
    failed: number;
    errors?: Array<{ cardId: string; reason: string }>;
    roiImpact?: number;
  };
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for CardTile component (grid view)
 */
export interface CardTileProps {
  card: CardDisplayModel;
  isSelected: boolean;
  onSelect: (cardId: string) => void;
  onCardClick: (card: CardDisplayModel) => void;
  onMenuAction: (action: string, cardId: string) => void;
}

/**
 * Props for CardRow component (list view)
 */
export interface CardRowProps {
  card: CardDisplayModel;
  isSelected: boolean;
  onSelect: (cardId: string) => void;
  onCardClick: (card: CardDisplayModel) => void;
  onAction: (action: string, cardId: string) => void;
}

/**
 * Props for CardDetailPanel component
 */
export interface CardDetailPanelProps {
  card: CardDetailsModel | null;
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (updates: UpdateCardRequest) => Promise<void>;
  onArchive: (card: CardDetailsModel) => void;
  onDelete: (card: CardDetailsModel) => void;
  onUnarchive?: (card: CardDetailsModel) => void;
}

/**
 * Props for AddCardModal component
 */
export interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (card: CardDisplayModel) => void;
  playerId: string;
}

/**
 * Props for CardFiltersPanel component
 */
export interface CardFiltersPanelProps {
  filters: CardFilters;
  savedFilters: SavedFilter[];
  onFiltersChange: (filters: CardFilters) => void;
  onSaveFilter: (name: string) => void;
  onLoadFilter: (filterId: string) => void;
  onClearFilters: () => void;
}

/**
 * Props for BulkActionBar component
 */
export interface BulkActionBarProps {
  selectedCount: number;
  availableActions: string[];
  onAction: (action: string) => void;
  onClearSelection: () => void;
}

// ============================================================================
// Validation & Constants
// ============================================================================

/**
 * Custom name validation constraints
 */
export const CUSTOM_NAME_CONSTRAINTS = {
  minLength: 1,
  maxLength: 100
};

/**
 * Annual fee constraints (in cents)
 */
export const ANNUAL_FEE_CONSTRAINTS = {
  min: 0,
  max: 10000 * 100 // $10,000
};

/**
 * Renewal date thresholds (days)
 */
export const RENEWAL_THRESHOLDS = {
  overdue: 0, // < 0 days
  dueSoon: 30, // < 30 days
  approaching: 60, // < 60 days
  safe: 60 // >= 60 days
};
