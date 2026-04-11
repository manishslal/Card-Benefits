# Graph Report - src  (2026-04-10)

## Corpus Check
- Large corpus: 396 files · ~303,371 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1054 nodes · 1368 edges · 83 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `createError()` - 15 edges
2. `validateBenefitRecord()` - 11 edges
3. `POST()` - 9 edges
4. `GET()` - 9 edges
5. `ApiClient` - 9 edges
6. `RateLimiter` - 9 edges
7. `validateCardRecord()` - 8 edges
8. `RedisRateLimiter` - 8 edges
9. `calculatePeriodByCadence()` - 8 edges
10. `generateExport()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Dashboard API Client (api-client.ts)` --semantically_similar_to--> `Admin API Client (cardApi, benefitApi, userApi, auditApi)`  [INFERRED] [semantically similar]
  src/app/dashboard/README.md → src/features/admin/README.md
- `Dashboard WCAG 2.1 AA Accessibility` --semantically_similar_to--> `UI Standards WCAG 2.1 AA Accessibility`  [INFERRED] [semantically similar]
  src/app/dashboard/README.md → src/docs/UI_STANDARDS.md
- `Dashboard WCAG 2.1 AA Accessibility` --semantically_similar_to--> `Admin WCAG 2.1 AA Accessibility`  [INFERRED] [semantically similar]
  src/app/dashboard/README.md → src/features/admin/README.md
- `Dashboard Dark Mode Support` --semantically_similar_to--> `Admin Dark Mode Support`  [INFERRED] [semantically similar]
  src/app/dashboard/README.md → src/features/admin/README.md
- `Admin Validators (Zod-based)` --semantically_similar_to--> `Validation Functions (validateEmail, validateString, validateUUID, etc.)`  [INFERRED] [semantically similar]
  src/features/admin/README.md → src/lib/ERROR_HANDLING_GUIDE.md

## Hyperedges (group relationships)
- **WCAG 2.1 AA Accessibility Compliance Across All UIs** — dashboard_readme_wcag_accessibility, admin_readme_wcag_accessibility, ui_standards_accessibility [EXTRACTED 0.95]
- **CSS Variable Design Token System (No Hardcoded Colors)** — ui_standards_css_variables, admin_readme_design_tokens, ui_standards_admin_color_consistency, ui_standards_no_hardcoded_colors_rationale [EXTRACTED 0.95]
- **Server Action Error Handling Pipeline (Validate → Auth → Execute → Respond)** — error_handling_server_action_pattern, error_handling_validation_functions, error_handling_app_error, error_handling_error_codes, error_handling_action_response [EXTRACTED 1.00]

## Communities

### Community 0 - "Card & Benefit Modals"
Cohesion: 0.02
Nodes (10): handleSubmit(), validateForm(), handleSubmit(), validateForm(), EmailProviderFactory, MailgunProvider, MockEmailProvider, SendGridProvider (+2 more)

### Community 1 - "Benefit Value Context"
Cohesion: 0.04
Nodes (28): useROI(), useROIValue(), bulkUpdateUserDeclaredValues(), calculateROIValues(), clearUserDeclaredValue(), revertUserDeclaredValue(), updateUserDeclaredValue(), AppError (+20 more)

### Community 2 - "Admin Card Catalog"
Cohesion: 0.03
Nodes (7): handleAddCard(), validateForm(), handleSubmit(), isValidUrl(), validateForm(), handleKeyDown(), scroll()

### Community 3 - "Benefit Period Utils"
Cohesion: 0.05
Nodes (14): daysUntilExpiration(), getAvailablePeriods(), getClaimingLimitForPeriod(), getClaimingWindowBoundaries(), getDaysRemainingInPeriod(), getNextPeriodReset(), getPeriodBoundaries(), getUrgencyLevel() (+6 more)

### Community 4 - "Admin Audit Logging"
Cohesion: 0.06
Nodes (17): createAuditLog(), logResourceCreation(), logResourceDeletion(), logResourceUpdate(), extractRequestContext(), tryGetAdminContext(), verifyAdminRole(), archiveCard() (+9 more)

