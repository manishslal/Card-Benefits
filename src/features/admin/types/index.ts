/**
 * Barrel export for admin types
 */

export type {
  // Enumerations
  BenefitType,
  ResetCadence,
  UserRole,
  AuditActionType,
  ResourceType,
  SortField,
  SortDirection,
  // Card types
  Card,
  CardWithBenefits,
  CardListResponse,
  CardDetailResponse,
  CardCreateRequest,
  CardUpdateRequest,
  CardReorderRequest,
  // Benefit types
  Benefit,
  BenefitListResponse,
  BenefitCreateRequest,
  BenefitUpdateRequest,
  BenefitToggleDefaultRequest,
  // User types
  AdminUser,
  UserListResponse,
  RoleAssignmentRequest,
  RoleAssignmentResponse,
  // Audit types
  AuditLog,
  AuditLogListResponse,
  AuditLogWithDiff,
  // Pagination
  PaginationInfo,
  ListQueryParams,
  CardListQuery,
  BenefitListQuery,
  UserListQuery,
  AuditLogQuery,
  // API response
  ApiResponse,
  ApiListResponse,
  ApiErrorResponse,
  // Modal/UI
  ModalType,
  ModalState,
  FormField,
  FormState,
  AdminContextState,
  UIContextState,
  BreadcrumbItem,
  Toast,
  // Request/response
  RequestOptions,
  ApiRequestConfig,
  // Change tracking
  FieldChange,
  ChangeSet,
  // Table/data
  TableColumn,
  TableRow,
  TableState,
  // Dashboard
  DashboardMetrics,
  DashboardStats,
  // Validation
  ValidationError,
  ValidationResult,
  // Utilities
  DeepPartial,
  Nullable,
  Optional,
  Result,
  AsyncResult,
} from './admin';

export type {
  // API/HTTP
  HttpError,
  CacheEntry,
  CacheStore,
  CacheConfig,
  ApiClientConfig,
  FetchOptions,
} from './api';

export type {
  // Form data
  CardFormData,
  BenefitFormData,
  RoleAssignmentFormData,
  SearchFormData,
  FormData,
} from './forms';

// Re-export enums for convenience
export {
  BenefitType,
  ResetCadence,
  UserRole,
  AuditActionType,
  ResourceType,
  SortField,
  SortDirection,
} from './admin';
