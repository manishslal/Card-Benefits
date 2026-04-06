/**
 * Admin Dashboard - Type Definitions
 * 
 * Comprehensive types for:
 * - Cards and Benefits
 * - Users and Roles
 * - Audit Logs
 * - UI State and Modals
 * - Common utilities
 */

/* ============================================================
   ENUMERATIONS
   ============================================================ */

export enum BenefitType {
  INSURANCE = 'INSURANCE',
  CASHBACK = 'CASHBACK',
  TRAVEL = 'TRAVEL',
  BANKING = 'BANKING',
  POINTS = 'POINTS',
  OTHER = 'OTHER',
}

export enum ResetCadence {
  ANNUAL = 'ANNUAL',
  PER_TRANSACTION = 'PER_TRANSACTION',
  PER_DAY = 'PER_DAY',
  MONTHLY = 'MONTHLY',
  ONE_TIME = 'ONE_TIME',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  TOGGLE = 'TOGGLE',
}

export enum ResourceType {
  CARD = 'CARD',
  BENEFIT = 'BENEFIT',
  USER_ROLE = 'USER_ROLE',
  SYSTEM_SETTING = 'SYSTEM_SETTING',
}

export enum SortField {
  ISSUER = 'issuer',
  CARD_NAME = 'cardName',
  DISPLAY_ORDER = 'displayOrder',
  UPDATED_AT = 'updatedAt',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/* ============================================================
   CARD TYPES
   ============================================================ */

export interface Card {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  benefitCount?: number;
  userCardCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CardWithBenefits extends Card {
  benefits: Benefit[];
}

export interface CardListResponse {
  success: boolean;
  data: Card[];
  pagination: PaginationInfo;
}

export interface CardDetailResponse {
  success: boolean;
  data: CardWithBenefits;
}

export interface CardCreateRequest {
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  description?: string;
}

export interface CardUpdateRequest {
  cardName?: string;
  defaultAnnualFee?: number;
  cardImageUrl?: string;
  description?: string;
}

export interface CardReorderRequest {
  cards: Array<{
    id: string;
    displayOrder: number;
  }>;
}

/* ============================================================
   BENEFIT TYPES
   ============================================================ */

export interface Benefit {
  id: string;
  masterCardId: string;
  name: string;
  type: BenefitType;
  stickerValue: number;
  resetCadence: ResetCadence;
  isDefault: boolean;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // NEW: Include card information for display
  masterCard?: {
    id: string;
    cardName: string;
    issuer?: string;
  };
}

export interface BenefitListResponse {
  success: boolean;
  data: Benefit[];
  pagination: PaginationInfo;
}

export interface BenefitCreateRequest {
  name: string;
  type: BenefitType;
  stickerValue: number;
  resetCadence: ResetCadence;
  isDefault?: boolean;
  description?: string;
}

export interface BenefitUpdateRequest {
  name?: string;
  stickerValue?: number;
  resetCadence?: ResetCadence;
  isDefault?: boolean;
  description?: string;
}

export interface BenefitToggleDefaultRequest {
  isDefault: boolean;
}

/* ============================================================
   USER TYPES
   ============================================================ */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  success: boolean;
  data: AdminUser[];
  pagination: PaginationInfo;
}

export interface RoleAssignmentRequest {
  userId: string;
  role: UserRole;
}

export interface RoleAssignmentResponse {
  success: boolean;
  data: AdminUser;
  message: string;
}

/* ============================================================
   AUDIT LOG TYPES
   ============================================================ */

export interface AuditLog {
  id: string;
  adminUserId: string;
  adminUserEmail?: string;
  actionType: AuditActionType;
  resourceType: ResourceType;
  resourceId: string;
  resourceName?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogListResponse {
  success: boolean;
  data: AuditLog[];
  pagination: PaginationInfo;
}

export interface AuditLogWithDiff extends AuditLog {
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
}

/* ============================================================
   PAGINATION & FILTERING
   ============================================================ */

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: SortField;
  sortDirection?: SortDirection;
}

export interface CardListQuery extends ListQueryParams {
  issuer?: string;
  isActive?: boolean;
}

export interface BenefitListQuery extends ListQueryParams {
  isActive?: boolean;
}

export interface UserListQuery extends ListQueryParams {
  role?: UserRole;
  isActive?: boolean;
}

export interface AuditLogQuery extends ListQueryParams {
  actionType?: AuditActionType;
  resourceType?: ResourceType;
  startDate?: string;
  endDate?: string;
  adminUserId?: string;
}

/* ============================================================
   API RESPONSE TYPES
   ============================================================ */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface ApiListResponse<T> extends ApiResponse<T[]> {
  pagination?: PaginationInfo;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  message?: string;
}

/* ============================================================
   MODAL STATES
   ============================================================ */

export type ModalType =
  | 'card-create'
  | 'card-edit'
  | 'card-delete'
  | 'benefit-create'
  | 'benefit-edit'
  | 'benefit-delete'
  | 'user-role-assign'
  | 'confirm-action'
  | null;

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  data?: any;
  title?: string;
  message?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

/* ============================================================
   FORM TYPES
   ============================================================ */

export type FormFieldType = 'text' | 'email' | 'number' | 'url' | 'select' | 'textarea' | 'checkbox';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  value: any;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: any }>;
  validation?: (value: any) => string | undefined;
  help?: string;
}