### Community 5 - "Benefit Filtering"
Cohesion: 0.05
Nodes (6): applyFilters(), filterByCadence(), filterByCategory(), filterByStatus(), filterByValueRange(), searchBenefits()

### Community 6 - "Benefit Group Display"
Cohesion: 0.06
Nodes (4): getHoverStyles(), handleMouseEnter(), handleKeyDown(), scroll()

### Community 7 - "Error Logging System"
Cohesion: 0.08
Nodes (25): logSafeError(), sanitizeErrorForLogging(), ValidationError, clearSessionCookie(), countUserCardsForMasterCard(), DELETE(), fetchCardWithCount(), formatCardResponse() (+17 more)

### Community 8 - "ROI Calculations"
Cohesion: 0.06
Nodes (6): filterToActivePeriod(), getEffectiveROI(), getExpirationWarnings(), getNetAnnualFee(), getTotalValueExtracted(), getUncapturedValue()

### Community 9 - "Alert Section"
Cohesion: 0.06
Nodes (9): commitBenefit(), commitCard(), processRecord(), detectDuplicates(), findDatabaseDuplicates(), findDifferences(), findExistingBenefit(), findExistingCard() (+1 more)

### Community 10 - "Auth Context"
Cohesion: 0.08
Nodes (16): getAuthContext(), getAuthError(), getAuthUserId(), isAuthenticated(), useAuthUserId(), createUnauthorizedResponse(), extractSessionToken(), isProtectedRoute() (+8 more)

### Community 11 - "Benefit Date Utils"
Cohesion: 0.06
Nodes (2): getLocalDaysUntilExpiration(), getRowBackgroundColor()

### Community 12 - "CSV Export Formatter"
Cohesion: 0.1
Nodes (20): formatDateField(), formatField(), formatMonetaryField(), generateCSV(), generateCSVHeader(), rowToCSV(), dataToArrays(), exportAll() (+12 more)

### Community 13 - "Admin API Client"
Cohesion: 0.1
Nodes (6): ApiClient, fetchDashboardData(), fetchUserBenefits(), transformBenefitsToRows(), handleSubmit(), validateForm()

### Community 14 - "Import Parser"
Cohesion: 0.17
Nodes (22): detectFileFormat(), parseCSV(), parseFile(), parseXLSX(), validateFileFormat(), createError(), parseISODate(), parseMonetary() (+14 more)

### Community 15 - "Redis Rate Limiting"
Cohesion: 0.13
Nodes (10): getClientIP(), getIdentifier(), rateLimitAPI(), rateLimitCron(), rateLimitLogin(), checkRateLimit(), getRedisRateLimiter(), InMemoryRateLimiter (+2 more)

### Community 16 - "Period Date Math"
Cohesion: 0.2
Nodes (18): calculateCardmemberYearPeriod(), calculateFlexibleAnnualPeriod(), calculateMonthlyPeriod(), calculateNextPeriod(), calculateOneTimePeriod(), calculatePeriodByCadence(), calculatePeriodForBenefit(), calculateQuarterlyPeriod() (+10 more)

### Community 17 - "Admin Auth Guards"
Cohesion: 0.13
Nodes (5): checkAdminStatus(), getAdminContextInfo(), isAdminUser(), requireAdminOrThrow(), validateAdminUser()

### Community 18 - "String Formatting"
Cohesion: 0.11
Nodes (0): 

### Community 19 - "Admin Layout & Theme"
Cohesion: 0.12
Nodes (0): 

### Community 20 - "MVP Bug Test Suite"
Cohesion: 0.12
Nodes (0): 

### Community 21 - "Metrics Counters"
Cohesion: 0.13
Nodes (3): Counter, Gauge, Histogram

### Community 22 - "Benefit Usage Utils"
Cohesion: 0.16
Nodes (3): calculateUsagePercentage(), formatBenefitAmount(), getUsageStatusText()

### Community 23 - "Session Management"
Cohesion: 0.15
Nodes (0): 

### Community 24 - "Accessibility Tests"
Cohesion: 0.2
Nodes (3): getContrastRatio(), getLuminance(), hexToRgb()

