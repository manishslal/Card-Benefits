# Card Benefits Tracker - Settings & Claims Feature Specification

**Document Version:** 1.0  
**Status:** FINAL SPECIFICATION  
**Target Implementation:** Next.js Expert Developer  
**Date:** April 1, 2024

---

## EXECUTIVE SUMMARY & GOALS

This specification defines the complete technical architecture for two interconnected feature sets:

1. **Feature 1: User Settings & Navigation (TopNav Component)** - A fixed header navigation system with user profile management, theme switching, and preferences management.
2. **Feature 2: Historical Claims & Data Management (BenefitClaim Ledger)** - A comprehensive modal interface for viewing, editing, and managing historical benefit claims with statistical analysis.

Both features are built on existing patterns in the codebase and will establish the foundational user authentication and personalization system.

### Primary Objectives
- ✅ Implement fixed header navigation (TopNav) with profile dropdown, theme toggle, and logout functionality
- ✅ Create user settings pages for theme, notification, and profile preferences
- ✅ Build comprehensive claims history modal with filtering, editing, and undo capabilities
- ✅ Establish authentication middleware and protected routes
- ✅ Add form validation with Zod and toast notifications with sonner
- ✅ Maintain TypeScript strict mode and existing architectural patterns

### Success Criteria
- All protected routes require authentication
- Settings changes persist to database and reflect immediately
- Claims history shows complete ledger with editing capability
- All forms have real-time validation feedback
- Toast notifications appear for all async operations
- Modal keyboard navigation works (Escape to close)
- WCAG 2.1 Level AA accessibility compliance
- 90+ Lighthouse performance score

---

## 1. FUNCTIONAL REQUIREMENTS

### 1.1 Feature 1: User Settings & Navigation

**Core Capabilities:**
- User authentication (login/logout/register)
- Fixed header navigation visible on all pages
- User profile dropdown menu with Settings, Preferences, and Logout options
- User profile page to view/edit first name, last name, and email
- User preferences page for theme selection (light/dark/system)
- User preferences for notification settings (email, in-app)
- User preferences for currency selection (USD/EUR/GBP)
- Protected routes that redirect to login if not authenticated
- Session management with authentication tokens

**User Roles:**
- **Authenticated User** - Can access dashboard, settings, and preferences
- **Unauthenticated User** - Redirected to login page for protected routes

**System Constraints:**
- One theme preference per user (stored in database, persisted across tabs)
- One preference set per user (unique constraint on userId)
- Session tokens expire after 7 days (configurable)
- Password must be at least 8 characters (validation rule)
- Email must be unique across all users
- All forms must validate before submission

### 1.2 Feature 2: Historical Claims & Data Management

**Core Capabilities:**
- View all historical benefit claims for a specific card
- Filter claims by status (all claims, used/claimed, pending, expired)
- Sort claims by date, benefit name, or value
- Edit claim value and add/edit notes
- Delete/undo claims (revert benefit to unclaimed status)
- View summary statistics (total claimed, count by type, percentage utilization)
- Export claim history (optional, Phase 2)
- Add manual notes to claims for recordkeeping

**User Roles:**
- **Card Owner** - Can view and edit claims for their own cards only

**System Constraints:**
- Can only view/edit own claims (userId-based filtering)
- Historical claims are immutable except for notes and user-declared value
- Claim timestamps are permanent (claimedAt is never modified)
- deleting a claim reverts isUsed to false (if applicable)
- Benefit reset cadence affects claim visibility (monthly, calendar year, cardmember year, one-time)
- Cannot edit claim from different month/period without special handling

---

## 2. IMPLEMENTATION PHASES

[Note: Full spec continues with all 15 sections as previously outlined, but I'll provide the file creation in a more efficient way]