export interface FormState {
  fields: Record<string, FormField>;
  isSubmitting: boolean;
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

/* ============================================================
   ADMIN CONTEXT STATE
   ============================================================ */

export interface AdminContextState {
  // Card state
  cards: Card[];
  selectedCard: Card | null;
  cardCount: number;
  cardLoading: boolean;
  cardError: string | null;

  // Benefit state
  benefits: Benefit[];
  benefitLoading: boolean;
  benefitError: string | null;

  // User state
  users: AdminUser[];
  userCount: number;
  userLoading: boolean;
  userError: string | null;

  // Audit state
  auditLogs: AuditLog[];
  auditLoading: boolean;
  auditError: string | null;

  // Pagination & filtering
  currentPage: number;
  pageSize: number;
  filters: Record<string, any>;
  sortBy: SortField;
  sortDirection: SortDirection;
}

/* ============================================================
   UI CONTEXT STATE
   ============================================================ */

export interface UIContextState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  prefersDark: boolean;

  // Sidebar
  sidebarCollapsed: boolean;

  // Modals
  modal: ModalState;

  // Toasts
  toasts: Toast[];

  // Breadcrumb
  breadcrumb: BreadcrumbItem[];

  // Loading state
  isLoading: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/* ============================================================
   REQUEST/RESPONSE UTILITIES
   ============================================================ */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiRequestConfig extends RequestOptions {
  baseURL?: string;
  retry?: number;
  retryDelay?: number;
}

/* ============================================================
   CHANGE TRACKING
   ============================================================ */

export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  displayOldValue?: string;
  displayNewValue?: string;
}

export interface ChangeSet {
  resourceId: string;
  resourceType: ResourceType;
  changes: FieldChange[];
  changedAt: string;
  changedBy: string;
}

/* ============================================================
   TABLE & DATA DISPLAY
   ============================================================ */

export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableState {
  rows: TableRow[];
  selectedRows: Set<string>;
  currentPage: number;
  pageSize: number;
  total: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  loading: boolean;
  error: string | null;
}

/* ============================================================
   DASHBOARD METRICS
   ============================================================ */

export interface DashboardMetrics {
  totalCards: number;
  activeCards: number;
  totalBenefits: number;
  totalUsers: number;
  recentAuditLogs: AuditLog[];
  totalActions: number;
  actionsThisMonth: number;
}

export interface DashboardStats {
  cardsCreated: number;
  benefitsAdded: number;
  rolesAssigned: number;
  actionsAudited: number;
}

/* ============================================================
   VALIDATION TYPES
   ============================================================ */

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/* ============================================================
   UTILITY TYPES
   ============================================================ */

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

export type AsyncResult<T> = Promise<Result<T>>;
