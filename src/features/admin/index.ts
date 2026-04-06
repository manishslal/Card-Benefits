/**
 * Barrel export for entire admin feature module
 * 
 * Exports:
 * - Types (cards, benefits, users, audit, UI state)
 * - Components (7 layers from layout to specialized)
 * - Context & Hooks for state management and data fetching
 * - Utilities (API client, validators, formatters)
 * - Validation schemas and middleware from Phase 2
 */

// ============================================================
// PHASE 3 UI COMPONENTS & UTILITIES
// ============================================================

// Types
export type {
  BenefitType,
  ResetCadence,
  UserRole,
  Card,
  Benefit,
  AdminUser,
  AuditLog,
  ModalState,
  Toast,
  FormState,
  AdminContextState,
  UIContextState,
  CardListQuery,
  BenefitListQuery,
  UserListQuery,
  AuditLogQuery,
} from './types';

export {
  BenefitType,
  ResetCadence,
  UserRole,
  AuditActionType,
  ResourceType,
  SortField,
  SortDirection,
} from './types';

// Components - Layer 1: Layout
export {
  AdminLayout,
  Sidebar,
  TopNavBar,
  PageHeader,
} from './components/layout';

// Components - Layer 2: Data Display
export {
  DataTable,
  PaginationControls,
  LoadingState,
  ErrorState,
  EmptyState,
} from './components/data-display';

// Components - Layer 3: Forms
export {
  FormGroup,
  FormInput,
  FormSelect,
  FormToggle,
  Form,
  Modal,
  ConfirmDialog,
} from './components/forms';

// Components - Layer 4: Notifications
export {
  Toast,
  ToastContainer,
  Badge,
  StatusIndicator,
  Alert,
  Progress,
  Tooltip,
} from './components/notifications';

// Context & Hooks
export { AdminContextProvider, useAdminContext } from './context/AdminContext';
export { UIContextProvider, useUIContext, useTheme, useModal, useToast } from './context/UIContext';

export {
  useCards,
  useBenefits,
  useUsers,
  useAuditLogs,
  useForm,
  useAsyncState,
  useDebounce,
  usePrevious,
  useLocalStorage,
  useMediaQuery,
  useOutsideClick,
  useToggle,
} from './hooks';

// Utilities
export {
  apiClient,
  cardApi,
  benefitApi,
  userApi,
  auditApi,
  getErrorMessage,
  cardFormSchema,
  benefitFormSchema,
  validateForm,
  fieldValidators,
  formatDate,
  formatCurrency,
  formatBenefitType,
  formatResetCadence,
  formatActionType,
  formatResourceType,
} from './lib';

// ============================================================
// PHASE 2 VALIDATION SCHEMAS & MIDDLEWARE (re-exported for convenience)
// ============================================================

export {
  // Pagination
  PaginationQuerySchema,
  type PaginationMeta,
  // Card Management
  CreateCardSchema,
  UpdateCardSchema,
  ListCardsQuerySchema,
  DeleteCardQuerySchema,
  ReorderCardsSchema,
  type CreateCardInput,
  type UpdateCardInput,
  type ListCardsQuery,
  type DeleteCardQuery,
  type ReorderCardsInput,
  // Benefit Management
  BenefitTypeEnum,
  ResetCadenceEnum,
  CreateBenefitSchema,
  UpdateBenefitSchema,
  ListBenefitsQuerySchema,
  ToggleBenefitDefaultSchema,
  DeleteBenefitQuerySchema,
  type CreateBenefitInput,
  type UpdateBenefitInput,
  type ListBenefitsQuery,
  type ToggleBenefitDefaultInput,
  type DeleteBenefitQuery,
  // User Role Management
  UserRoleEnum,
  ListUsersQuerySchema,
  AssignRoleSchema,
  type ListUsersQuery,
  type AssignRoleInput,
  // Audit Logs
  AuditActionTypeEnum,
  ResourceTypeEnum,
  ListAuditLogsQuerySchema,
  type ListAuditLogsQuery,
  // Parsing utilities
  parseQueryParams,
  parseRequestBody,
} from './validation/schemas';

export {
  verifyAdminRole,
  extractRequestContext,
  createAuthErrorResponse,
  type AdminRequestContext,
} from './middleware/auth';

export {
  createAuditLog,
  logResourceCreation,
  logResourceUpdate,
  logResourceDeletion,
  getChangedFields,
  type AuditLogOptions,
} from './lib/audit';