### Community 25 - "Admin Dashboard Docs"
Cohesion: 0.17
Nodes (12): Admin API Client (cardApi, benefitApi, userApi, auditApi), AdminContext State Management, Phase 3 Admin Dashboard UI, AdminLayout Component, AuditLogViewer Component, BenefitEditor Component, DataTable Component, Phase 2 API Integration (+4 more)

### Community 26 - "Error Mapping"
Cohesion: 0.2
Nodes (2): createErrorFromStatus(), parseApiError()

### Community 27 - "Rate Limiter Core"
Cohesion: 0.2
Nodes (1): RateLimiter

### Community 28 - "Period Helpers"
Cohesion: 0.25
Nodes (2): calculateDaysUntilExpiration(), isExpiringsoon()

### Community 29 - "Dashboard Component Docs"
Cohesion: 0.22
Nodes (9): BenefitGroup Component, BenefitRow Component, BenefitsList Component, Dashboard MVP - Period-First Benefits Tracker, Dashboard Performance Optimization Rationale, Period Helpers Utility (period-helpers.ts), PeriodSelector Component, StatusFilters Component (+1 more)

### Community 30 - "Error Handling Docs"
Cohesion: 0.22
Nodes (9): Admin Validators (Zod-based), ActionResponse<T> Type, AppError Class, ERROR_CODES Enum (Auth, Validation, Resource, Conflict, Rate Limit, Server), Rationale: Separate Client/Server Error Messages (No Implementation Details Leaked), Rationale: Validate → Auth → Authorize → Execute Order (Cost Optimization), Prisma Error Mapping (P2002 → CONFLICT_DUPLICATE, P2025 → RESOURCE_NOT_FOUND), Server Action Pattern (Validate → Authenticate → Authorize → Execute) (+1 more)

### Community 31 - "Period Boundaries"
Cohesion: 0.43
Nodes (6): calculatePeriodBoundaries(), daysRemainingInPeriod(), getCurrentPeriod(), getPeriodForDate(), getPeriodRange(), isSamePeriod()

### Community 32 - "Performance Tests"
Cohesion: 0.33
Nodes (0): 

### Community 33 - "Skeleton Loaders"
Cohesion: 0.5
Nodes (0): 

### Community 34 - "Admin API Tests"
Cohesion: 0.4
Nodes (0): 

### Community 35 - "Summary Stats Tests"
Cohesion: 0.4
Nodes (0): 

### Community 36 - "Workflow Integration Tests"
Cohesion: 0.4
Nodes (0): 

### Community 37 - "Email Validation"
Cohesion: 0.83
Nodes (3): getEmailErrorMessage(), isEmailValid(), validateEmail()

### Community 38 - "UI Design System"
Cohesion: 0.5
Nodes (4): CardTrack UI Standards & Design System, Design Tokens File (src/styles/design-tokens.css), Shared Button Component (src/shared/components/ui/button.tsx), UnifiedSelect Component (select-unified.tsx)

### Community 39 - "CSS Variable Theming"
Cohesion: 0.5
Nodes (4): Admin Design Tokens (CSS Variables), Admin Page Color Consistency Rule, CSS Variables Theming System, Rationale: No Hardcoded Colors (CSS Variables Only)

### Community 40 - "Modal & Dropdown Patterns"
Cohesion: 0.5
Nodes (4): Admin Modal Component, Dropdown position=popper Pattern, Modal Centering Pattern, Rationale: No mx-4 on Modal (Breaks Centering)

### Community 41 - "Onboarding Flow"
Cohesion: 0.67
Nodes (0): 

### Community 42 - "Import E2E Tests"
Cohesion: 0.67
Nodes (0): 

### Community 43 - "WCAG Accessibility"
Cohesion: 1.0
Nodes (3): Admin WCAG 2.1 AA Accessibility, Dashboard WCAG 2.1 AA Accessibility, UI Standards WCAG 2.1 AA Accessibility

### Community 44 - "Error Handling Guide"
Cohesion: 0.67
Nodes (3): src/lib/errors.ts File, Centralized Error Handling & Validation System, src/lib/validation.ts File

