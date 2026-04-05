# WAVE1-QUICKWINS Technical Specification

**Card-Benefits Application**  
**Version:** 1.0.0  
**Date:** 2024  
**Status:** Ready for Implementation

---

## Executive Summary

WAVE1-QUICKWINS delivers five critical user experience and accessibility features to establish foundational quality standards for the Card-Benefits application. These features address core gaps in authentication workflow (password recovery, session management), accessibility compliance (ARIA, keyboard navigation, screen reader support), error communication, and visual feedback during loading states.

### Primary Objectives
- ✓ Enable password recovery workflow for locked-out users
- ✓ Implement proactive session timeout management with recovery option
- ✓ Achieve WCAG 2.1 AA accessibility compliance
- ✓ Provide clear, actionable error messaging across all workflows
- ✓ Deliver visual feedback during all asynchronous operations

### Success Criteria
- All 5 features fully implemented per specification
- Zero build/TypeScript compilation errors
- All tests passing (unit, integration, a11y, responsive)
- Lighthouse accessibility score ≥90
- WCAG 2.1 AA audit passes
- 100% of error paths handled with user-friendly messages
- 100% of async operations show loading states
- Multi-tab session sync works correctly

---

## Functional Requirements

### Feature 1: Password Recovery
**Scope:** Enable users to reset forgotten passwords via email with secure token-based verification

**User Flow:**
1. User clicks "Forgot Password?" link on login page
2. User enters email address, form validates email format
3. System sends reset email with 6-hour expiry token
4. User clicks email link (or manually enters token)
5. User sets new password with validation (min 8 chars, mixed case, number)
6. System confirms success and redirects to login

**Constraints:**
- Token must expire after 6 hours
- Token can only be used once
- Password must meet minimum requirements
- Email must exist in system

### Feature 2: Session Management
**Scope:** Prevent unexpected logouts by warning users 5 minutes before session expiry, with option to extend

**User Flow:**
1. User logs in, session starts with 30-minute expiry
2. At 25-minute mark, SessionExpirationModal appears with 5-minute countdown
3. User can click "Stay Logged In" to extend session another 30 minutes
4. If user ignores modal, session expires and 401 errors redirect to login with message
5. If logout happens in another tab, localStorage sync detects and logs out current tab immediately

**Constraints:**
- Warning must appear exactly 5 minutes before expiry
- Extension refreshes token and restarts 30-minute timer
- Token refresh must be atomic (old token invalidated after new one issued)
- Multi-tab logout detection must be real-time (within 500ms)

### Feature 3: Accessibility Improvements
**Scope:** Ensure application meets WCAG 2.1 AA standards for inclusive design

**Coverage:**
- All form inputs must have associated labels + aria-label/aria-describedby
- All buttons/links must have clear text or aria-label
- Color contrast must be ≥4.5:1 for normal text, ≥3:1 for large text
- All interactive elements must be keyboard navigable (Tab order)
- Modal focus must be trapped (Tab cycles within modal only)
- Escape key must close modals
- All buttons must be activatable with Enter/Space
- Screen reader must announce form errors, success messages, loading states

**Constraints:**
- No visual-only indicators (color alone cannot convey meaning)
- Focus must be visible at all times (outline not removed)
- Semantic HTML must be used (no div role abuse)

### Feature 4: Error Message Enhancements
**Scope:** Provide clear, actionable, user-friendly error messages across all workflows

**Error Categories:**
- **Validation Errors:** "Password must be at least 8 characters"
- **Authentication Errors:** "Invalid email or password"
- **Authorization Errors:** "You don't have permission to access this resource"
- **Resource Errors:** "This email is already registered"
- **Server Errors:** "Something went wrong. Please try again or contact support"
- **Network Errors:** "Network connection lost. [Retry] button"

**Constraints:**
- All error messages must be user-friendly (no technical jargon)
- Errors must appear inline in forms when possible
- Toast notifications for async operation feedback
- Error must disappear when user fixes input (on blur → valid)

### Feature 5: Loading States
**Scope:** Provide visual feedback during all asynchronous operations to prevent perceived hangs

**Loading Indicators:**
- **Buttons:** Disabled + spinner during submit
- **Forms:** Greyed out, disabled inputs during processing
- **Lists:** Skeleton loaders for content lists (min 200ms show time to avoid flashing)
- **Progress:** ProgressBar for multi-step forms
- **Overall:** Fade animations, no abrupt appearance/disappearance

**Constraints:**
- Minimum 200ms before showing skeleton (avoid "flash" on fast networks)
- Spinner animation must be smooth and accessible
- Buttons must be disabled during submission (prevent double-submit)
- All async operations must have corresponding loading state

---

## Implementation Phases

### Phase 1: Database & API Foundation (Days 1-2)
**Objectives:**
- Add password reset fields to User model
- Implement Prisma migration
- Create all auth API endpoints
- Setup email service abstraction layer

**Key Deliverables:**
- ✓ User model migration (passwordResetToken, passwordResetExpiry)
- ✓ POST /api/auth/forgot-password endpoint
- ✓ POST /api/auth/reset-password endpoint
- ✓ POST /api/auth/refresh-token endpoint
- ✓ GET /api/auth/session-status endpoint
- ✓ Email service interface (abstraction)
- ✓ Mock email provider for testing

**Dependencies:** None

---

### Phase 2: Authentication Components (Days 2-3)
**Objectives:**
- Build password recovery UI components
- Implement session management components
- Wire components to API endpoints
- Add token refresh logic

**Key Deliverables:**
- ✓ PasswordResetForm component
- ✓ SessionExpirationModal component
- ✓ Session refresh hook (useSessionRefresh)
- ✓ localStorage sync listener for multi-tab logout
- ✓ Integration tests for auth flows

**Dependencies:** Phase 1 (API endpoints must be ready)

---

### Phase 3: Accessibility & UX Components (Days 3-4)
**Objectives:**
- Build loading state components (skeletons, spinners, progress bar)
- Enhance FormError component with categorization
- Add ARIA labels/descriptors to all interactive elements
- Implement keyboard navigation

**Key Deliverables:**
- ✓ SkeletonCard, SkeletonText, SkeletonList components
- ✓ LoadingSpinner component
- ✓ ProgressBar component
- ✓ Enhanced FormError component
- ✓ ARIA labels on all form inputs
- ✓ Button component with loading state

**Dependencies:** Phase 1-2 (for context and integration)

---

### Phase 4: Error Handling & Messages (Days 4-5)
**Objectives:**
- Create error mapping utility
- Implement user-friendly error messages
- Add toast notifications for feedback
- Wire error messages to all API calls

**Key Deliverables:**
- ✓ errorMapping.ts utility
- ✓ Toast notification component
- ✓ Error messages for all API endpoints
- ✓ Network error handling with retry
- ✓ Error message strings (en-US)

**Dependencies:** Phase 1 (API endpoints)

---

### Phase 5: Testing & Verification (Days 5-6)
**Objectives:**
- Write unit tests for all components
- Write integration tests for auth flows
- Accessibility testing (a11y, screen reader, keyboard nav)
- Responsive design verification
- WCAG 2.1 AA audit

**Key Deliverables:**
- ✓ Unit tests (>80% coverage)
- ✓ Integration tests (all flows)
- ✓ a11y tests (axe-core automated)
- ✓ Manual keyboard navigation verification
- ✓ Screen reader testing (VoiceOver/NVDA)
- ✓ Responsive design verification
- ✓ Lighthouse audit report (90+)

**Dependencies:** Phases 1-4 (all features implemented)

---

## Data Schema & Database

### Prisma User Model Modifications

**File:** `prisma/schema.prisma`

```prisma
model User {
  id                    String    @id @default(cuid())
  email                 String    @unique @db.VarChar(255)
  password              String    @db.VarChar(255)
  name                  String?   @db.VarChar(255)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  // NEW: Password Recovery Fields
  passwordResetToken    String?   @unique @db.VarChar(255)
  passwordResetExpiry   DateTime?
  
  // NEW: Session Management (optional, for future enhancements)
  // lastLoginAt          DateTime?
  // loginAttempts        Int       @default(0)
  // lockedUntil          DateTime?

  @@index([email])
  @@index([passwordResetToken])
  @@map("users")
}
```

### Indexes for Performance

```prisma
// In User model:
@@index([email])                    // For login lookups
@@index([passwordResetToken])       // For token validation during reset
```

### Migration Command

```bash
npx prisma migrate dev --name add_password_reset_fields
```

This will:
1. Create migration file: `prisma/migrations/[timestamp]_add_password_reset_fields/migration.sql`
2. Apply migration to development database
3. Regenerate Prisma client types

### Email Service Data Structure (In-Memory Queue)

**File:** `src/lib/email/types.ts`

```typescript
export interface EmailMessage {
  to: string
  subject: string
  htmlContent: string
  textContent: string
  fromAddress?: string
  templateId?: string
  variables?: Record<string, string>
  sentAt?: Date
}

export interface PasswordResetEmail extends EmailMessage {
  variables: {
    resetLink: string
    expiresAt: string
    username: string
  }
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ messageId: string }>
  sendPasswordReset(email: PasswordResetEmail): Promise<{ messageId: string }>
}
```

---

## API Contracts & Routes

### 1. Password Recovery Endpoints

#### POST /api/auth/forgot-password

**Purpose:** Initiate password recovery by sending reset email

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Response 400 (Validation Error):**
```json
{
  "success": false,
  "message": "Email address is required",
  "field": "email"
}
```

**Response 404 (User Not Found):**
```json
{
  "success": false,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```
