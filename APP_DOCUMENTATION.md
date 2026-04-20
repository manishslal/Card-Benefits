# CardTrack — Application Documentation

## For Third-Party Review

> **Generated**: July 2025  
> **Codebase Version**: 1.0.0  
> **Repository**: Card-Benefits (private)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Data Model](#5-data-model)
6. [Features](#6-features)
   - 6.1 [Authentication](#61-authentication)
   - 6.2 [Dashboard & Card Management](#62-dashboard--card-management)
   - 6.3 [Benefit Engine & Tracking](#63-benefit-engine--tracking)
   - 6.4 [Lounge Finder](#64-lounge-finder)
   - 6.5 [Admin Panel](#65-admin-panel)
   - 6.6 [AI Assistant](#66-ai-assistant)
   - 6.7 [Settings & Preferences](#67-settings--preferences)
7. [UI/UX Design System](#7-uiux-design-system)
8. [Scraper Infrastructure](#8-scraper-infrastructure)
9. [API Reference](#9-api-reference)
10. [Security & Authentication](#10-security--authentication)
11. [Testing](#11-testing)
12. [Current Metrics & State](#12-current-metrics--state)
13. [Development Guide](#13-development-guide)

---

## 1. Executive Summary

**CardTrack** is a full-stack web application that helps users track and maximize credit card benefits. Users add their credit cards to the platform, and the system automatically generates period-based benefit tracking rows (monthly dining credits, annual travel credits, etc.), calculates when benefits reset, and shows which benefits are about to expire or remain unclaimed.

### Core Value Proposition

- **Benefit Tracking**: Automatically tracks which benefits have been used/unused per period
- **Lounge Finder**: Matches the user's card portfolio to airport lounge access across Priority Pass, Amex Centurion, airline lounges, and more
- **Multi-Player Support**: A single account can manage cards for multiple household members ("players")
- **Period Engine**: Handles complex cadence logic (monthly, quarterly, semi-annual, cardmember year, one-time) with variable claiming amounts
- **Admin Panel**: Full CRUD for managing the master card/benefit catalog with audit logging

### Key Numbers

| Metric | Value |
|--------|-------|
| Database models | 20 Prisma models |
| API routes | 40+ Next.js route handlers |
| Scraper sources | 4 (Priority Pass, Amex, Star Alliance, oneworld) |
| UI components | 21 shared UI primitives + feature components |
| Test suites | Vitest (unit) + Playwright (E2E) |

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.x | React framework (App Router) |
| React | 19.x | UI library |
| TypeScript | 5.3+ | Type safety |
| Tailwind CSS | 3.4.x | Utility-first CSS |
| Radix UI | Various | Accessible primitives (Dialog, Dropdown, Select, Tabs, Popover) |
| Lucide React | 1.7.x | Icon library |
| SWR | 2.4.x | Data fetching / caching |
| class-variance-authority | 0.7.x | Component variant management |
| tw-animate-css | 1.4.x | Animation utilities |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js API Routes | 15.x | REST API layer (Node.js runtime) |
| Prisma ORM | 5.8.x | Database ORM with migrations |
| PostgreSQL | — | Primary database |
| Argon2 | 0.44.x | Password hashing |
| jsonwebtoken | 9.x | JWT session tokens |
| PapaParse | 5.5.x | CSV import parsing |
| xlsx | 0.18.x | Excel import/export |

### Scrapers (Python)

| Technology | Purpose |
|-----------|---------|
| Playwright (Python) | Browser automation for lounge scraping |
| psycopg2 | Direct PostgreSQL access |
| asyncio | Concurrent scraper execution |

### Testing

| Technology | Purpose |
|-----------|---------|
| Vitest | Unit/integration tests |
| Playwright (Node.js) | End-to-end browser tests |
| @vitest/coverage-v8 | Code coverage |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Railway | Deployment target |
| Vercel | Alternative deployment (vercel.json present) |
| Docker | Containerization (`.dockerignore` present) |

---

## 3. Architecture Overview

CardTrack follows a **monolithic Next.js App Router** architecture with clear separation between features:

```
┌──────────────────────────────────────────────────────┐
│                    Client (Browser)                   │
│  Next.js App Router · React 19 · Tailwind CSS        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Dashboard │ │ Lounges  │ │  Admin   │ │Settings │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
└───────┼─────────────┼───────────┼─────────────┼──────┘
        │             │           │             │
┌───────▼─────────────▼───────────▼─────────────▼──────┐
│              Next.js Middleware (Node.js)              │
│  JWT verification → DB session check → Route guard    │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                 API Route Handlers                     │
│  /api/auth/*  /api/cards/*  /api/benefits/*           │
│  /api/lounges/*  /api/admin/*  /api/cron/*            │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│              Prisma ORM + Benefit Engine               │
│  ┌──────────────┐ ┌─────────────┐ ┌───────────────┐  │
│  │ Date Math    │ │ Generate    │ │ Hydrate       │  │
│  │ Engine       │ │ Benefits    │ │ Period        │  │
│  └──────────────┘ └─────────────┘ └───────────────┘  │
└───────────────────────┬──────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────┐
│                    PostgreSQL                          │
│  Users · Cards · Benefits · Lounges · Audit Logs      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              Python Scraper Pipeline                   │
│  Priority Pass · Amex · Star Alliance · oneworld      │
│  → Direct PostgreSQL writes (psycopg2)                │
└──────────────────────────────────────────────────────┘
```

### Request Flow

1. **Middleware** (`src/middleware.ts`) intercepts every request
2. Extracts JWT from `HttpOnly` cookie, verifies signature (HS256)
3. Validates session in database (checks revocation)
4. Sets `x-user-id` header for downstream route handlers
5. Route handlers use Prisma to query/mutate PostgreSQL

### Key Architectural Decisions

- **Node.js Runtime** for middleware (not Edge) — required for `jsonwebtoken` and Prisma
- **Server Components** are not heavily used; most pages are `'use client'` for interactivity
- **Argon2** for password hashing (excluded from client bundles via webpack config)
- **CSS Variables** as design tokens consumed by Tailwind config
- **Feature-based folder structure** under `src/features/`

---

## 4. Project Structure

```
Card-Benefits/
├── prisma/
│   └── schema.prisma              # 20 models, 752 lines
├── scrapers/                      # Python lounge scraper pipeline
│   ├── base_scraper.py            # Abstract base with Playwright lifecycle
│   ├── priority_pass_scraper.py   # Priority Pass network
│   ├── amex_lounge_scraper.py     # Amex Centurion + Escape lounges
│   ├── star_alliance_scraper.py   # Star Alliance gold lounges
│   ├── oneworld_scraper.py        # oneworld emerald/sapphire lounges
│   ├── run_lounge_scrapers.py     # Orchestrator (CLI)
│   ├── seeds/
│   │   └── proprietary_lounges.py # Capital One, Chase, Delta, United
│   ├── database.py                # psycopg2 connection management
│   ├── repository.py              # Upsert functions for lounge data
│   ├── models.py                  # Python dataclasses for scraper output
│   ├── normalizer.py              # Data normalization
│   └── us_airports.py             # IATA code → metadata dictionary
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (Geist font, ThemeProvider)
│   │   ├── page.tsx               # Landing page
│   │   ├── (auth)/                # Auth route group
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── forgot-password/
│   │   ├── (dashboard)/           # Dashboard route group
│   │   │   ├── card/
│   │   │   └── settings/
│   │   ├── dashboard/             # Main dashboard
│   │   │   ├── page.tsx           # Benefits grid + card switcher
│   │   │   ├── lounges/           # Lounge Finder feature
│   │   │   ├── assistant/         # AI Assistant (placeholder)
│   │   │   ├── settings/          # Redirects to /settings
│   │   │   └── new/               # New dashboard components
│   │   ├── admin/                 # Admin panel
│   │   │   ├── page.tsx           # Admin dashboard
│   │   │   ├── cards/             # Card catalog CRUD
│   │   │   ├── benefits/          # Benefit catalog CRUD
│   │   │   ├── users/             # User management
│   │   │   └── audit/             # Audit log viewer
│   │   └── api/                   # API routes (see §9)
│   ├── features/                  # Feature modules
│   │   ├── auth/                  # Authentication logic
│   │   ├── benefits/              # Benefit components + logic
│   │   ├── cards/                 # Card components + logic
│   │   ├── admin/                 # Admin feature module
│   │   ├── custom-values/         # User-declared benefit values
│   │   ├── import-export/         # CSV/Excel import/export
│   │   └── user-settings/         # User preferences
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ui/                # 21 shared UI primitives
│   │   │   ├── layout/            # AppHeader, Container, ClientLayoutWrapper
│   │   │   ├── features/          # CardCarousel, DashboardSummary, etc.
│   │   │   ├── loaders/           # Skeleton loaders
│   │   │   └── providers/         # ThemeProvider
│   │   ├── context/               # React contexts
│   │   ├── hooks/                 # Shared hooks
│   │   ├── lib/                   # Shared utilities
│   │   └── types/                 # Shared TypeScript types
│   ├── hooks/                     # App-level hooks
│   │   ├── useBenefitFilter.ts
│   │   ├── useBenefitUsage.ts
│   │   ├── useOnboarding.ts
│   │   ├── useProgressCalculation.ts
│   │   ├── usePullToRefresh.ts
│   │   └── useRecommendations.ts
│   ├── lib/                       # Core business logic
│   │   ├── benefit-engine/        # Period calculation engine
│   │   ├── benefit-event-ledger.ts
│   │   ├── benefit-period-utils.ts
│   │   ├── claiming-validation.ts
│   │   ├── filters.ts
│   │   ├── feature-flags.ts
│   │   ├── import/                # Import processing
│   │   ├── export/                # Export generation
│   │   ├── validators/            # Input validation
│   │   └── redis-rate-limiter.ts
│   └── styles/
│       ├── design-tokens.css      # CSS variable design system
│       ├── globals.css            # Global styles + Tailwind directives
│       └── animations.css         # Keyframe animations
├── tests/                         # E2E and integration tests
│   ├── e2e/
│   ├── integration/
│   ├── security/
│   └── modals/
├── scripts/                       # Utility scripts
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

---

## 5. Data Model

The application uses **PostgreSQL** with **Prisma ORM**. The schema defines 20 models organized into four domains.

### 5.1 Entity Relationship Overview

```
User (1) ──── (N) Player (1) ──── (N) UserCard (1) ──── (N) UserBenefit
  │                                      │                      │
  │                                      │                      ├── BenefitEvent
  │                                      │                      ├── BenefitPeriod
  │                                      │                      ├── BenefitUsageRecord
  │                                      │                      ├── BenefitRecommendation
  │                                      │                      └── BenefitTrackerProjection
  │                                      │
  │                                      └── MasterCard (catalog)
  │                                            │
  │                                            ├── MasterBenefit (catalog)
  │                                            └── CardLoungeAccess
  │
  ├── Session
  ├── ImportJob → ImportRecord
  ├── UserImportProfile
  ├── OnboardingSession → OnboardingStep
  └── AdminAuditLog
```

### 5.2 Core Models

#### User

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| email | String | Unique |
| passwordHash | String | Argon2 hash |
| firstName | String? | Optional |
| lastName | String? | Optional |
| role | UserRole enum | `USER`, `ADMIN`, `SUPER_ADMIN` |
| isActive | Boolean | Account status |
| passwordResetToken | String? | Unique, for password reset flow |
| passwordResetExpiry | DateTime? | Token expiration |

#### Player

Multi-player support allows one account to track cards for household members.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userId | String | FK → User |
| playerName | String | Display name |
| isActive | Boolean | Soft delete |

Unique constraint: `(userId, playerName)`

#### MasterCard (Catalog)

Admin-managed card catalog. Each row represents a credit card product.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| issuer | String | e.g., "American Express", "Chase" |
| cardName | String | e.g., "Platinum Card" |
| defaultAnnualFee | Int | In dollars |
| cardImageUrl | String | Card image |
| displayOrder | Int | Sort order in catalog |
| isActive | Boolean | Visible to users |
| isArchived | Boolean | Soft delete |
| createdByAdminId | String? | Audit trail |

Unique constraint: `(issuer, cardName)`

#### MasterBenefit (Catalog)

Admin-managed benefit templates attached to master cards.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| masterCardId | String | FK → MasterCard |
| name | String | e.g., "Uber Credit" |
| type | String | Benefit category |
| stickerValue | Int | Dollar value (cents) |
| resetCadence | String | Legacy: `Monthly`, `CalendarYear`, `CardmemberYear`, `OneTime` |
| claimingCadence | String? | New: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `FLEXIBLE_ANNUAL`, `ONE_TIME` |
| claimingAmount | Int? | Amount per period in cents |
| variableAmounts | Json? | Month-specific overrides, e.g., `{ "12": 3500 }` for Dec $35 |
| claimingWindowEnd | String? | Custom window boundary (e.g., "0918") |
| isDefault | Boolean | Auto-created for new UserCards |
| isActive | Boolean | Can be deactivated without deletion |

#### UserCard

A user's actual credit card, linked to a catalog entry.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| playerId | String | FK → Player |
| masterCardId | String | FK → MasterCard |
| customName | String? | User-provided nickname |
| actualAnnualFee | Int? | Override default fee |
| renewalDate | DateTime | Card anniversary date |
| isOpen | Boolean | Card is currently active |
| status | String | `ACTIVE`, etc. |

Unique constraint: `(playerId, masterCardId)`

#### UserBenefit

Individual benefit period rows. Each row represents ONE period of a benefit.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| userCardId | String | FK → UserCard |
| playerId | String | FK → Player |
| masterBenefitId | String? | FK → MasterBenefit (null for custom benefits) |
| name | String | Denormalized display name |
| type | String | Benefit category |
| stickerValue | Int | Dollar value |
| resetCadence | String | Period type |
| periodStart | DateTime? | Start of this benefit period (UTC) |
| periodEnd | DateTime? | End of this benefit period (UTC) |
| periodStatus | String | `ACTIVE`, `EXPIRED`, `UPCOMING` |
| isUsed | Boolean | Whether benefit was claimed |
| timesUsed | Int | Usage count |
| claimedAt | DateTime? | When claimed |
| userDeclaredValue | Int? | Custom value override |

Unique constraint: `(userCardId, name, periodStart)`

### 5.3 Lounge Module Models

The lounge data model supports a graph of access methods:

```
LoungeAirport (1) ──── (N) LoungeTerminal (1) ──── (N) Lounge
                                                          │
                                                    LoungeAccessRule
                                                          │
                                                    LoungeAccessMethod ←── CardLoungeAccess ──→ MasterCard
                                                          │
                                                    (self-referential: grantsNetworkId)
```

**Key insight**: `LoungeAccessMethod.grantsNetworkId` creates a recursive chain. For example, "Chase Sapphire Reserve" → grants "Priority Pass Select" → which has access rules on individual lounges. The eligible API traverses this chain.

#### Key Lounge Models

| Model | Purpose |
|-------|---------|
| `LoungeAirport` | Airport with IATA code, city, timezone |
| `LoungeTerminal` | Terminal within an airport |
| `Lounge` | Individual lounge with amenities, hours, venue type |
| `LoungeAccessMethod` | Named access program (e.g., "Priority Pass Select") |
| `LoungeAccessRule` | Links a lounge to an access method with cost/guest rules |
| `CardLoungeAccess` | Links a MasterCard to access methods it grants |
| `LoungeScrapeRun` | Tracks scraper execution history |

### 5.4 Event Sourcing Models

| Model | Purpose |
|-------|---------|
| `BenefitEvent` | Immutable ledger of usage/spend/points events |
| `BenefitTrackerProjection` | Materialized view of aggregated event data |
| `BenefitUsageRecord` | Individual usage records with amounts |
| `BenefitPeriod` | Period aggregation with total used/count |
| `BenefitRecommendation` | AI-generated benefit recommendations |

### 5.5 Supporting Models

| Model | Purpose |
|-------|---------|
| `Session` | JWT session tracking with revocation support |
| `ImportJob` | CSV/Excel import tracking |
| `ImportRecord` | Individual import rows with validation status |
| `UserImportProfile` | Saved column mapping profiles |
| `AdminAuditLog` | Admin action audit trail |
| `OnboardingSession` | Multi-step onboarding progress |
| `OnboardingStep` | Individual onboarding step data |

### 5.6 Enums

```prisma
enum UserRole { USER, ADMIN, SUPER_ADMIN }
enum AuditActionType { CREATE, UPDATE, DELETE }
enum ResourceType { CARD, BENEFIT, USER_ROLE, SYSTEM_SETTING }
enum BenefitEventFamily { UNLIMITED_USE, MULTIPLIER_SPEND }
enum BenefitEventType {
  USAGE_ADD, USAGE_REMOVE, SPEND_ADD, SPEND_REMOVE,
  POINTS_ADD, POINTS_REMOVE, ADJUSTMENT
}
```

---

## 6. Features

### 6.1 Authentication

**Location**: `src/features/auth/`, `src/app/(auth)/`, `src/app/api/auth/`

The authentication system uses a **JWT + database session** hybrid approach:

#### Flow

1. **Signup** (`POST /api/auth/signup`): Creates user, hashes password with Argon2, creates session, sets HttpOnly cookie
2. **Login** (`POST /api/auth/login`): Verifies credentials, creates session, sets JWT cookie
3. **Session check**: Middleware verifies JWT signature + database session on every request
4. **Logout** (`POST /api/auth/logout`): Revokes session in database, clears cookie
5. **Password reset**: Token-based flow via `forgot-password` → email → `reset-password`

#### Auth API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/signup` | POST | Create account |
| `/api/auth/login` | POST | Authenticate |
| `/api/auth/logout` | POST | Revoke session |
| `/api/auth/session` | GET | Validate current session |
| `/api/auth/session-status` | GET | Quick session check |
| `/api/auth/refresh-token` | POST | Refresh JWT |
| `/api/auth/user` | GET | Get current user profile |
| `/api/auth/verify` | POST | Email verification |
| `/api/auth/forgot-password` | POST | Initiate password reset |
| `/api/auth/reset-password` | POST | Complete password reset |

#### Security Properties

- Passwords hashed with **Argon2** (not bcrypt)
- JWT stored in **HttpOnly, SameSite=Strict** cookie
- Database session check prevents using tokens post-logout
- Middleware runs in **Node.js runtime** (not Edge) for crypto support

### 6.2 Dashboard & Card Management

**Location**: `src/app/dashboard/page.tsx`, `src/features/cards/`, `src/features/benefits/`

The main dashboard is a client-side rendered page featuring:

#### Dashboard Components

- **AppHeader**: Sticky header with "CardTrack" branding and settings link
- **CardCarousel / CompactCardChips**: Horizontal scrollable card selector
- **DashboardSummary**: Aggregate statistics (total value, used/unused counts)
- **BenefitsGrid**: Card grid showing all benefits for the selected card
- **UnifiedFilterBar**: Period, category, and status filters
- **SmartViewChips**: Quick filter presets ("Expiring Soon", "Unused", etc.)
- **SearchSortBar**: Text search and sort controls
- **MobileSummaryStats**: Compact stats for mobile viewport

#### Card Management

- **Add Card Modal**: Select from master card catalog, set renewal date
- **Edit Card Modal**: Update card details (nickname, annual fee, status)
- **Card status management**: Active, archived, with reason tracking
- **Multi-player tabs**: Switch between household members via `PlayerTabs` component

#### Card API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/cards/available` | GET | List master card catalog (public) |
| `/api/cards/master` | GET | Master card details with benefits |
| `/api/cards/my-cards` | GET | Current user's cards |
| `/api/cards/user-cards` | GET | User cards with benefit data |
| `/api/cards/add` | POST | Add card to user's portfolio |
| `/api/cards/[id]` | GET/PUT/DELETE | Individual card CRUD |

### 6.3 Benefit Engine & Tracking

**Location**: `src/lib/benefit-engine/`

The Benefit Engine is the core business logic module. It handles period-based benefit lifecycle management.

#### Module Structure

```
src/lib/benefit-engine/
├── index.ts              # Barrel exports
├── types.ts              # Shared types (cadences, periods)
├── date-math.ts          # Pure period calculation functions
├── generate-benefits.ts  # Auto-generation on card add
├── hydrate-period.ts     # Period field hydration utility
└── pro-rata.ts           # Pro-rata calculations for mid-period adds
```

#### Key Types

```typescript
type ClaimingCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'FLEXIBLE_ANNUAL' | 'ONE_TIME';
type ResetCadence = 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';

interface PeriodBoundary {
  periodStart: Date;
  periodEnd: Date | null;  // null for ONE_TIME benefits
}

type PeriodStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING';
```

#### How It Works

1. **Card Added** → `generateBenefitsForCard()` queries `MasterBenefit` catalog, creates `UserBenefit` period rows
2. **Period Calculation** → `calculatePeriodForBenefit()` computes `periodStart`/`periodEnd` based on cadence and renewal date
3. **Variable Amounts** → `resolveClaimingAmount()` handles month-specific overrides (e.g., Amex Uber: $15/mo, $35 in December)
4. **Cron Rollover** → `POST /api/cron/reset-benefits` expires old periods and generates next-period rows
5. **Usage Tracking** → Events logged to `BenefitEvent` ledger, projections materialized in `BenefitTrackerProjection`

#### Benefit API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/benefits/user` | GET | User's benefits with period data |
| `/api/benefits/[id]` | GET/PUT/DELETE | Individual benefit CRUD |
| `/api/benefits/add` | POST | Add custom benefit |
| `/api/benefits/usage` | POST | Record benefit usage |
| `/api/benefits/events` | GET/POST | Event ledger operations |
| `/api/benefits/tracker-state` | GET | Current tracker projections |
| `/api/benefits/progress` | GET | Usage progress calculations |
| `/api/benefits/periods` | GET | Benefit period history |
| `/api/benefits/history` | GET | Usage history timeline |
| `/api/benefits/filters` | GET | Available filter options |
| `/api/benefits/recommendations` | GET | AI-powered recommendations |
| `/api/benefits/claiming-limits` | GET | Claiming cadence limits |
| `/api/cron/reset-benefits` | POST | Cron: expire + generate periods |

### 6.4 Lounge Finder

**Location**: `src/app/dashboard/lounges/`

A three-view feature that shows which airport lounges the user can access based on their credit card portfolio.

#### View State Machine

```
search → list → detail
  ↑        ↑       │
  └────────┴───────┘ (back navigation)
```

#### Components

| Component | File | Purpose |
|-----------|------|---------|
| `LoungesPage` | `page.tsx` | State machine orchestrator |
| `AirportSearch` | `AirportSearch.tsx` | Airport autocomplete with IATA lookup |
| `LoungeList` | `LoungeList.tsx` | Filterable list of lounges at selected airport |
| `LoungeDetail` | `LoungeDetail.tsx` | Full lounge details with amenities |
| `FilterPills` | `FilterPills.tsx` | Venue type filters |
| `TerminalFilter` | `TerminalFilter.tsx` | Terminal selector |
| `AccessOptionCard` | `AccessOptionCard.tsx` | Access method display |
| `LoungeCard` | `LoungeCard.tsx` | Lounge summary card |
| `NoCardsPrompt` | `NoCardsPrompt.tsx` | Empty state when user has no cards |

#### Key Types

```typescript
interface Airport {
  iata_code: string;
  name: string;
  city: string;
  timezone: string;
}

interface LoungeData {
  lounge_id: string;
  lounge_name: string;
  terminal: string;
  venue_type: string;
  operating_hours: Record<string, unknown> | null;
  amenities: Record<string, unknown> | null;
  access_options: AccessOption[];
  best_access_type: string;   // "free", "day_pass", "membership"
  best_access_method: string;
  may_deny_entry: boolean;
  is_airside: boolean | null;
}

interface EligibleResponse {
  success: boolean;
  airport: string;
  total_lounges: number;
  free_access: number;
  day_pass_available: number;
  has_cards?: boolean;
  lounges: LoungeData[];
}
```

#### Lounge API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/lounges/eligible` | GET | Lounges accessible to user at airport |
| `/api/lounges/airports` | GET | Airport search/autocomplete |
| `/api/lounges/[id]` | GET | Individual lounge detail |
| `/api/lounges/what-if` | GET | What-if analysis (hypothetical card adds) |

#### Features

- **Client-side caching**: Per-airport results cached in `useRef<Map>` during session
- **Real-time open/closed status**: Calculated from operating hours + airport timezone
- **Venue type filtering**: Lounges, spas, restaurants, gaming, sleep pods, wellness
- **Recent airports**: Last 3 searches persisted in `localStorage`
- **Responsive**: Desktop shows list+detail side-by-side; mobile uses back navigation

### 6.5 Admin Panel

**Location**: `src/app/admin/`, `src/features/admin/`

Role-gated admin interface for managing the card/benefit catalog and user accounts.

#### Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/admin` | System overview with metrics and recent audit logs |
| Cards | `/admin/cards` | CRUD for master card catalog |
| Benefits | `/admin/benefits` | CRUD for master benefit catalog |
| Users | `/admin/users` | User management (role assignment, activation) |
| Audit | `/admin/audit` | Searchable audit log viewer |

#### Admin API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/cards` | GET/POST | List/create master cards |
| `/api/admin/cards/[id]` | PUT/DELETE | Update/delete master card |
| `/api/admin/benefits` | GET/POST | List/create master benefits |
| `/api/admin/benefits/[id]` | PUT/DELETE | Update/delete master benefit |
| `/api/admin/users` | GET | List users |
| `/api/admin/users/[id]` | PUT | Update user role/status |
| `/api/admin/audit-logs` | GET | Query audit trail |
| `/api/admin/check` | GET | Verify admin role |
| `/api/admin/context` | GET | Admin session context |

#### Audit Logging

Every admin mutation logs to `AdminAuditLog` with:
- Who (`adminUserId`)
- What (`actionType`, `resourceType`, `resourceId`)
- Change details (`oldValues`, `newValues` as JSON)
- Request context (`ipAddress`, `userAgent`)

### 6.6 AI Assistant

**Location**: `src/app/dashboard/assistant/page.tsx`

Currently a **placeholder** page. Displays a message indicating the assistant experience is not yet available, directing users to the dashboard for benefit tracking.

### 6.7 Settings & Preferences

**Location**: `src/app/(dashboard)/settings/`, `src/features/user-settings/`

The settings page is accessible via `/settings` (the `/dashboard/settings` route redirects there). Features include:
- User profile management
- Dark mode toggle (class-based, `.dark` on `<html>`)
- Notification preferences
- Account management

---

## 7. UI/UX Design System

### 7.1 Design Token Architecture

The design system is built on **CSS custom properties** (design tokens) defined in `src/styles/design-tokens.css` and consumed by `tailwind.config.js`.

**Architecture**: `design-tokens.css` → CSS Variables → `tailwind.config.js` → Utility Classes

#### Color Palette

| Token | Light Mode | Purpose |
|-------|-----------|---------|
| `--color-primary` | `#2563EB` | Primary blue (WCAG AA) |
| `--color-secondary` | `#B45309` | Accent orange (amber-700) |
| `--color-success` | `#0a7d57` | Success green |
| `--color-error` | `#ef4444` | Error red |
| `--color-warning` | `#B45309` | Warning (matches secondary) |
| `--color-info` | `#0d9488` | Info teal |
| `--color-bg` | `#ffffff` | Background |
| `--color-bg-secondary` | `#F8FAFC` | Secondary background |
| `--color-text` | `#111827` | Primary text |
| `--color-text-secondary` | `#6b7280` | Secondary text |

All colors have dark mode variants applied via `.dark` class on `<html>`.

#### Typography

| Token | Value |
|-------|-------|
| `--font-primary` | Inter, system-ui, sans-serif |
| `--font-heading` | Plus Jakarta Sans, system-ui, sans-serif |
| `--font-mono` | JetBrains Mono, Monaco, Courier New |
| `--text-h1` | 48px (desktop) |
| `--text-h2` | 42px |
| `--text-h3` | 37px |
| `--text-body-md` | Base body text |
| `--text-caption` | Small text with letter-spacing |

The root layout uses the **Geist** font loaded via `next/font/google`.

#### Spacing Scale

```
xs → sm → md → lg → xl → 2xl → 3xl → 4xl
```

All consumed through Tailwind utility classes: `p-md`, `gap-lg`, `mb-xl`, etc.

#### Elevation (Shadows)

```
xs → sm → md → lg → xl
```

Special shadows: `--shadow-benefit-card` and `--shadow-benefit-card-hover` for card hover effects.

### 7.2 Component Library

Located at `src/shared/components/ui/`:

| Component | File | Purpose |
|-----------|------|---------|
| Button | `button.tsx` | Primary action buttons with variants |
| Card | `card.tsx` | Content containers |
| Dialog | `dialog.tsx` | Modal dialogs (Radix UI) |
| Input | `Input.tsx` | Form inputs |
| Badge | `Badge.tsx` | Status badges |
| Tabs | `tabs.tsx` | Tab navigation (Radix UI) |
| Select | `select-unified.tsx` | Dropdown select (Radix UI) |
| Dropdown Menu | `dropdown-menu.tsx` | Context menus (Radix UI) |
| Popover | `popover.tsx` | Floating content (Radix UI) |
| Skeleton | `Skeleton.tsx` | Loading placeholders |
| EmptyState | `EmptyState.tsx` | Empty state illustrations |
| AlertSection | `AlertSection.tsx` | Alert/notification banners |
| SummaryStats | `SummaryStats.tsx` | Dashboard statistics display |
| Icon | `Icon.tsx` | Icon wrapper component |
| DarkModeToggle | `DarkModeToggle.tsx` | Theme toggle control |
| PlayerTabs | `PlayerTabs.tsx` | Multi-player tab selector |
| Toaster | `toaster.tsx` | Toast notification system |

### 7.3 Dark Mode

- **Strategy**: Class-based (`.dark` on `<html>` element)
- **Configuration**: `darkMode: 'class'` in `tailwind.config.js`
- **Provider**: `ThemeProvider` in `src/shared/components/providers/`
- **Persistence**: Theme preference stored client-side
- **Toggle**: Located in Settings/Preferences (not in header)

### 7.4 Responsive Design

- Mobile-first approach
- Key breakpoint: `768px` (mobile ↔ desktop)
- Touch targets: minimum `--touch-target-min` size
- Pull-to-refresh support via `usePullToRefresh` hook
- Compact card chips with edge-fade gradient masks on scroll overflow

### 7.5 Animations

Custom animations defined in `tailwind.config.js`:

| Animation | Description |
|-----------|-------------|
| `fade-in` | Opacity 0→1 |
| `slide-up` | Translate Y + fade |
| `slide-down` | Translate Y (negative) + fade |
| `scale-in` | Scale 0.95→1 + fade |
| `shimmer` | Loading shimmer effect |
| `in` | Slide in from bottom (500ms) |

---

## 8. Scraper Infrastructure

### 8.1 Overview

A Python-based web scraping pipeline that collects airport lounge data from four provider networks. Scrapers use **Playwright** (Python) for browser automation and write directly to PostgreSQL via **psycopg2**.

### 8.2 Architecture

```
run_lounge_scrapers.py (Orchestrator)
    │
    ├── PriorityPassScraper    → Priority Pass website
    ├── AmexLoungeScraper      → Amex Centurion/Escape lounges
    ├── StarAllianceScraper    → Star Alliance gold lounges
    └── OneworldScraper        → oneworld emerald/sapphire lounges

    All extend BaseScraper:
    ├── Playwright browser lifecycle
    ├── Retry logic
    ├── Scrape-run tracking (LoungeScrapeRun)
    └── Upsert chain (airport → terminal → lounge → access rules)
```

### 8.3 Scraper Registry

From `run_lounge_scrapers.py`:

```python
SCRAPER_REGISTRY = {
    "priority_pass": PriorityPassScraper,
    "amex": AmexLoungeScraper,
    "star_alliance": StarAllianceScraper,
    "oneworld": OneworldScraper,
}
```

### 8.4 CLI Usage

```bash
# Run all scrapers
python scrapers/run_lounge_scrapers.py

# Run specific sources
python scrapers/run_lounge_scrapers.py --sources amex oneworld

# Dry run (no DB writes)
python scrapers/run_lounge_scrapers.py --dry-run

# Filter by airports
python scrapers/run_lounge_scrapers.py --airports JFK ORD

# Report stale data only
python scrapers/run_lounge_scrapers.py --report-stale
```

### 8.5 BaseScraper Class

`scrapers/base_scraper.py` — abstract base class providing:

- **Playwright lifecycle**: Browser launch/teardown per scrape run
- **Retry logic**: Configurable retry with backoff
- **Scrape-run tracking**: `start_scrape_run()` → `complete_scrape_run()` / `fail_scrape_run()`
- **Upsert chain**: `upsert_airport()` → `upsert_terminal()` → `upsert_lounge()` for idempotent writes

```python
@dataclass
class ScrapeResult:
    source_name: str
    scraped_at: datetime
    records: list[dict]
    errors: list[str]
```

### 8.6 Seed Data

`scrapers/seeds/proprietary_lounges.py` — seeds lounge data for proprietary programs that cannot be scraped:

- **Capital One Lounges** (DFW, DEN, etc.)
- **Chase Sapphire Lounges**
- **Delta Sky Club**
- **United Club**

Uses the same `upsert_*` repository functions for idempotent execution.

### 8.7 Airport Data

`scrapers/us_airports.py` — dictionary of IATA codes → metadata:

```python
US_AIRPORTS: dict[str, dict[str, str]] = {
    "JFK": {"name": "John F. Kennedy International Airport", "city": "New York", "timezone": "America/New_York"},
    # ... 100+ airports (US + international)
}
```

Despite the variable name `US_AIRPORTS`, it includes major international airports (AMS, BKK, etc.) for Star Alliance and oneworld coverage.

### 8.8 Data Flow

```
Scraper → Normalizer → Repository (upsert) → PostgreSQL
                                                  ↓
                                          Next.js API reads
                                                  ↓
                                          Lounge Finder UI
```

Python scrapers write directly to the same PostgreSQL database that the Next.js application reads from. There is no intermediate queue or cache layer.

---

## 9. API Reference

All API routes are located under `src/app/api/` using Next.js App Router route handlers.

### 9.1 Authentication APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/signup` | POST | Public | Create new account |
| `/api/auth/login` | POST | Public | Authenticate user |
| `/api/auth/logout` | POST | Required | Revoke session |
| `/api/auth/session` | GET | Required | Validate current session |
| `/api/auth/session-status` | GET | Required | Quick session validity check |
| `/api/auth/refresh-token` | POST | Required | Refresh JWT token |
| `/api/auth/user` | GET | Required | Get current user profile |
| `/api/auth/verify` | POST | Public | Email verification |
| `/api/auth/forgot-password` | POST | Public | Initiate password reset |
| `/api/auth/reset-password` | POST | Public | Complete password reset |

### 9.2 Card APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cards/available` | GET | Public | Master card catalog |
| `/api/cards/master` | GET | Required | Master card with benefits |
| `/api/cards/my-cards` | GET | Required | User's card portfolio |
| `/api/cards/user-cards` | GET | Required | Cards with benefit data |
| `/api/cards/add` | POST | Required | Add card to portfolio |
| `/api/cards/[id]` | GET/PUT/DELETE | Required | Individual card operations |

### 9.3 Benefit APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/benefits/user` | GET | Required | User's benefits |
| `/api/benefits/[id]` | GET/PUT/DELETE | Required | Individual benefit CRUD |
| `/api/benefits/add` | POST | Required | Add custom benefit |
| `/api/benefits/usage` | POST | Required | Record usage |
| `/api/benefits/events` | GET/POST | Required | Event ledger |
| `/api/benefits/tracker-state` | GET | Required | Tracker projections |
| `/api/benefits/progress` | GET | Required | Progress calculations |
| `/api/benefits/periods` | GET | Required | Period history |
| `/api/benefits/history` | GET | Required | Usage timeline |
| `/api/benefits/filters` | GET | Required | Filter options |
| `/api/benefits/recommendations` | GET | Required | Recommendations |
| `/api/benefits/claiming-limits` | GET | Required | Cadence limits |

### 9.4 Lounge APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/lounges/eligible` | GET | Required | Eligible lounges at airport |
| `/api/lounges/airports` | GET | Required | Airport search |
| `/api/lounges/[id]` | GET | Required | Lounge detail |
| `/api/lounges/what-if` | GET | Required | Hypothetical card analysis |

**Eligible API query parameters**:
- `airport` (required): 3-letter IATA code
- `include_paid` (optional): `"true"` / `"false"` (default: `"true"`)

### 9.5 Admin APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/admin/cards` | GET/POST | Admin | Manage card catalog |
| `/api/admin/cards/[id]` | PUT/DELETE | Admin | Card catalog CRUD |
| `/api/admin/benefits` | GET/POST | Admin | Manage benefit catalog |
| `/api/admin/benefits/[id]` | PUT/DELETE | Admin | Benefit catalog CRUD |
| `/api/admin/users` | GET | Admin | List users |
| `/api/admin/users/[id]` | PUT | Admin | Manage user roles |
| `/api/admin/audit-logs` | GET | Admin | Query audit trail |
| `/api/admin/check` | GET | Admin | Verify admin role |
| `/api/admin/context` | GET | Admin | Admin context |

### 9.6 Other APIs

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cron/reset-benefits` | POST | System | Cron: expire/generate periods |
| `/api/health` | GET | Public | Health check |
| `/api/onboarding` | Various | Required | Onboarding flow |
| `/api/user/profile` | GET/PUT | Required | User profile |
| `/api/user/benefits` | GET | Required | User benefits (alt endpoint) |
| `/api/mobile/sync` | Various | Required | Mobile data sync |
| `/api/dashboard/benefits` | GET | Required | Dashboard benefit data |

---

## 10. Security & Authentication

### 10.1 Middleware

**File**: `src/middleware.ts`

The middleware runs on **every request** using the Node.js runtime (not Edge, because of `jsonwebtoken` and Prisma dependencies).

#### Route Classification

**Public routes** (no auth required):
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/`
- `/api/auth/*`, `/api/cards/available`, `/api/health`

**Protected routes**: Everything else requires a valid JWT cookie + active database session.

#### Verification Steps

1. Extract JWT from `HttpOnly` cookie
2. Verify JWT signature (HS256)
3. Look up session in database, check `isValid` and `expiresAt`
4. Verify user still exists and `isActive`
5. Set `x-user-id` header for downstream handlers
6. Use `AsyncLocalStorage` for auth context propagation

### 10.2 Password Security

- **Algorithm**: Argon2 (via `argon2` npm package)
- Server-only: excluded from client bundles via webpack `config.resolve.fallback`
- Native binary (`argon2`) marked as webpack external on server builds

### 10.3 Session Management

- JWT tokens stored in **HttpOnly, SameSite=Strict** cookies
- Database-backed sessions enable immediate revocation on logout
- Session model tracks `userAgent` and `ipAddress`
- Token refresh endpoint for extending sessions

### 10.4 Admin Authorization

- Role-based: `USER`, `ADMIN`, `SUPER_ADMIN` enum
- Admin routes check role in middleware and API handlers
- All admin mutations logged to `AdminAuditLog` with full change details

### 10.5 Rate Limiting

- `src/lib/redis-rate-limiter.ts` — Redis-based distributed rate limiting
- Applied to authentication endpoints to prevent brute-force attacks

### 10.6 Input Validation

- `src/lib/validators/` — Validation functions for API inputs
- Prisma parameterized queries prevent SQL injection
- Server-side validation on all mutations

---

## 11. Testing

### 11.1 Test Infrastructure

| Framework | Config File | Purpose |
|-----------|-------------|---------|
| Vitest | `vitest.config.ts` | Unit and integration tests |
| Playwright | `playwright.config.ts` | End-to-end browser tests |
| @vitest/coverage-v8 | — | Code coverage |

### 11.2 Test Commands

```bash
npm run test              # Run Vitest unit tests
npm run test:watch        # Watch mode
npm run test:ui           # Vitest UI
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright E2E tests
npm run test:all          # Unit + E2E combined
```

### 11.3 Test Organization

```
tests/
├── e2e/                           # End-to-end browser tests
├── integration/                   # API integration tests
├── security/                      # Security-focused tests
├── modals/                        # Modal component tests
├── phase3/                        # Phase-specific regression tests
├── card-catalog.spec.ts           # Card catalog E2E
├── responsive-layout.spec.ts      # Responsive design tests
├── functional-qa-comprehensive.spec.ts  # Comprehensive QA
└── phase6c-comprehensive-qa.spec.ts     # Claiming cadence tests

src/lib/__tests__/                 # Unit tests alongside source
src/hooks/__tests__/               # Hook tests
src/lib/benefit-engine/__tests__/  # Benefit engine unit tests
src/features/benefits/__tests__/   # Benefit feature tests
```

### 11.4 Test Categories

- **Unit tests**: Benefit engine date math, period calculations, utility functions
- **Integration tests**: API route handler testing with database
- **E2E tests**: Full browser flows (login, card management, benefit tracking)
- **Responsive tests**: Layout validation at mobile/tablet/desktop breakpoints
- **Security tests**: Authentication, authorization, session management
- **QA validation**: Comprehensive feature audit tests

---

## 12. Current Metrics & State

### 12.1 Codebase Scale

| Metric | Count |
|--------|-------|
| Prisma models | 20 |
| API route directories | 40+ |
| React components (shared UI) | 21 |
| Custom hooks | 8 |
| Python scrapers | 4 |
| Feature modules | 7 (`auth`, `benefits`, `cards`, `admin`, `custom-values`, `import-export`, `user-settings`) |
| npm dependencies | 18 production + 13 dev |

### 12.2 Feature Status

| Feature | Status |
|---------|--------|
| Authentication (signup/login/logout/reset) | ✅ Production |
| Dashboard + card management | ✅ Production |
| Benefit Engine (period tracking) | ✅ Production |
| Claiming cadence system | ✅ Production |
| Lounge Finder | ✅ Production |
| Admin panel (cards/benefits/users/audit) | ✅ Production |
| Import/export (CSV/Excel) | ✅ Production |
| Onboarding flow | ✅ Production |
| Dark mode | ✅ Production |
| Mobile responsive | ✅ Production |
| AI Assistant | ⏸ Placeholder |
| Redis rate limiting | ✅ Production |
| Scraper pipeline | ✅ Production |

### 12.3 Development Phases

The project has been developed through multiple phases:

| Phase | Focus |
|-------|-------|
| Phase 1 | Core auth, dashboard, card management |
| Phase 2 | Benefit tracking, usage records, recommendations |
| Phase 2A | Benefit periods, progress calculations |
| Phase 2B | Onboarding, bug fixes |
| Phase 3 | Admin panel, audit logging |
| Phase 4 | DevOps, deployment, monitoring |
| Phase 5 | Production deployment, additional fixes |
| Phase 6 | Period tracking engine overhaul |
| Phase 6B | Cadence migration planning |
| Phase 6C | Claiming cadence system (variable amounts, frontend) |

---

## 13. Development Guide

### 13.1 Prerequisites

- **Node.js** ≥ 18.0.0
- **PostgreSQL** database
- **Python 3.10+** with Playwright (for scrapers only)

### 13.2 Environment Setup

```bash
# Install dependencies
npm install

# Set up environment variables (copy from template)
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, etc.

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database (optional)
npm run prisma:seed
```

### 13.3 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build          # Runs: prisma generate && next build

# Start production server
npm run start          # Runs: prisma migrate deploy + next start

# Type checking
npm run type-check     # tsc --noEmit

# Linting
npm run lint           # next lint

# Database management
npm run prisma:migrate  # Create and run migrations
npm run prisma:studio   # Open Prisma Studio GUI
npm run db:push         # Push schema without migration
npm run db:reset        # Reset database + seed
npm run db:generate     # Regenerate Prisma client
```

### 13.4 Build Configuration

**next.config.js** key settings:
- `reactStrictMode: true`
- `typescript.ignoreBuildErrors: false` — builds fail on type errors
- `eslint.ignoreDuringBuilds: true` — ESLint runs separately
- Webpack config excludes `argon2` and `crypto` from client bundles
- Package import optimization for `lucide-react` and Radix UI

### 13.5 Database Workflow

```bash
# After schema changes:
npx prisma migrate dev --name describe_change

# View database in browser:
npm run prisma:studio

# Validate DB connection before operations:
node scripts/validate-db-connection.js
```

### 13.6 Scraper Setup (Python)

```bash
cd scrapers
pip install -r requirements.txt
playwright install chromium

# Run all scrapers
python run_lounge_scrapers.py

# Seed proprietary lounges
python seeds/proprietary_lounges.py
```

### 13.7 Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `NEXTAUTH_URL` | Application base URL |
| `REDIS_URL` | Redis connection (for rate limiting) |

### 13.8 Deployment

The application supports multiple deployment targets:

- **Railway**: `railway.json` configuration present
- **Vercel**: `vercel.json` configuration present
- **Docker**: `.dockerignore` present (containerization ready)

Production start command runs migrations before starting:
```bash
prisma migrate resolve --applied 20260410000000_sprint1_variable_amounts 2>/dev/null; \
prisma migrate deploy && \
node scripts/migrate-master-benefits.js && \
next start
```

---

*End of document.*