### Community 45 - "Sortable Page Wrapper"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Color Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Session Refresh Hook"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Card Skeleton"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Toast Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Benefit Skeleton"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Player Tabs"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Dark Mode Toggle"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Form Error Display"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Toast Container"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Dashboard Summary"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Form Validation Hook"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Tailwind Utilities"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Auth Error Handler"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Logger"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Dark Mode Docs"
Cohesion: 1.0
Nodes (2): Admin Dark Mode Support, Dashboard Dark Mode Support

### Community 61 - "Index Exports"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Error Boundary"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Card Component"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "API Routes"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Cards Hook Tests"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Validators"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Benefit Value Comparison"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Popover Component"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Icon Component"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Container Component"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Loading Spinner"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Import Actions Tests"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Cron Integration Tests"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Timezone DST Tests"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Error Handling Tests"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Import Duplicate Tests"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Auth Cookie Tests"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Import Validator Tests"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Cron Security Tests"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Import Parser Tests"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "App Header Standards"
Cohesion: 1.0
Nodes (1): AppHeader Component Standard

### Community 82 - "Button Variant Standards"
Cohesion: 1.0
Nodes (1): Button Variants Standard

## Knowledge Gaps
- **33 isolated node(s):** `StatusFilters Component`, `SummaryBox Component`, `BenefitRow Component`, `Period Helpers Utility (period-helpers.ts)`, `POST /api/benefits/filters Endpoint` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Sortable Page Wrapper`** (2 nodes): `SortablePageWrapper.tsx`, `SortablePageWrapper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Color Utilities`** (2 nodes): `colors.ts`, `cssVar()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Session Refresh Hook`** (2 nodes): `useSessionRefresh.ts`, `useSessionRefresh()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Skeleton`** (2 nodes): `CardSkeleton.tsx`, `CardSkeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toast Notifications`** (2 nodes): `Notifications.tsx`, `Toast()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Benefit Skeleton`** (2 nodes): `BenefitSkeleton.tsx`, `BenefitSkeleton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Player Tabs`** (2 nodes): `PlayerTabs.tsx`, `handleKeyDown()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dark Mode Toggle`** (2 nodes): `SafeDarkModeToggle.tsx`, `LoadingButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Form Error Display`** (2 nodes): `FormError.tsx`, `FormError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toast Container`** (2 nodes): `Toast.tsx`, `ToastContainer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Summary`** (2 nodes): `DashboardSummary.tsx`, `StatCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Form Validation Hook`** (2 nodes): `useFormValidation.ts`, `useFormValidation()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Utilities`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Error Handler`** (2 nodes): `useAuthErrorHandler.ts`, `useAuthErrorHandler()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Logger`** (2 nodes): `logger.ts`, `formatLog()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dark Mode Docs`** (2 nodes): `Admin Dark Mode Support`, `Dashboard Dark Mode Support`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index Exports`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Error Boundary`** (1 nodes): `error.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Component`** (1 nodes): `CardComponent.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `API Routes`** (1 nodes): `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cards Hook Tests`** (1 nodes): `useCards.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Validators`** (1 nodes): `validators.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Benefit Value Comparison`** (1 nodes): `BenefitValueComparison.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Popover Component`** (1 nodes): `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Icon Component`** (1 nodes): `Icon.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Container Component`** (1 nodes): `Container.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loading Spinner`** (1 nodes): `LoadingSpinner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Actions Tests`** (1 nodes): `import-server-actions.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cron Integration Tests`** (1 nodes): `cron-endpoint.integration.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Timezone DST Tests`** (1 nodes): `timezone-and-dst.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Error Handling Tests`** (1 nodes): `error-handling.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Duplicate Tests`** (1 nodes): `import-duplicate-detector.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Cookie Tests`** (1 nodes): `auth-cookie-integration.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Validator Tests`** (1 nodes): `import-validator.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Cron Security Tests`** (1 nodes): `cron-security.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Import Parser Tests`** (1 nodes): `import-parser.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Header Standards`** (1 nodes): `AppHeader Component Standard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button Variant Standards`** (1 nodes): `Button Variants Standard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `StatusFilters Component`, `SummaryBox Component`, `BenefitRow Component` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Card & Benefit Modals` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Benefit Value Context` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Admin Card Catalog` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Benefit Period Utils` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Admin Audit Logging` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Benefit Filtering` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._