*Note: Return generic message for security (don't reveal if email exists)*

**Response 500 (Server Error):**
```json
{
  "success": false,
  "message": "Failed to send reset email. Please try again later."
}
```

**Implementation:**
- File: `src/app/api/auth/forgot-password/route.ts`
- Actions: Validate email format, lookup user, generate reset token, save to DB, send email, return 200 regardless of user existence (security)
- Token generation: 32-character random hex string, expires in 6 hours
- Email template: Include reset link with token as query param
- Error handling: Network errors, email service down, DB errors

---

#### POST /api/auth/reset-password

**Purpose:** Complete password reset with valid token and new password

**Request:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "password": "NewPassword123!"
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password.",
  "redirect": "/login?message=password_reset_success"
}
```

**Response 400 (Validation Error):**
```json
{
  "success": false,
  "message": "Password must be at least 8 characters and contain uppercase, lowercase, and numbers",
  "field": "password",
  "code": "INVALID_PASSWORD"
}
```

**Response 400 (Expired Token):**
```json
{
  "success": false,
  "message": "Password reset link has expired. Please request a new one.",
  "code": "TOKEN_EXPIRED"
}
```

**Response 400 (Invalid Token):**
```json
{
  "success": false,
  "message": "Invalid or already-used password reset link.",
  "code": "INVALID_TOKEN"
}
```

**Response 500 (Server Error):**
```json
{
  "success": false,
  "message": "Failed to reset password. Please try again later.",
  "code": "INTERNAL_ERROR"
}
```

**Implementation:**
- File: `src/app/api/auth/reset-password/route.ts`
- Actions: Validate token format, lookup user by token, verify token not expired, verify token not already used, validate password requirements, hash password, clear reset token fields, save user, return 200
- Password validation: Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
- Token invalidation: After successful reset, set passwordResetToken to null and passwordResetExpiry to null
- Error handling: Invalid input, expired token, token not found, hashing errors

---

#### POST /api/auth/refresh-token

**Purpose:** Extend current session by issuing new token before expiry

**Request:**
```json
{}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 1800,
  "expiresAt": "2024-01-15T15:30:00Z"
}
```

**Response 401 (Unauthorized - No Session):**
```json
{
  "success": false,
  "message": "Session expired. Please log in again.",
  "code": "SESSION_EXPIRED"
}
```

**Response 401 (Unauthorized - Invalid Token):**
```json
{
  "success": false,
  "message": "Invalid session. Please log in again.",
  "code": "INVALID_SESSION"
}
```

**Response 500 (Server Error):**
```json
{
  "success": false,
  "message": "Failed to refresh session. Please log in again.",
  "code": "INTERNAL_ERROR"
}
```

**Implementation:**
- File: `src/app/api/auth/refresh-token/route.ts`
- Requires: Valid JWT token in Authorization header (`Bearer <token>`)
- Actions: Verify current token validity (not expired, correct signature), generate new token, set 30-minute expiry, return new token
- Atomicity: Old token invalidated immediately after new one issued (prevents concurrent requests with same old token)
- Error handling: Missing token, invalid token, signature mismatch, expiry verification failure

---

#### GET /api/auth/session-status

**Purpose:** Check current session status and get expiry times for UI countdown

**Request:**
```
GET /api/auth/session-status
```

**Response 200 (Active Session):**
```json
{
  "success": true,
  "isAuthenticated": true,
  "status": "active",
  "expiresAt": "2024-01-15T15:30:00Z",
  "warningAt": "2024-01-15T15:25:00Z",
  "timeRemaining": 300,
  "userId": "user_123"
}
```

**Response 200 (Expiring Soon):**
```json
{
  "success": true,
  "isAuthenticated": true,
  "status": "expiring",
  "expiresAt": "2024-01-15T15:30:00Z",
  "warningAt": "2024-01-15T15:25:00Z",
  "timeRemaining": 45,
  "userId": "user_123"
}
```

**Response 200 (No Session):**
```json
{
  "success": true,
  "isAuthenticated": false,
  "status": "inactive"
}
```

**Response 401 (Expired Session):**
```json
{
  "success": false,
  "message": "Session has expired",
  "code": "SESSION_EXPIRED"
}
```

**Implementation:**
- File: `src/app/api/auth/session-status/route.ts`
- Requires: Valid JWT token in Authorization header
- Actions: Verify token, calculate time remaining, determine if in warning window (5 min or less), return status
- Returns: ISO 8601 timestamps for client-side countdown calculations
- Error handling: Missing token, invalid token, expired token

---

## Component Architecture

### Directory Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                    [UPDATE: add forgot password link]
│   ├── api/
│   │   └── auth/
│   │       ├── forgot-password/
│   │       │   └── route.ts                [CREATE]
│   │       ├── reset-password/
│   │       │   └── route.ts                [CREATE]
│   │       ├── refresh-token/
│   │       │   └── route.ts                [CREATE]
│   │       └── session-status/
│   │           └── route.ts                [CREATE]
│
├── features/
│   └── auth/
│       ├── components/
│       │   ├── PasswordResetForm.tsx       [CREATE]
│       │   ├── SessionExpirationModal.tsx  [CREATE]
│       │   └── LoginForm.tsx               [UPDATE: integrate PasswordResetForm]
│       ├── hooks/
│       │   ├── useSessionRefresh.ts        [CREATE]
│       │   └── usePasswordReset.ts         [CREATE]
│       └── lib/
│           ├── sessionManager.ts           [CREATE]
│           ├── tokenRefresh.ts             [CREATE]
│           └── validatePassword.ts         [CREATE]
│
├── shared/
│   ├── components/
│   │   ├── FormError.tsx                   [UPDATE: add categorization]
│   │   ├── Button.tsx                      [UPDATE: add loading state]
│   │   ├── loaders/
│   │   │   ├── SkeletonCard.tsx            [CREATE]
│   │   │   ├── SkeletonText.tsx            [CREATE]
│   │   │   ├── SkeletonList.tsx            [CREATE]
│   │   │   └── LoadingSpinner.tsx          [CREATE]
│   │   ├── feedback/
│   │   │   ├── Toast.tsx                   [CREATE]
│   │   │   └── ProgressBar.tsx             [CREATE]
│   │   └── Modal.tsx                       [UPDATE: add focus trap, Escape handler]
│   └── lib/
│       ├── errorMapping.ts                 [CREATE]
│       ├── email/
│       │   ├── types.ts                    [CREATE]
│       │   ├── factory.ts                  [CREATE]
│       │   └── providers/
│       │       ├── MockEmailProvider.ts    [CREATE]
│       │       ├── SendGridProvider.ts     [CREATE - stub for Wave 2]
│       │       └── MailgunProvider.ts      [CREATE - stub for Wave 2]
│       └── validators/
│           └── passwordValidator.ts        [CREATE]
```

---

## Core Components Specification

### 1. PasswordResetForm Component

**File:** `src/features/auth/components/PasswordResetForm.tsx`

**Purpose:** Two-step form component for password recovery (request → reset)

**Props:**
```typescript
interface PasswordResetFormProps {
  onSuccess?: (email: string) => void
  onError?: (error: string) => void
}
```

**States:**
- `'request'`: User enters email, clicks "Send Reset Email"
- `'check-email'`: Confirmation message, user checks email
- `'reset'`: User enters token + new password
- `'success'`: Confirmation message, option to go to login

**Component Structure:**
```
<div className="password-reset-form">
  {step === 'request' && <EmailRequestStep />}
  {step === 'check-email' && <CheckEmailStep />}
  {step === 'reset' && <ResetPasswordStep />}
  {step === 'success' && <SuccessStep />}
</div>
```

**Key Features:**
- Email validation (format + existence check via API)
- Auto-paste token from URL query param if available
- Password strength indicator (visual feedback)
- Error messages with recovery instructions
- Loading state during API calls (disabled inputs, spinner)
- Keyboard navigation (Tab order, Enter to submit)
- ARIA labels for screen reader clarity

**Accessibility Requirements:**
```typescript
// Example: Email input with proper ARIA
<input
  id="password-reset-email"
  type="email"
  aria-label="Email address"
  aria-describedby="email-error"
  required
/>
<div id="email-error" role="alert" aria-live="polite">
  {emailError && <FormError message={emailError} />}
</div>

// Example: Password input with strength indicator
<input
  id="new-password"
  type="password"
  aria-label="New password"
  aria-describedby="password-requirements password-strength"
  required
/>
<div id="password-requirements">
  Min 8 characters, uppercase, lowercase, number
</div>
<div id="password-strength" aria-live="polite">
  Strength: {strength}
</div>
```

---

### 2. SessionExpirationModal Component

**File:** `src/features/auth/components/SessionExpirationModal.tsx`

**Purpose:** Modal warning user of imminent session expiry, with countdown and extend option

**Props:**
```typescript
interface SessionExpirationModalProps {
  isOpen: boolean
  expiresAt: Date
  onStayLoggedIn: () => Promise<void>
  onLogout: () => void
}
```

**Features:**
- Countdown timer (displays remaining time: "4:59", "4:58", etc.)
- "Stay Logged In" button calls refresh-token API
- "Log Out Now" button clears session and redirects to login
- Non-dismissible by clicking outside (focus trap)
- Escape key closes modal and logs user out
- Screen reader announces countdown in accessible way

**Accessibility Requirements:**
```typescript
// Example: Modal with focus trap and ARIA
<div
  role="alertdialog"
  aria-labelledby="session-warning-title"
  aria-describedby="session-warning-description"
  aria-live="assertive"
>
  <h2 id="session-warning-title">Your session is about to expire</h2>
  <p id="session-warning-description">
    Your session will expire in <span aria-live="polite">{minutes}:{seconds}</span>
  </p>
  <button onClick={onStayLoggedIn} aria-label="Extend session by 30 minutes">
    Stay Logged In
  </button>
  <button onClick={onLogout} aria-label="Log out immediately">
    Log Out Now
  </button>
</div>
```

**Integration Points:**
- Hook: `useSessionRefresh()` for countdown timer and refresh logic
- Hook: `useLocalStorageSync()` for multi-tab logout detection
- Mounted in layout (wraps entire app) for global session monitoring

---

### 3. Loading Components (Skeletons, Spinners, Progress)

#### SkeletonCard Component
**File:** `src/shared/components/loaders/SkeletonCard.tsx`

```typescript
interface SkeletonCardProps {
  rows?: number          // Number of text skeleton rows
  showImage?: boolean    // Show image placeholder
  className?: string
}

// Renders shimmer animation with placeholder content
// Used during list loading
```

#### SkeletonText Component
**File:** `src/shared/components/loaders/SkeletonText.tsx`

```typescript
interface SkeletonTextProps {
  lines?: number         // Number of text lines
  width?: string        // Width override (default 100%)
  className?: string
}
```

#### SkeletonList Component
**File:** `src/shared/components/loaders/SkeletonList.tsx`

```typescript
interface SkeletonListProps {
  count?: number        // Number of skeleton items
  itemType?: 'card' | 'row' | 'text'
  className?: string
}
```

#### LoadingSpinner Component
**File:** `src/shared/components/loaders/LoadingSpinner.tsx`

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'           // 24px, 40px, 64px
  variant?: 'default' | 'overlay'     // overlay = centered with semi-transparent bg
  ariaLabel?: string                  // Accessibility
  className?: string
}

// Renders smooth CSS animation (no image assets)
// Accessibility: aria-label="Loading..." + role="status"
```

#### ProgressBar Component
**File:** `src/shared/components/feedback/ProgressBar.tsx`

```typescript
interface ProgressBarProps {
  progress: number       // 0-100
  label?: string        // "Step 2 of 5"
  showPercentage?: boolean
  animated?: boolean
  className?: string
}

// Renders horizontal progress bar with optional label
// Used in multi-step forms
```

---

### 4. Enhanced FormError Component

**File:** `src/shared/components/FormError.tsx`

**Current (Needs Update):**
```typescript
interface FormErrorProps {
  message: string
}
```

**Updated Version:**
```typescript
type ErrorCategory = 'validation' | 'auth' | 'conflict' | 'server' | 'network'

interface FormErrorProps {
  message: string
  category?: ErrorCategory
  fieldName?: string
  onRetry?: () => void          // For network errors
  className?: string
}

// Renders:
// - Icon (varies by category)
// - Message
// - Retry button (if network error)
// - Accessibility: role="alert", aria-live="polite"
```

**Example Usage:**
```tsx
<FormError
  message="This email is already registered"
  category="conflict"
  fieldName="email"
/>
```

---

### 5. Enhanced Button Component

**File:** `src/shared/components/Button.tsx`

**Current (Needs Update):**
```typescript
interface ButtonProps {
  onClick: () => void
  children: React.ReactNode
  // ... other props
}
```

**Updated Version:**
```typescript
interface ButtonProps {
  onClick?: () => void
  children: React.ReactNode
  loading?: boolean         // NEW: show spinner if true
  disabled?: boolean
  loadingText?: string      // Optional text during loading
  // ... other existing props
}

// Renders:
// - Disabled state when loading={true}
// - Spinner icon + optional text
// - Aria-busy="true" during loading
```

**Example Usage:**
```tsx
<Button
  loading={isSubmitting}
  loadingText="Resetting..."
  onClick={handleSubmit}
>
  Reset Password
</Button>
```

---

### 6. Toast Notification Component

**File:** `src/shared/components/feedback/Toast.tsx`

```typescript
type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type: ToastType
  duration?: number        // Auto-dismiss milliseconds (default 4000)
  onDismiss?: () => void
}

// Context + Provider for global toast management
// Accessibility: role="status" or role="alert" (based on type)
```

**Hook for Usage:**
```typescript
// File: src/shared/hooks/useToast.ts
const { showToast } = useToast()

showToast({
  message: 'Password reset successful',
  type: 'success',
  duration: 3000
})
```

---

## Error Mapping & User Messages

### Error Mapping Utility

**File:** `src/shared/lib/errorMapping.ts`

```typescript
export type ApiErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'EMAIL_EXISTS'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

interface ApiError {
  code: ApiErrorCode
  message: string
  statusCode: number
  field?: string
  recoveryAction?: string
}

export function mapApiErrorToUserMessage(error: ApiError): string {
  const messages: Record<ApiErrorCode, string> = {
    'INVALID_INPUT': 'Please check your input and try again',
    'INVALID_EMAIL': 'Please enter a valid email address',
    'INVALID_PASSWORD': 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
    'USER_NOT_FOUND': 'No account found with this email address',
    'UNAUTHORIZED': 'Invalid email or password',
    'SESSION_EXPIRED': 'Your session has expired. Please log in again',
    'EMAIL_EXISTS': 'This email is already registered. Please log in instead',
    'TOKEN_EXPIRED': 'Password reset link has expired. Please request a new one',
    'INVALID_TOKEN': 'Invalid or already-used reset link. Please request a new one',
    'INTERNAL_ERROR': 'Something went wrong on our end. Please try again or contact support',
    'NETWORK_ERROR': 'Network connection lost. Check your connection and try again'
  }

  return messages[error.code] || 'An unexpected error occurred'
}

export function isRetryableError(error: ApiError): boolean {
  return ['NETWORK_ERROR', 'INTERNAL_ERROR'].includes(error.code)
}
```

**HTTP Status Code to Error Code Mapping:**

| Status | Code | User Message |
|--------|------|--------------|
| 400 | `INVALID_INPUT` | "Please check your input and try again" |
| 400 | `INVALID_EMAIL` | "Please enter a valid email address" |
| 400 | `INVALID_PASSWORD` | "Password must be at least 8 characters with uppercase, lowercase, and numbers" |
| 400 | `TOKEN_EXPIRED` | "Password reset link has expired. Please request a new one" |
| 400 | `INVALID_TOKEN` | "Invalid or already-used reset link. Please request a new one" |
| 401 | `UNAUTHORIZED` | "Invalid email or password" |
| 401 | `SESSION_EXPIRED` | "Your session has expired. Please log in again" |
| 404 | `USER_NOT_FOUND` | Generic message "If account exists..." (don't reveal) |
| 409 | `EMAIL_EXISTS` | "This email is already registered. Please log in instead" |
| 500 | `INTERNAL_ERROR` | "Something went wrong on our end. Please try again or contact support" |
| Network | `NETWORK_ERROR` | "Network connection lost. Check your connection and try again" |

---

## Session Management Hooks & Utilities

### useSessionRefresh Hook

**File:** `src/features/auth/hooks/useSessionRefresh.ts`

```typescript
interface UseSessionRefreshReturn {
  sessionStatus: SessionStatus | null
  isExpiring: boolean
  timeRemaining: number
  refreshSession: () => Promise<void>
  startRefreshTimer: () => void
  stopRefreshTimer: () => void
}

export function useSessionRefresh(): UseSessionRefreshReturn {
  // Polls session-status every 10 seconds
  // Triggers SessionExpirationModal when timeRemaining < 300 seconds
  // Handles refresh-token API calls
  // Handles multi-tab logout via localStorage listener
}
```

**Key Logic:**
```typescript
// Poll session status every 10 seconds
useEffect(() => {
  const pollInterval = setInterval(async () => {
    const status = await checkSessionStatus()
    setSessionStatus(status)

    // If expiring soon and modal not visible, show it
    if (status.timeRemaining < 300 && !modalOpen) {
      setShowExpirationModal(true)
    }

    // If expired, redirect to login
    if (status.timeRemaining <= 0) {
      redirectToLogin('session_expired')
    }
  }, 10000) // 10 second poll

  return () => clearInterval(pollInterval)
}, [])

// Listen for logout in other tabs
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'auth_logout' && e.newValue === 'true') {
      redirectToLogin('logged_out_elsewhere')
    }
  }

  window.addEventListener('storage', handleStorageChange)
  return () => window.removeEventListener('storage', handleStorageChange)
}, [])
```

---

### usePasswordReset Hook

**File:** `src/features/auth/hooks/usePasswordReset.ts`

```typescript
interface UsePasswordResetReturn {
  step: 'request' | 'check-email' | 'reset' | 'success'
  email: string
  isLoading: boolean
  error: string | null
  requestReset: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  setStep: (step: string) => void
}

export function usePasswordReset(): UsePasswordResetReturn {
  // Manages multi-step password reset form state
  // Calls forgot-password and reset-password APIs
  // Validates email and password locally
  // Returns error messages to component
}
```

---

## Password Validation

**File:** `src/shared/lib/validators/passwordValidator.ts`

```typescript
export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
  strength: 'weak' | 'fair' | 'strong' | 'very-strong'
  feedback: string
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  // Min length
  if (password.length < 8) {
    errors.push('At least 8 characters')
  }

  // Uppercase
  if (!/[A-Z]/.test(password)) {
    errors.push('At least one uppercase letter')
  }

  // Lowercase
  if (!/[a-z]/.test(password)) {
    errors.push('At least one lowercase letter')
  }

  // Number
  if (!/\d/.test(password)) {
    errors.push('At least one number')
  }

  // Optional: Special character
  // if (!/[!@#$%^&*]/.test(password)) {
  //   errors.push('At least one special character')
  // }

  const strength = calculateStrength(password)

  return {
    isValid: errors.length === 0,
    errors,
    strength,
    feedback: `Password strength: ${strength}`
  }
}

function calculateStrength(password: string): PasswordValidationResult['strength'] {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[!@#$%^&*]/.test(password)) score++

  if (score >= 4) return 'very-strong'
  if (score >= 3) return 'strong'
  if (score >= 2) return 'fair'
  return 'weak'
}
```

---

## Email Service Abstraction

### Email Service Factory

**File:** `src/shared/lib/email/factory.ts`

```typescript
import { EmailProvider } from './types'

export class EmailProviderFactory {
  static createProvider(): EmailProvider {
    const provider = process.env.EMAIL_PROVIDER || 'mock'

    switch (provider) {
      case 'sendgrid':
        return new SendGridProvider()
      case 'mailgun':
        return new MailgunProvider()
      case 'mock':
      default:
        return new MockEmailProvider()
    }
  }
}
```

**File:** `src/shared/lib/email/providers/MockEmailProvider.ts`

```typescript
export class MockEmailProvider implements EmailProvider {
  // Logs emails to console in development
  // Stores in-memory for testing
  // Never sends actual emails

  private sentEmails: EmailMessage[] = []

  async send(message: EmailMessage): Promise<{ messageId: string }> {
    console.log('[MOCK EMAIL] Sending:', message)
    this.sentEmails.push(message)
    return { messageId: `mock_${Date.now()}` }
  }

  getSentEmails(): EmailMessage[] {
    return this.sentEmails
  }

  clearSentEmails(): void {
    this.sentEmails = []
  }
}
```

**File:** `.env.local` (for development)

```
EMAIL_PROVIDER=mock
# For Wave 2:
# EMAIL_PROVIDER=sendgrid
# SENDGRID_API_KEY=sk_test_...
```

---

## Accessibility Implementation Guide

### ARIA Labels Standard

**All Form Inputs:**
```tsx
<input
  id="field-name"
  type="text"
  aria-label="Descriptive label for screen readers"
  aria-describedby="field-help field-error"
/>
<div id="field-help" className="help-text">Helper text</div>
<div id="field-error" role="alert" aria-live="polite">
  {error && <span>{error}</span>}
</div>
```

**All Buttons:**
```tsx
<button aria-label="Descriptive action label">
  Icon Only Button
</button>

// Or prefer text inside button (no aria-label needed)
<button>Submit Form</button>
```

**All Links:**
```tsx
<a href="/path" aria-label="Full descriptive text for screen reader">
  Link Text
</a>
```

### Keyboard Navigation Standards

**Tab Order:**
- Sequential through logical reading order
- No skipped interactive elements
- Tab order preserved in modals (focus trap)

**Enter/Space Activation:**
```typescript
// Attach to buttons and interactive elements
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    handleClick()
  }
}

<button onKeyDown={handleKeyDown} onClick={handleClick}>
  Click me
</button>
```

**Escape Key Handling:**
```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal()
    }
  }

  window.addEventListener('keydown', handleEscape)
  return () => window.removeEventListener('keydown', handleEscape)
}, [])
```

### Focus Trap Implementation (For Modals)

**File:** `src/shared/hooks/useFocusTrap.ts`

```typescript
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Get all focusable elements
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    // Focus first element when modal opens
    firstElement?.focus()

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift+Tab on first element -> focus last
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab on last element -> focus first
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return containerRef
}
```

### Color Contrast Verification

**Standards:**
- Normal text (≤18pt): 4.5:1 contrast ratio
- Large text (>18pt): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Testing Tools:**
- WebAIM Contrast Checker
- Lighthouse DevTools
- axe DevTools browser extension

**Verification Process:**
1. Check all text colors against backgrounds
2. Check dark mode separately
3. Check focus indicator colors
4. Document ratios in accessibility report

---

## Edge Cases & Error Handling

### Feature 1: Password Recovery - Edge Cases

| Edge Case | Handling | Verification |
|-----------|----------|--------------|
| Email doesn't exist | Return generic success (don't reveal existence) | User sees "If account exists..." message |
| Token expired (>6 hours) | API returns 400 with "TOKEN_EXPIRED" code | User guided to request new reset |
| Token already used | API returns 400 with "INVALID_TOKEN" code | User prevented from reusing token |
| Invalid email format | Client-side validation + API validation | Error: "Invalid email format" |
| User attempts reset while user change password | New reset invalidates old token | Only latest reset is valid |
| Password same as old password | Validate and reject (optional, depends on policy) | Error: "Password must be different" |
| Multiple concurrent resets requested | Each generates new token, old ones invalidated | Only latest token works |
| User closes reset email without completing | Token expires after 6 hours, user requests new one | Graceful retry flow |
| Email service down | API returns 500, user told to try again later | Retry button available |
| Reset link clicked multiple times quickly | Debounce on client, idempotent API response | Second click has no effect |

### Feature 2: Session Management - Edge Cases

| Edge Case | Handling | Verification |
|-----------|----------|--------------|
| Session expires while modal open | Refresh button returns 401, modal closes, redirect to login | User informed and redirected |
| User clicks refresh just before expiry | Both succeed atomically, old token invalidated | Session extends successfully |
| Concurrent refresh requests from two tabs | Only first succeeds, second gets 401 | Handled gracefully (redirect to login) |
| localStorage cleared in another tab | Logout detected immediately via storage event | Current tab logs out |
| User disables localStorage | localStorage calls fail silently, no multi-tab sync | Session management still works (polling) |
| User closes browser tab during modal | Session expires in closed tab (expected) | No error |
| Modal shown 5 minutes before, user goes AFK | Session expires, modal timeout occurs, redirect to login | User experience: clear error message at 0s |
| Refresh succeeds but redirect fails | App detects 401 on next API call, redirects to login | Graceful error handling |
| Network latency prevents token refresh | Show error message, user can click Retry | Clear recovery path |
| Multiple SessionExpirationModals mounted | Only one instance shown (controlled via context) | No duplicate modals |

### Feature 3: Accessibility - Edge Cases

| Edge Case | Handling | Verification |
|-----------|----------|--------------|
| User navigates with keyboard only | Tab order logical, focus visible, all buttons activatable | Keyboard user can complete all flows |
| User uses screen reader (NVDA/VoiceOver) | ARIA labels clear, form errors announced, dynamic content live regions | Screen reader user understands page |
| User has high contrast preference | Colors still meet 4.5:1 contrast in high-contrast mode | Text readable in all modes |
| User disables CSS animations | Loading states still visible, no motion sickness | Animations degraded gracefully |
| User has font size set to very large | Forms still usable, text doesn't overflow | Responsive layout adapts |
| Modal opened with many focusable elements | Focus trap only cycles through modal elements, no focus outside | Tab/Shift+Tab stays in modal |
| User clicks outside modal (focus trap active) | Click outside doesn't close modal, focus stays in modal | Modal behavior is predictable |
| Success/error message appears dynamically | aria-live region announces change to screen reader | User notified of changes |
| Form has both inline label + aria-label | No duplicate announcements (screen reader smart enough) | Clean user experience |
| Color alone indicates error (e.g., red text) | Add icon, text, or aria-label in addition to color | Error conveyed without color |

### Feature 4: Error Messages - Edge Cases

| Edge Case | Handling | Verification |
|-----------|----------|--------------|
| User submits form with empty fields | Client-side validation first, then server validation | Clear inline errors |
| User rapidly clicks submit button multiple times | Button disabled during request, prevents multiple submissions | Only one request sent |
| Server returns error with no message | Show generic "Something went wrong" message | User not left confused |
| Network timeout (no response) | Show "Network error" with Retry button after 30s | Clear recovery path |
| API response is malformed JSON | Catch error, show generic message | App doesn't crash |
| CORS error prevents request | Handled by fetch error handler, user sees generic error | User knows something's wrong |
| Validation message is very long | Truncate or use tooltip | Layout doesn't break |
| Error appears, user fixes input, error persists | Validate on blur and clear error when valid | User gets feedback immediately |
| Multiple errors on one field | Show first/most important error only | Not overwhelming |
| Error message contains HTML/special chars | Escape HTML to prevent injection | Safe rendering |

### Feature 5: Loading States - Edge Cases

| Edge Case | Handling | Verification |
|-----------|----------|--------------|
| Network is very fast (<100ms) | Don't show skeleton (min 200ms delay) | No flashing skeletons |
| Network is very slow (>10s) | Skeleton shows, user can see loading progress | User not left hanging |
| User navigates away during load | Cancel in-flight requests, cleanup observers | No memory leaks |
| Button clicked twice while loading | Button disabled, second click ignored | Prevent duplicate submissions |
| Form inputs disabled during load | User cannot change values mid-submission | Clear intent of disabled state |
| Spinner animation frame rate drops | Animation still smooth at 30fps, not janky | User perceives smooth loading |
| Browser tab goes to background | Animation pauses/slows (browser optimization) | Performance improved, user doesn't notice |
| Multiple async operations in parallel | Each has own loading state, spinners don't compete | Parallel operations clear |
| List loads but individual items still loading | Show skeletons for partial data | User understands partial state |
| User closes modal while list loading | Cancel request, cleanup listeners | No orphaned requests |

---

## Implementation Tasks

### Phase 1: Database & API Foundation

**TASK 1.1:** Add password reset fields to Prisma schema
- Complexity: Small
- Dependencies: None
- Files: `prisma/schema.prisma`
- Acceptance Criteria:
  - ✓ passwordResetToken and passwordResetExpiry added to User model
  - ✓ Indexes added for performance (email, passwordResetToken)
  - ✓ Prisma schema compiles without errors
  - ✓ Migration file generated successfully

**TASK 1.2:** Create Prisma migration
- Complexity: Small
- Dependencies: TASK 1.1
- Files: `prisma/migrations/[timestamp]_add_password_reset_fields/`
- Acceptance Criteria:
  - ✓ Migration file created
  - ✓ `npx prisma migrate dev` succeeds
  - ✓ Database schema updated correctly
  - ✓ Prisma client regenerated

**TASK 1.3:** Create POST /api/auth/forgot-password endpoint
- Complexity: Medium
- Dependencies: TASK 1.2
- Files: `src/app/api/auth/forgot-password/route.ts`
- Acceptance Criteria:
  - ✓ Validates email format
  - ✓ Generates 32-char random token
  - ✓ Sets 6-hour expiry on token
  - ✓ Saves token to DB
  - ✓ Calls email service to send reset email
  - ✓ Returns 200 regardless of user existence (security)
  - ✓ Returns 500 on email service failure
  - ✓ Error handling for all failure modes
  - ✓ Integration tests pass

**TASK 1.4:** Create POST /api/auth/reset-password endpoint
- Complexity: Medium
- Dependencies: TASK 1.2, TASK 1.3
- Files: `src/app/api/auth/reset-password/route.ts`
- Acceptance Criteria:
  - ✓ Validates token format
  - ✓ Verifies token exists and not expired
  - ✓ Validates password requirements (8+ chars, upper, lower, number)
  - ✓ Hashes password with bcrypt
  - ✓ Updates user password
  - ✓ Clears passwordResetToken and passwordResetExpiry
  - ✓ Returns 400 for expired/invalid token with appropriate message
  - ✓ Returns 200 on success with redirect URL
  - ✓ Integration tests pass

**TASK 1.5:** Create POST /api/auth/refresh-token endpoint
- Complexity: Medium
- Dependencies: TASK 1.2
- Files: `src/app/api/auth/refresh-token/route.ts`
- Acceptance Criteria:
  - ✓ Requires valid JWT token in Authorization header
  - ✓ Verifies token signature and expiry
  - ✓ Generates new JWT with 30-minute expiry
  - ✓ Returns new token and expiresIn
  - ✓ Returns 401 for missing/invalid token
  - ✓ Atomicity: old token invalidated after new one issued
  - ✓ Integration tests pass

**TASK 1.6:** Create GET /api/auth/session-status endpoint
- Complexity: Small
- Dependencies: TASK 1.2
- Files: `src/app/api/auth/session-status/route.ts`
- Acceptance Criteria:
  - ✓ Requires valid JWT token
  - ✓ Returns expiresAt and warningAt timestamps (ISO 8601)
  - ✓ Returns status ('active' or 'expiring')
  - ✓ Returns timeRemaining in seconds
  - ✓ Returns 401 for expired session
  - ✓ Unit tests pass

**TASK 1.7:** Create email service abstraction layer
- Complexity: Medium
- Dependencies: None
- Files: `src/shared/lib/email/types.ts`, `src/shared/lib/email/factory.ts`, `src/shared/lib/email/providers/MockEmailProvider.ts`
- Acceptance Criteria:
  - ✓ EmailProvider interface defined
  - ✓ Factory pattern implemented
  - ✓ MockEmailProvider logs to console
  - ✓ MockEmailProvider stores sent emails in memory
  - ✓ .env.local configures EMAIL_PROVIDER
  - ✓ Tests use mock provider
  - ✓ Ready for SendGrid/Mailgun in Wave 2

**TASK 1.8:** Create email template for password reset
- Complexity: Small
- Dependencies: TASK 1.7
- Files: `src/shared/lib/email/templates/passwordReset.html`, `src/shared/lib/email/templates/passwordReset.txt`
- Acceptance Criteria:
  - ✓ HTML template includes reset link with token
  - ✓ Text template for email clients that don't support HTML
  - ✓ Displays 6-hour expiry clearly
  - ✓ Includes user-friendly instructions
  - ✓ Reset link includes token as query param
  - ✓ Template tested with sample data

---

### Phase 2: Authentication Components

**TASK 2.1:** Create PasswordResetForm component
- Complexity: Large
- Dependencies: TASK 1.3, TASK 1.4
- Files: `src/features/auth/components/PasswordResetForm.tsx`
- Acceptance Criteria:
  - ✓ Multi-step form (request → check-email → reset → success)
  - ✓ Email validation (format + existence via API)
  - ✓ Password validation with strength indicator
  - ✓ Token input with auto-paste from URL
  - ✓ Loading states (button disabled, inputs greyed)
  - ✓ Error messages inline with recovery instructions
  - ✓ ARIA labels on all inputs
  - ✓ Keyboard navigation (Tab, Enter, Escape)
  - ✓ Responsive design (mobile/tablet/desktop)
  - ✓ Integration tests pass

**TASK 2.2:** Create usePasswordReset hook
- Complexity: Medium
- Dependencies: TASK 2.1
- Files: `src/features/auth/hooks/usePasswordReset.ts`
- Acceptance Criteria:
  - ✓ Manages multi-step form state
  - ✓ Handles forgot-password API call
  - ✓ Handles reset-password API call
  - ✓ Local email/password validation
  - ✓ Error mapping to user messages
  - ✓ Loading states
  - ✓ Unit tests pass

**TASK 2.3:** Create SessionExpirationModal component
- Complexity: Large
- Dependencies: TASK 1.5, TASK 1.6
- Files: `src/features/auth/components/SessionExpirationModal.tsx`
- Acceptance Criteria:
  - ✓ Countdown timer (minutes:seconds format)
  - ✓ "Stay Logged In" button calls refresh-token
  - ✓ "Log Out Now" button clears session
  - ✓ Non-dismissible (click outside doesn't close)
  - ✓ Focus trap (Tab cycles within modal only)
  - ✓ Escape key closes and logs out
  - ✓ ARIA labels (role="alertdialog")
  - ✓ aria-live countdown announcements
  - ✓ Integration tests pass

**TASK 2.4:** Create useSessionRefresh hook
- Complexity: Large
- Dependencies: TASK 1.5, TASK 1.6, TASK 2.3
- Files: `src/features/auth/hooks/useSessionRefresh.ts`
- Acceptance Criteria:
  - ✓ Polls session-status every 10 seconds
  - ✓ Shows SessionExpirationModal when timeRemaining < 300 seconds
  - ✓ Calls refresh-token when user clicks "Stay Logged In"
  - ✓ Redirects to login when session expires
  - ✓ Handles refresh failures gracefully
  - ✓ Listens for logout in other tabs (localStorage)
  - ✓ Logs out current tab when other tab logs out
  - ✓ Unit tests pass

**TASK 2.5:** Create useFocusTrap hook (for modal accessibility)
- Complexity: Small
- Dependencies: None
- Files: `src/shared/hooks/useFocusTrap.ts`
- Acceptance Criteria:
  - ✓ Traps focus within modal
  - ✓ Focus first element on modal open
  - ✓ Tab cycles through focusable elements
  - ✓ Shift+Tab reverses cycle
  - ✓ Works with dynamically added/removed elements
  - ✓ Unit tests pass

**TASK 2.6:** Integrate PasswordResetForm into login page
- Complexity: Small
- Dependencies: TASK 2.1
- Files: `src/app/(auth)/login/page.tsx`
- Acceptance Criteria:
  - ✓ "Forgot Password?" link shows/hides form
  - ✓ Form appears in modal or inline (design decision)
  - ✓ User can switch between login and password reset
  - ✓ Responsive layout maintained
  - ✓ Tests pass

**TASK 2.7:** Integrate SessionExpirationModal into app layout
- Complexity: Small
- Dependencies: TASK 2.3, TASK 2.4
- Files: `src/app/layout.tsx` or `src/shared/components/SessionManager.tsx`
- Acceptance Criteria:
  - ✓ SessionExpirationModal mounted globally
  - ✓ useSessionRefresh hook instantiated
  - ✓ Modal appears for all authenticated users
  - ✓ Does not appear for unauthenticated users
  - ✓ Tests pass

---

### Phase 3: Accessibility & UX Components

**TASK 3.1:** Create SkeletonCard component
- Complexity: Small
- Dependencies: None
- Files: `src/shared/components/loaders/SkeletonCard.tsx`
- Acceptance Criteria:
  - ✓ Renders placeholder card with shimmer animation
  - ✓ Configurable number of text rows
  - ✓ Optional image placeholder
  - ✓ Responsive width
  - ✓ No accessibility issues
  - ✓ Tests pass

**TASK 3.2:** Create SkeletonText component
- Complexity: Small
- Dependencies: None
- Files: `src/shared/components/loaders/SkeletonText.tsx`
- Acceptance Criteria:
  - ✓ Renders placeholder text lines
  - ✓ Configurable number of lines
  - ✓ Shimmer animation
  - ✓ Responsive width
  - ✓ Tests pass

**TASK 3.3:** Create SkeletonList component
- Complexity: Small
- Dependencies: TASK 3.1, TASK 3.2
- Files: `src/shared/components/loaders/SkeletonList.tsx`
- Acceptance Criteria:
  - ✓ Renders multiple skeleton items
  - ✓ Configurable count and item type
  - ✓ Responsive layout
  - ✓ Tests pass

**TASK 3.4:** Create LoadingSpinner component
- Complexity: Small
- Dependencies: None
- Files: `src/shared/components/loaders/LoadingSpinner.tsx`
- Acceptance Criteria:
  - ✓ CSS animation (no image assets)
  - ✓ Multiple sizes (sm, md, lg)
  - ✓ Overlay variant (centered with semi-transparent background)
  - ✓ aria-label for accessibility
  - ✓ role="status" for screen reader
  - ✓ Tests pass

**TASK 3.5:** Create ProgressBar component
- Complexity: Small
- Dependencies: None
- Files: `src/shared/components/feedback/ProgressBar.tsx`
- Acceptance Criteria:
  - ✓ Horizontal progress bar (0-100%)
  - ✓ Optional label ("Step 2 of 5")
  - ✓ Optional percentage display
  - ✓ Animated transition
  - ✓ Accessible (aria-valuenow, aria-valuemin, aria-valuemax)
  - ✓ Tests pass

**TASK 3.6:** Enhance FormError component
- Complexity: Small
- Dependencies: None
- Files: `src/shared/components/FormError.tsx`
- Acceptance Criteria:
  - ✓ Add category prop (validation, auth, conflict, server, network)
  - ✓ Different icon per category
  - ✓ Retry button for network errors
  - ✓ role="alert" for screen reader
  - ✓ aria-live="polite" for dynamic errors
  - ✓ Tests pass

**TASK 3.7:** Enhance Button component with loading state
- Complexity: Small
- Dependencies: TASK 3.4
- Files: `src/shared/components/Button.tsx`
- Acceptance Criteria:
  - ✓ Add loading prop
  - ✓ Add loadingText prop (optional)
  - ✓ Show spinner when loading={true}
  - ✓ Disable button when loading={true}
  - ✓ aria-busy="true" when loading
  - ✓ Tests pass

**TASK 3.8:** Add ARIA labels to all form inputs across app
- Complexity: Large
- Dependencies: None
- Files: All form component files
- Acceptance Criteria:
  - ✓ Every input has aria-label or associated <label>
  - ✓ Error messages have aria-describedby
  - ✓ Help text has aria-describedby
  - ✓ Buttons have aria-label if no text
  - ✓ Links have clear text (no "Click here")
  - ✓ Axe-core audit passes
  - ✓ Tests pass

**TASK 3.9:** Verify keyboard navigation across all pages
- Complexity: Medium
- Dependencies: All auth/form components
- Files: Integration tests
- Acceptance Criteria:
  - ✓ Tab order is logical (top to bottom, left to right)
  - ✓ All interactive elements reachable via Tab
  - ✓ Enter activates buttons
  - ✓ Space activates buttons/checkboxes
  - ✓ Escape closes modals
  - ✓ Focus visible at all times
  - ✓ Manual test verification documented
  - ✓ Tests pass

**TASK 3.10:** Implement focus trap for modals
- Complexity: Small
- Dependencies: TASK 2.5
- Files: `src/shared/components/Modal.tsx` (if it exists) or update SessionExpirationModal
- Acceptance Criteria:
  - ✓ Tab cycles within modal only
  - ✓ Focus first element on open
  - ✓ Focus returned to trigger element on close
  - ✓ Escape key closes modal
  - ✓ Click outside doesn't close modal
  - ✓ Tests pass

---

### Phase 4: Error Handling & Messages

**TASK 4.1:** Create errorMapping utility
- Complexity: Small
- Dependencies: None
- Files: `src/shared/lib/errorMapping.ts`
- Acceptance Criteria:
  - ✓ Maps all API error codes to user messages
  - ✓ User messages are friendly (no jargon)
  - ✓ Field-level error mapping
  - ✓ isRetryableError() function
  - ✓ Unit tests pass

**TASK 4.2:** Create Toast notification component
- Complexity: Medium
- Dependencies: None
- Files: `src/shared/components/feedback/Toast.tsx`, `src/shared/hooks/useToast.ts`, `src/shared/context/ToastContext.tsx`
- Acceptance Criteria:
  - ✓ Toast component renders message
  - ✓ Auto-dismiss after duration (default 4000ms)
  - ✓ Type-based styling (success, error, info, warning)
  - ✓ role="status" or role="alert" (based on type)
  - ✓ useToast hook for triggering toasts
  - ✓ Multiple toasts can be shown
  - ✓ Tests pass

**TASK 4.3:** Add error mapping to all API calls
- Complexity: Large
- Dependencies: TASK 4.1, TASK 4.2, TASK 1.3-1.6
- Files: Auth API route handlers, auth hooks
- Acceptance Criteria:
  - ✓ All API routes return error codes
  - ✓ All API calls use errorMapping
  - ✓ All forms show mapped error messages
  - ✓ Network errors show "Retry" button
  - ✓ User-friendly messages everywhere
  - ✓ Integration tests pass

**TASK 4.4:** Add inline form error validation
- Complexity: Medium
- Dependencies: TASK 4.1
- Files: PasswordResetForm, LoginForm, any other forms
- Acceptance Criteria:
  - ✓ Errors show on blur (not on change)
  - ✓ Errors clear when input becomes valid
  - ✓ Clear error messages for each field
  - ✓ aria-describedby points to error message
  - ✓ Integration tests pass

**TASK 4.5:** Wire loading states to all async operations
- Complexity: Large
- Dependencies: TASK 3.4, TASK 3.7
- Files: All API-calling components
- Acceptance Criteria:
  - ✓ All buttons show spinner during API call
  - ✓ All form inputs disabled during submission
  - ✓ All lists show skeletons while loading
  - ✓ Min 200ms before showing skeleton (prevent flash)
  - ✓ Loading states for all async operations
  - ✓ Integration tests pass

---

### Phase 5: Testing & Verification

**TASK 5.1:** Write unit tests for password validation
- Complexity: Small
- Dependencies: TASK 1.4
- Files: `src/shared/lib/validators/__tests__/passwordValidator.test.ts`
- Acceptance Criteria:
  - ✓ Test min length (8 chars)
  - ✓ Test uppercase requirement
  - ✓ Test lowercase requirement
  - ✓ Test number requirement
  - ✓ Test strength calculation
  - ✓ >80% coverage
  - ✓ All tests pass

**TASK 5.2:** Write unit tests for error mapping
- Complexity: Small
- Dependencies: TASK 4.1
- Files: `src/shared/lib/__tests__/errorMapping.test.ts`
- Acceptance Criteria:
  - ✓ Test all error codes
  - ✓ Test isRetryableError()
  - ✓ >80% coverage
  - ✓ All tests pass

**TASK 5.3:** Write integration tests for password recovery flow
- Complexity: Large
- Dependencies: TASK 1.3, TASK 1.4, TASK 2.1
- Files: `src/features/auth/__tests__/passwordReset.integration.test.ts`
- Acceptance Criteria:
  - ✓ Test request reset (success)
  - ✓ Test request reset (invalid email)
  - ✓ Test request reset (user not found)
  - ✓ Test reset password (success)
  - ✓ Test reset password (expired token)
  - ✓ Test reset password (invalid token)
  - ✓ Test reset password (weak password)
  - ✓ All tests pass

**TASK 5.4:** Write integration tests for session management flow
- Complexity: Large
- Dependencies: TASK 1.5, TASK 1.6, TASK 2.3, TASK 2.4
- Files: `src/features/auth/__tests__/sessionManagement.integration.test.ts`
- Acceptance Criteria:
  - ✓ Test session-status endpoint
  - ✓ Test refresh-token endpoint
  - ✓ Test modal appears at right time
  - ✓ Test refresh extends session
  - ✓ Test logout in other tab
  - ✓ Test expired session redirect
  - ✓ All tests pass

**TASK 5.5:** Write component tests for PasswordResetForm
- Complexity: Medium
- Dependencies: TASK 2.1
- Files: `src/features/auth/components/__tests__/PasswordResetForm.test.tsx`
- Acceptance Criteria:
  - ✓ Test form step transitions
  - ✓ Test email validation
  - ✓ Test password validation
  - ✓ Test API calls
  - ✓ Test error display
  - ✓ Test loading states
  - ✓ >80% coverage
  - ✓ All tests pass

**TASK 5.6:** Write component tests for SessionExpirationModal
- Complexity: Medium
- Dependencies: TASK 2.3
- Files: `src/features/auth/components/__tests__/SessionExpirationModal.test.tsx`
- Acceptance Criteria:
  - ✓ Test countdown timer
  - ✓ Test "Stay Logged In" button
  - ✓ Test "Log Out" button
  - ✓ Test modal focus trap
  - ✓ Test Escape key behavior
  - ✓ >80% coverage
  - ✓ All tests pass

**TASK 5.7:** Write component tests for loading components
- Complexity: Small
- Dependencies: TASK 3.1-3.5
- Files: `src/shared/components/loaders/__tests__/*.test.tsx`
- Acceptance Criteria:
  - ✓ Test SkeletonCard rendering
  - ✓ Test SkeletonText rendering
  - ✓ Test SkeletonList rendering
  - ✓ Test LoadingSpinner rendering
  - ✓ Test ProgressBar rendering
  - ✓ >80% coverage
  - ✓ All tests pass

**TASK 5.8:** Run accessibility audit with axe-core
- Complexity: Medium
- Dependencies: All components
- Files: `tests/a11y/a11y.test.ts`
- Acceptance Criteria:
  - ✓ No violations (critical)
  - ✓ No violations (serious)
  - ✓ No violations (moderate)
  - ✓ Document all minors
  - ✓ WCAG 2.1 AA passes
  - ✓ Audit report generated
  - ✓ All tests pass

**TASK 5.9:** Manual keyboard navigation testing
- Complexity: Medium
- Dependencies: All form/auth components
- Acceptance Criteria:
  - ✓ Test Tab order on all pages
  - ✓ Test Enter/Space on buttons
  - ✓ Test Escape on modals
  - ✓ Test focus visible always
  - ✓ Document test cases
  - ✓ Verification report signed off

**TASK 5.10:** Manual screen reader testing
- Complexity: Medium
- Dependencies: All components
- Acceptance Criteria:
  - ✓ Test with VoiceOver (macOS)
  - ✓ Test with NVDA (Windows)
  - ✓ Verify form labels announced
  - ✓ Verify errors announced
  - ✓ Verify buttons announced
  - ✓ Verify links announced
  - ✓ Document test cases
  - ✓ Verification report signed off

**TASK 5.11:** Responsive design verification
- Complexity: Medium
- Dependencies: All components
- Files: `tests/responsive/responsive.test.tsx`
- Acceptance Criteria:
  - ✓ Test mobile (375px width)
  - ✓ Test tablet (768px width)
  - ✓ Test desktop (1440px width)
  - ✓ No horizontal scroll on mobile
  - ✓ Touch targets ≥48x48px
  - ✓ Forms usable on all sizes
  - ✓ Screenshots captured
  - ✓ All tests pass

**TASK 5.12:** Lighthouse audit
- Complexity: Medium
- Dependencies: All features
- Acceptance Criteria:
  - ✓ Accessibility score ≥90
  - ✓ Performance score ≥85
  - ✓ Best Practices score ≥90
  - ✓ SEO score ≥90
  - ✓ Audit report generated
  - ✓ Issues documented

**TASK 5.13:** Color contrast verification
- Complexity: Medium
- Dependencies: All components
- Acceptance Criteria:
  - ✓ All text ≥4.5:1 contrast
  - ✓ Large text ≥3:1 contrast
  - ✓ UI components ≥3:1 contrast
  - ✓ Dark mode tested separately
  - ✓ WebAIM checker used
  - ✓ Ratios documented

---

## Security & Compliance

### Authentication & Authorization

**Password Reset Token Security:**
- ✓ Token: 32-character random hex string (cryptographically secure)
- ✓ Expiry: 6 hours from generation
- ✓ Single-use: Token invalidated after successful reset
- ✓ Storage: Hashed in database (not plaintext)
- ✓ Transmission: Via HTTPS only, included in URL as query param
- ✓ Email delivery: No sensitive data in email subject line

**Session Token Security:**
- ✓ JWT with HS256 signature
- ✓ Signed with strong secret key (min 32 chars)
- ✓ Expiry: 30 minutes
- ✓ Refresh mechanism to extend session
- ✓ Stored in httpOnly cookie (prevent XSS theft)
- ✓ CSRF token validation on state-changing operations

**Password Hashing:**
- ✓ Algorithm: bcrypt
- ✓ Cost factor: 12 (minimum)
- ✓ Salt: Automatic (bcrypt generates)

### Data Protection

**User Data:**
- ✓ Email addresses hashed for storage
- ✓ Passwords hashed with bcrypt
- ✓ No plaintext passwords in logs
- ✓ No sensitive data in error messages

**Reset Tokens:**
- ✓ Stored hashed (not plaintext)
- ✓ Never logged or exposed
- ✓ Cleared from DB after use

**Session Data:**
- ✓ No sensitive user data in JWT
- ✓ Only user ID and timestamp in token
- ✓ JWT signature prevents tampering

### Privacy & Compliance

**GDPR Considerations:**
- ✓ User consent for email communication (assumed via signup)
- ✓ Right to be forgotten: Reset tokens deleted after expiry
- ✓ Data minimization: Only essential fields stored

**Error Messages:**
- ✓ Don't reveal if email exists (password reset)
- ✓ Don't expose internal errors to users
- ✓ Don't include sensitive data in error messages

### Audit & Logging

**What to Log:**
- ✓ Failed password reset attempts (per IP, per email)
- ✓ Successful password resets (timestamp, email)
- ✓ Session timeouts (timestamp, user ID)
- ✓ Session refresh requests (timestamp, user ID)
- ✓ API errors (error code, endpoint, timestamp)

**What NOT to Log:**
- ✗ Passwords (plaintext or hashed)
- ✗ Reset tokens
- ✗ JWT tokens
- ✗ User email addresses (use user ID instead)

**Retention:**
- ✓ Logs retained for 90 days
- ✓ Sensitive logs (failed attempts) retained for 180 days
- ✓ Regular log cleanup

---

## Performance & Scalability

### Database Optimization

**Indexes:**
```sql
-- User table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);

-- Why: Fast lookups for login, password reset verification
```

**Query Optimization:**
- ✓ Select only required fields (not `SELECT *`)
- ✓ Use pagination for lists (offset, limit)
- ✓ Cache session status (10-second TTL)
- ✓ Batch operations when possible

### Caching Strategy

**Client-Side Caching:**
- ✓ Session status cached for 10 seconds (reduces polling)
- ✓ localStorage for user preferences
- ✓ In-memory cache for validation rules

**Server-Side Caching:**
- ✓ Cache session status (10-second TTL) [Future: Redis]
- ✓ Cache user profile (60-second TTL) [Future: Redis]
- ✓ No caching for password reset tokens (must be fresh)

### Rate Limiting

**Password Reset Endpoint:**
- ✓ Limit 3 requests per hour per IP
- ✓ Limit 5 requests per hour per email
- ✓ Exponential backoff on repeated failures

**Refresh Token Endpoint:**
- ✓ Limit 10 requests per minute per user
- ✓ Prevent refresh token refresh attacks

**Login Endpoint:**
- ✓ Limit 5 failed attempts per IP per hour
- ✓ After 5 failures, add 5-minute lockout
- ✓ Clear on successful login

**Implementation:** [Tech Debt for Wave 2: Use Redis for distributed rate limiting]

### Load Testing Targets

**Expected Load (MVP):**
- ✓ 100 concurrent users
- ✓ Password reset: 10 requests/second
- ✓ Session refresh: 50 requests/second
- ✓ Avg response time: <500ms

**Scalability Considerations:**
- ✓ Stateless API (horizontal scaling)
- ✓ Database connection pooling
- ✓ CDN for static assets
- ✓ Email service queue (async)

---

## Technical Debt & Future Work

### Wave 2: Email Service Integration
**Current State:** MockEmailProvider logs to console
**Wave 2 Work:**
- Implement SendGridProvider
- Implement MailgunProvider
- Add email queue/retry logic
- Add email delivery tracking
- Multi-language email templates

**Estimated Effort:** 2 days

---

### Wave 2: Internationalization (i18n)
**Current State:** All error messages hardcoded in English
**Wave 2 Work:**
- Add i18n framework (next-intl, react-i18next)
- Extract all user-facing strings to translation files
- Translate to Spanish, French, German (at minimum)
- Add language selector to UI
- Test with RTL languages (Arabic, Hebrew)

**Estimated Effort:** 3 days

---

### Wave 2: Redis for Distributed Rate Limiting
**Current State:** No rate limiting (or in-memory only)
**Wave 2 Work:**
- Add Redis client
- Implement distributed rate limiter
- Track attempts by IP, email, user ID
- Exponential backoff on repeated failures
- Real-time rate limit monitoring dashboard

**Estimated Effort:** 2 days

---

### Wave 2: Advanced Session Security
**Current State:** Basic JWT + localStorage
**Wave 2 Work:**
- Implement refresh token rotation
- Add device fingerprinting
- Add geolocation anomaly detection
- Add suspicious activity alerts
- Implement session invalidation on password change

**Estimated Effort:** 3 days

---

### Wave 2: Accessibility Automation
**Current State:** Manual axe-core testing
**Wave 2 Work:**
- Integrate axe-core into CI/CD pipeline
- Add visual regression testing (Percy, BackstopJS)
- Automated WCAG compliance reporting
- Automated keyboard navigation testing
- Automated screen reader testing (JAWS, NVDA)

**Estimated Effort:** 2 days

---

### Wave 2: IndexedDB for Session Sync
**Current State:** localStorage only (512KB limit)
**Wave 2 Work:**
- Implement IndexedDB as fallback for large payloads
- Improve multi-tab sync reliability
- Handle IndexedDB quota exceeded
- Fallback to sessionStorage

**Estimated Effort:** 1 day

---

### Wave 2: Email Service Abstraction Providers
**Stub files to complete:**
- `src/shared/lib/email/providers/SendGridProvider.ts` (0 lines, ready for Wave 2)
- `src/shared/lib/email/providers/MailgunProvider.ts` (0 lines, ready for Wave 2)
- `src/shared/lib/email/providers/ResendProvider.ts` (0 lines, optional)

---

## Verification Steps

### Local Development Verification

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name add_password_reset_fields

# Run all tests
npm run test

# Run accessibility audit
npm run test:a11y

# Run Lighthouse locally
npm run lighthouse

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

### Manual Testing Checklist

**Password Recovery:**
- [ ] Click "Forgot Password" link on login page
- [ ] Enter valid email, submit, see confirmation message
- [ ] Check mock emails (console logs)
- [ ] Copy reset link from mock email
- [ ] Click link in new tab, enter new password
- [ ] Login with new password
- [ ] Verify old password no longer works
- [ ] Test with expired token (wait 6+ hours simulated)
- [ ] Test with invalid token
- [ ] Test with already-reset token

**Session Management:**
- [ ] Login successfully
- [ ] Leave idle for 25 minutes, modal should appear
- [ ] Click "Stay Logged In", verify session extends
- [ ] Verify modal countdown accurate to system time
- [ ] Let session expire, verify 401 redirect to login
- [ ] Open app in two tabs, logout in one tab
- [ ] Verify other tab logs out immediately
- [ ] Test refresh-token API with curl/Postman

**Accessibility:**
- [ ] Navigate app with keyboard only (no mouse)
- [ ] Verify focus always visible
- [ ] Tab through all form fields in logical order
- [ ] Use screen reader (VoiceOver on Mac, NVDA on Windows)
- [ ] Verify form labels announced
- [ ] Verify errors announced
- [ ] Test color contrast with WebAIM checker
- [ ] Run Lighthouse audit (target 90+)

**Loading States:**
- [ ] Throttle network to 3G slow (DevTools)
- [ ] Submit forms, verify loading spinner appears
- [ ] Verify buttons disabled during loading
- [ ] Verify no double-submit on rapid clicks
- [ ] Verify skeleton loaders appear on content loads
- [ ] Verify min 200ms skeleton (no flashing on fast network)

**Error Messages:**
- [ ] Submit form with empty fields
- [ ] Verify inline errors appear on blur
- [ ] Fix input, verify error clears
- [ ] Test with invalid password
- [ ] Verify specific error message
- [ ] Disconnect network, test network error with Retry button
- [ ] Verify all error messages are user-friendly (no jargon)

**Responsive Design:**
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1440px width)
- [ ] Verify no horizontal scroll on mobile
- [ ] Verify touch targets are ≥48x48px
- [ ] Verify forms work on all screen sizes

---

## Component Integration Map

```
App Layout
├── SessionManager (useSessionRefresh, SessionExpirationModal)
│   └── useLocalStorageSync (multi-tab logout)
│
├── (auth) Routes
│   ├── login/page.tsx
│   │   ├── LoginForm
│   │   │   ├── FormError (updated)
│   │   │   └── Button (updated with loading)
│   │   │
│   │   └── PasswordResetForm (new)
│   │       ├── EmailRequestStep
│   │       ├── CheckEmailStep
│   │       ├── ResetPasswordStep
│   │       │   ├── SkeletonText (for password strength)
│   │       │   └── ProgressBar (for password strength)
│   │       └── SuccessStep
│   │
│   └── Hooks
│       ├── usePasswordReset (new)
│       ├── useSessionRefresh (new)
│       └── useFocusTrap (new)
│
├── Shared Components
│   ├── loaders/
│   │   ├── SkeletonCard (new)
│   │   ├── SkeletonText (new)
│   │   ├── SkeletonList (new)
│   │   └── LoadingSpinner (new)
│   │
│   ├── feedback/
│   │   ├── Toast (new)
│   │   └── ProgressBar (new)
│   │
│   └── FormError (updated)
│   └── Button (updated)
│   └── Modal (updated)
│
├── SessionExpirationModal (new)
│   ├── Countdown timer
│   └── Focus trap
│
└── API Routes
    ├── /api/auth/forgot-password (new)
    ├── /api/auth/reset-password (new)
    ├── /api/auth/refresh-token (new)
    └── /api/auth/session-status (new)
```

---

## File Checklist

### Files to Create
- [ ] `src/app/api/auth/forgot-password/route.ts`
- [ ] `src/app/api/auth/reset-password/route.ts`
- [ ] `src/app/api/auth/refresh-token/route.ts`
- [ ] `src/app/api/auth/session-status/route.ts`
- [ ] `src/features/auth/components/PasswordResetForm.tsx`
- [ ] `src/features/auth/components/SessionExpirationModal.tsx`
- [ ] `src/features/auth/hooks/useSessionRefresh.ts`
- [ ] `src/features/auth/hooks/usePasswordReset.ts`
- [ ] `src/features/auth/lib/sessionManager.ts`
- [ ] `src/features/auth/lib/tokenRefresh.ts`
- [ ] `src/features/auth/lib/validatePassword.ts`
- [ ] `src/shared/components/loaders/SkeletonCard.tsx`
- [ ] `src/shared/components/loaders/SkeletonText.tsx`
- [ ] `src/shared/components/loaders/SkeletonList.tsx`
- [ ] `src/shared/components/loaders/LoadingSpinner.tsx`
- [ ] `src/shared/components/feedback/Toast.tsx`
- [ ] `src/shared/components/feedback/ProgressBar.tsx`
- [ ] `src/shared/hooks/useToast.ts`
- [ ] `src/shared/context/ToastContext.tsx`
- [ ] `src/shared/hooks/useFocusTrap.ts`
- [ ] `src/shared/lib/errorMapping.ts`
- [ ] `src/shared/lib/email/types.ts`
- [ ] `src/shared/lib/email/factory.ts`
- [ ] `src/shared/lib/email/providers/MockEmailProvider.ts`
- [ ] `src/shared/lib/email/providers/SendGridProvider.ts`
- [ ] `src/shared/lib/email/providers/MailgunProvider.ts`
- [ ] `src/shared/lib/email/templates/passwordReset.html`
- [ ] `src/shared/lib/email/templates/passwordReset.txt`
- [ ] `src/shared/lib/validators/passwordValidator.ts`
- [ ] `prisma/migrations/[timestamp]_add_password_reset_fields/migration.sql`

### Files to Update
- [ ] `prisma/schema.prisma` (add password reset fields)
- [ ] `src/app/(auth)/login/page.tsx` (add forgot password link)
- [ ] `src/features/auth/components/LoginForm.tsx` (integrate PasswordResetForm)
- [ ] `src/shared/components/FormError.tsx` (add category prop)
- [ ] `src/shared/components/Button.tsx` (add loading state)
- [ ] `src/shared/components/Modal.tsx` (add focus trap, Escape handling)
- [ ] `src/app/layout.tsx` (add SessionManager)
- [ ] `.env.local` (add EMAIL_PROVIDER=mock)

### Test Files to Create
- [ ] `src/shared/lib/validators/__tests__/passwordValidator.test.ts`
- [ ] `src/shared/lib/__tests__/errorMapping.test.ts`
- [ ] `src/features/auth/__tests__/passwordReset.integration.test.ts`
- [ ] `src/features/auth/__tests__/sessionManagement.integration.test.ts`
- [ ] `src/features/auth/components/__tests__/PasswordResetForm.test.tsx`
- [ ] `src/features/auth/components/__tests__/SessionExpirationModal.test.tsx`
- [ ] `src/shared/components/loaders/__tests__/SkeletonCard.test.tsx`
- [ ] `src/shared/components/loaders/__tests__/SkeletonText.test.tsx`
- [ ] `src/shared/components/loaders/__tests__/SkeletonList.test.tsx`
- [ ] `src/shared/components/loaders/__tests__/LoadingSpinner.test.tsx`
- [ ] `src/shared/components/feedback/__tests__/ProgressBar.test.tsx`
- [ ] `src/shared/components/feedback/__tests__/Toast.test.tsx`
- [ ] `tests/a11y/a11y.test.ts`
- [ ] `tests/responsive/responsive.test.tsx`

---

## Success Criteria - Final Verification

**All Features Implemented:**
- [ ] Password recovery: Request → Check email → Reset → Success
- [ ] Session management: Status polling → Warning modal → Extension → Expiry handling
- [ ] Accessibility: ARIA labels, keyboard nav, focus trap, screen reader support
- [ ] Error messages: User-friendly, actionable, categorized, with retry options
- [ ] Loading states: Spinners, skeletons, progress bars, button states

**Build & Compilation:**
- [ ] `npm run build` succeeds with 0 errors
- [ ] `npx tsc --noEmit` succeeds (0 TypeScript errors)
- [ ] No lint errors: `npm run lint`
- [ ] Prisma schema valid: `npx prisma validate`

**Testing:**
- [ ] All unit tests pass: `npm run test`
- [ ] All integration tests pass
- [ ] All component tests pass
- [ ] Code coverage ≥80%: `npm run test:coverage`

**Accessibility:**
- [ ] `npm run test:a11y` passes (0 critical, 0 serious violations)
- [ ] Keyboard navigation manual test verified
- [ ] Screen reader manual test verified (VoiceOver/NVDA)
- [ ] Color contrast verified (4.5:1 for normal text)
- [ ] Lighthouse accessibility score ≥90

**Responsive Design:**
- [ ] Mobile (375px): No horizontal scroll, all interactive elements working
- [ ] Tablet (768px): Layout adapted correctly
- [ ] Desktop (1440px): Full layout working as intended
- [ ] Touch targets ≥48x48px verified

**Security & Data:**
- [ ] No passwords logged
- [ ] No reset tokens logged
- [ ] No JWT tokens exposed in error messages
- [ ] Email addresses not revealed in error messages
- [ ] Password hashing verified (bcrypt)
- [ ] Token expiry verified (6 hours for reset, 30 mins for session)

**User Experience:**
- [ ] All error messages user-friendly (no technical jargon)
- [ ] All loading states present (no blank screens)
- [ ] All async operations have feedback (toast, spinner, progress)
- [ ] Form errors clear on valid input
- [ ] Modal countdown accurate
- [ ] Multi-tab logout works correctly

**Documentation:**
- [ ] All API endpoints documented with examples
- [ ] All components documented with props
- [ ] All edge cases documented with solutions
- [ ] All technical debt documented for Wave 2
- [ ] README.md updated with new features

---

## Deployment Considerations

### Prerequisites
- PostgreSQL database with Prisma configured
- Node.js 18+
- Environment variables configured (.env.local)

### Pre-Deployment Checklist
- [ ] Database migrations applied
- [ ] All tests passing in CI/CD
- [ ] Lighthouse audit run (target 90+)
- [ ] Accessibility audit pass
- [ ] Security audit pass
- [ ] Performance budget defined

### Rollback Plan
- If password reset failing: Disable feature flag, notify users
- If session timeout issues: Extend timeout to 60 minutes, investigate
- If email service down: Use mock provider, notify via UI
- If database issues: Rollback migration, restore from backup

### Monitoring Post-Deployment
- [ ] Monitor 401 error rates (session timeouts)
- [ ] Monitor password reset email delivery
- [ ] Monitor API response times (target <500ms)
- [ ] Monitor error rates by endpoint
- [ ] Monitor user-reported accessibility issues
- [ ] Review logs for security anomalies (failed login attempts)

---

## Appendix: Example Code Snippets

### Example: Using PasswordResetForm Component

```tsx
// src/app/(auth)/login/page.tsx
import { useState } from 'react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { PasswordResetForm } from '@/features/auth/components/PasswordResetForm'

export default function LoginPage() {
  const [showPasswordReset, setShowPasswordReset] = useState(false)

  return (
    <div className="login-container">
      {showPasswordReset ? (
        <>
          <PasswordResetForm
            onSuccess={() => setShowPasswordReset(false)}
            onError={(error) => console.error(error)}
          />
          <button
            onClick={() => setShowPasswordReset(false)}
            className="back-link"
          >
            Back to Login
          </button>
        </>
      ) : (
        <>
          <LoginForm />
          <button
            onClick={() => setShowPasswordReset(true)}
            className="forgot-password-link"
          >
            Forgot Password?
          </button>
        </>
      )}
    </div>
  )
}
```

### Example: Using useSessionRefresh Hook

```tsx
// src/app/layout.tsx
import { useSessionRefresh } from '@/features/auth/hooks/useSessionRefresh'
import { SessionExpirationModal } from '@/features/auth/components/SessionExpirationModal'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    sessionStatus,
    isExpiring,
    refreshSession,
    showExpirationModal,
    setShowExpirationModal,
  } = useSessionRefresh()

  return (
    <html>
      <body>
        {children}

        {showExpirationModal && sessionStatus && (
          <SessionExpirationModal
            isOpen={true}
            expiresAt={new Date(sessionStatus.expiresAt)}
            onStayLoggedIn={refreshSession}
            onLogout={() => {
              // Clear auth, redirect to login
            }}
          />
        )}
      </body>
    </html>
  )
}
```

### Example: Error Mapping in API Call

```tsx
// src/features/auth/hooks/usePasswordReset.ts
import { mapApiErrorToUserMessage } from '@/shared/lib/errorMapping'

export function usePasswordReset() {
  const handleSubmit = async (email: string) => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        const userMessage = mapApiErrorToUserMessage({
          code: data.code,
          message: data.message,
          statusCode: response.status,
        })
        setError(userMessage)
        return
      }

      setStep('check-email')
    } catch (err) {
      const userMessage = mapApiErrorToUserMessage({
        code: 'NETWORK_ERROR',
        message: 'Network connection failed',
        statusCode: 0,
      })
      setError(userMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return { handleSubmit, error, isLoading }
}
```

### Example: Toast Notification Usage

```tsx
// src/features/auth/components/PasswordResetForm.tsx
import { useToast } from '@/shared/hooks/useToast'

export function PasswordResetForm() {
  const { showToast } = useToast()

  const handleSuccess = async () => {
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })

      if (response.ok) {
        showToast({
          message: 'Password reset successful! Redirecting to login...',
          type: 'success',
          duration: 3000,
        })
        // Redirect after toast
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      }
    } catch (error) {
      showToast({
        message: 'Failed to reset password. Please try again.',
        type: 'error',
        duration: 5000,
      })
    }
  }

  return (
    <form onSubmit={handleSuccess}>
      {/* Form fields */}
    </form>
  )
}
```

---

## Questions for Clarification (If Needed)

1. **Email Service:** Should we implement actual SendGrid/Mailgun now, or mock only for Wave 1?
   - **Answer (as specified):** Mock for Wave 1, real providers in Wave 2

2. **Session Length:** Should the default session be 30 minutes or different?
   - **Answer (as specified):** 30 minutes, warning at 25 minutes

3. **Token Expiry:** Should password reset tokens expire at 6 hours or different?
   - **Answer (as specified):** 6 hours from generation

4. **Multi-Tab Logout:** Should this use localStorage or localStorage + BroadcastChannel API?
   - **Answer (as specified):** localStorage (BroadcastChannel is modern fallback for Wave 2)

5. **Loading State Min Delay:** Is 200ms the right threshold for skeleton loading?
   - **Answer (as specified):** Yes, 200-300ms prevents flashing on fast networks

6. **Password Requirements:** Are uppercase, lowercase, number sufficient, or add special characters?
   - **Answer (as specified):** Uppercase, lowercase, number (min 8 chars). Special chars optional.

---

**Document Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Ready for Development  
**Next Review:** After Phase 1 completion
