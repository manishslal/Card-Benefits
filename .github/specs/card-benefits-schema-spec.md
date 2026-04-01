# Credit Card Benefits Tracker - Database Schema Specification

**Version:** 1.0  
**Date:** 2026-03-31  
**Status:** SPECIFICATION  
**Document Purpose:** Comprehensive database schema definition for the Credit Card Benefits Tracker application using Prisma ORM.

---

## Executive Summary

The Credit Card Benefits Tracker uses a **dual-layer Prisma schema architecture** that separates master catalog data (read-only templates) from user-editable wallet data. This design enables flexible benefit tracking across multiple cards while maintaining data consistency, security, and scalability.

**Key Architectural Principles:**
- **Layer 1 (Master Catalog):** Immutable templates of credit cards and their standard benefits
- **Layer 2 (User Wallet):** Editable user-specific clones with customizations and tracking
- **Relationship Model:** One-to-many relationships with explicit foreign keys
- **Data Integrity:** Constraints and indexes optimized for query performance

---

## Architecture Overview

### Dual-Layer Design Rationale

#### Problem Statement
Credit card benefits vary by:
1. **Card Issuer & Product:** Discover, Chase, American Express (different benefit structures)
2. **Cardholder Preferences:** Same card, different customizations per user
3. **Benefit Tracking:** Users need to track claimed benefits, values, and usage patterns

#### Solution: Two-Layer Separation

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Master Catalog (Read-Only Templates)              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ MasterCard       │    │ MasterBenefit                │   │
│  │ - Static data    │    │ - Standard benefit configs   │   │
│  │ - No user edits  │    │ - Shared across users        │   │
│  └────────┬─────────┘    └─────────┬────────────────────┘   │
│           │                        │                         │
│  ┌────────▼────────────────────────▼────────────┐            │
│  │ One-to-Many Relationship (1 Card : N Benefits)           │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ References (FK)
                              │
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: User Wallet (Editable Clones)                    │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ User             │    │ Player                       │   │
│  │ - Auth identity  │    │ - Multi-user profiles        │   │
│  │ - Account owner  │    │ - User personas              │   │
│  └────────┬─────────┘    └─────────┬────────────────────┘   │
│           │                        │                         │
│  ┌────────▼────────────────────────▼────────────┐            │
│  │ One-to-Many Relationship (1 Player : N Cards)            │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ UserCard         │    │ UserBenefit                  │   │
│  │ - Card clones    │    │ - Benefit tracking           │   │
│  │ - Customizations │    │ - Usage & expiration         │   │
│  └────────┬─────────┘    └─────────┬────────────────────┘   │
│           │                        │                         │
│  ┌────────▼────────────────────────▼────────────┐            │
│  │ One-to-Many Relationship (1 UserCard : N Benefits)       │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### Benefits of Dual-Layer Architecture

| Aspect | Benefit |
|--------|---------|
| **Data Consistency** | Master catalog maintains authoritative card/benefit definitions |
| **Performance** | Read-heavy queries use indexed master tables; writes isolated to user tables |
| **Flexibility** | Users customize cards (name, fee, renewal date) without affecting others |
| **Auditability** | Master data changes tracked separately from user claims |
| **Scalability** | Thousands of users reference same 100 master cards; no duplication |
| **Edit Control** | User claims/customizations don't corrupt shared canonical data |

---

## Data Models

### Layer 1: Master Catalog

#### MasterCard Model

**Entity Purpose:** Canonical definition of credit card products offered by issuers.

**Schema Definition:**

```prisma
model MasterCard {
  id                 String   @id @default(cuid())
  issuer            String   // e.g., "Chase", "American Express", "Discover"
  cardName          String   // e.g., "Chase Sapphire Reserve", "Amex Platinum"
  defaultAnnualFee  Int      // In cents (e.g., 55000 = $550)
  cardImageUrl      String   // CDN URL to card image/logo
  
  // Relationships
  masterBenefits    MasterBenefit[]  // One-to-many: card has many benefits
  userCards         UserCard[]       // Inverse: many users can own this card
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Indexes
  @@index([issuer])
  @@index([cardName])
  @@unique([issuer, cardName]) // Ensure no duplicate card products
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Globally unique identifier; CUID preferred over UUID for readability in logs |
| `issuer` | String | Required, indexed | Enables filtering by bank (Chase, Amex, Discover, etc.) |
| `cardName` | String | Required | Display name of the card product |
| `defaultAnnualFee` | Integer | Required, cents | Basis for user customization; stored as integers to avoid float precision issues |
| `cardImageUrl` | String | Required, URL | Points to CDN hosted image; normalized format for consistency |
| `createdAt` | DateTime | Auto-set | Audit timestamp for schema versioning |
| `updatedAt` | DateTime | Auto-updated | Tracks master data updates (e.g., fee changes) |

**Unique Constraint:** `(issuer, cardName)` ensures the same issuer cannot have duplicate card names.

**Indexes:**
- `issuer`: Fast filtering by bank
- `cardName`: Auto-complete / search functionality
- Composite unique index on `(issuer, cardName)` for fast lookups

**Cardinality:**
- Typically **100–500 master cards** (industry-wide offerings)
- Shared by **all users** of the application
- Grows episodically (new product launches)

---

#### MasterBenefit Model

**Entity Purpose:** Canonical definitions of benefits offered by each master card.

**Schema Definition:**

```prisma
model MasterBenefit {
  id               String   @id @default(cuid())
  masterCardId     String   // FK to MasterCard
  name             String   // e.g., "Travel Credit", "Dining Rebate"
  type             String   // Enum: 'StatementCredit' | 'UsagePerk'
  stickerValue     Int      // In cents (e.g., 30000 = $300 travel credit)
  resetCadence     String   // Enum: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  
  // Relationships
  masterCard       MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  userBenefits     UserBenefit[]  // One-to-many: benefit template used by many users
  
  // Metadata
  isActive         Boolean @default(true)  // Soft-delete for deprecated benefits
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Unique benefit identifier |
| `masterCardId` | String | Foreign Key, Required | References parent MasterCard; Cascade delete for cleanup |
| `name` | String | Required | User-facing benefit description (e.g., "Annual Travel Credit") |
| `type` | String (Enum) | Required, indexed | Two types: `StatementCredit` (cash-like) or `UsagePerk` (feature/access) |
| `stickerValue` | Integer | Required, cents | Face value of benefit (e.g., $300 travel credit = 30000 cents) |
| `resetCadence` | String (Enum) | Required, indexed | When benefit resets: `Monthly`, `CalendarYear`, `CardmemberYear` (anniversary), or `OneTime` |
| `isActive` | Boolean | Default: true | Soft delete; allows historical tracking without losing data |
| `createdAt` | DateTime | Auto-set | Schema audit trail |
| `updatedAt` | DateTime | Auto-updated | Tracks definition updates |

**Enum Values:**

```typescript
enum BenefitType {
  StatementCredit  // Dollar credit applied to statement (e.g., "$200 statement credit")
  UsagePerk        // Feature/access benefit (e.g., "Airport lounge access", "TSA PreCheck reimbursement")
}

enum ResetCadence {
  Monthly          // Resets every calendar month
  CalendarYear     // Resets Jan 1 annually
  CardmemberYear   // Resets on card anniversary (renewal date)
  OneTime          // Never resets; available once only
}
```

**Indexes:**
- `masterCardId`: Fast lookup of all benefits for a card
- `type`: Filter by statement credits vs perks
- `resetCadence`: Identify annual vs monthly benefits for renewal logic

**Cardinality:**
- **Many benefits per card** (3–15 typical; luxury cards can have 20+)
- **Total:** ~1,000–2,000 master benefits across all cards
- **Usage:** Read-heavy; written only when new card offerings launched

---

### Layer 2: User Wallet

#### User Model

**Entity Purpose:** Core user authentication and account identity.

**Schema Definition:**

```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordHash     String
  firstName        String?
  lastName         String?
  
  // Relationships
  players          Player[]     // One user can have multiple personas/profiles
  
  // Metadata
  emailVerified    Boolean @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([email])
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Account owner identity |
| `email` | String | Unique, indexed | Login credential; used for password reset |
| `passwordHash` | String | Required | Bcrypt/Argon2 hash; never stored plaintext |
| `firstName` | String | Optional | Display name |
| `lastName` | String | Optional | Display name |
| `emailVerified` | Boolean | Default: false | Controls feature access until verified |
| `createdAt` | DateTime | Auto-set | Account creation timestamp |
| `updatedAt` | DateTime | Auto-updated | Last login/update tracking |

**Cardinality:**
- **One user ↔ Many players** (same person tracking multiple profiles)
- **Example:** John owns main account + manages spouse's card benefits separately

---

#### Player Model

**Entity Purpose:** Multi-user profiles within a single User account (family plan, shared wallet scenarios).

**Schema Definition:**

```prisma
model Player {
  id               String   @id @default(cuid())
  userId           String   // FK to User
  playerName       String   // e.g., "John (Primary)", "Jane (Spouse)"
  isActive         Boolean @default(true)
  
  // Relationships
  user             User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userCards        UserCard[]   // One player owns many cards
  userBenefits     UserBenefit[]  // Player benefits (denormalized for clarity)
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([userId])
  @@unique([userId, playerName]) // Prevent duplicate profile names per user
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Unique player/profile identifier |
| `userId` | String | Foreign Key, required | Links to parent User; cascade delete |
| `playerName` | String | Required | Display name for the profile (e.g., "Me", "Spouse", "Child") |
| `isActive` | Boolean | Default: true | Soft delete; preserve historical data |
| `createdAt` | DateTime | Auto-set | Profile creation date |
| `updatedAt` | DateTime | Auto-updated | Last activity |

**Unique Constraint:** `(userId, playerName)` prevents duplicate profile names within one account.

**Cardinality:**
- **Typical:** 1–4 players per User (primary account holder + family members)
- **Maximum:** Recommended cap of 5 per User for performance

---

#### UserCard Model

**Entity Purpose:** User-owned instance of a credit card; clones data from MasterCard with customization.

**Schema Definition:**

```prisma
model UserCard {
  id               String   @id @default(cuid())
  playerId         String   // FK to Player
  masterCardId     String   // FK to MasterCard (template reference)
  
  // Cloned/Customizable Fields
  customName       String?  // User rename (e.g., "My CSR" instead of "Chase Sapphire Reserve")
  actualAnnualFee  Int?     // Overridden fee if different from default (in cents)
  renewalDate      DateTime // Card anniversary / next benefit reset
  isOpen           Boolean @default(true)  // Card is active in wallet
  
  // Relationships
  player           Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  masterCard       MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Restrict)
  userBenefits     UserBenefit[]  // One-to-many: card has many tracked benefits
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([playerId])
  @@index([masterCardId])
  @@unique([playerId, masterCardId]) // Prevent duplicate card ownership per player
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Unique user card instance |
| `playerId` | String | FK, required | Links to Player (card owner); cascade delete if player deleted |
| `masterCardId` | String | FK, required | Links to MasterCard template; restrict delete to preserve history |
| `customName` | String | Optional | User-friendly rename; if null, falls back to masterCard.cardName |
| `actualAnnualFee` | Integer | Optional, cents | Override default fee (e.g., user got fee waived); null = use default |
| `renewalDate` | DateTime | Required | Card anniversary date; triggers benefit resets |
| `isOpen` | Boolean | Default: true | Soft close; preserve benefit history when card closed |
| `createdAt` | DateTime | Auto-set | When card added to wallet |
| `updatedAt` | DateTime | Auto-updated | Last modification |

**Unique Constraint:** `(playerId, masterCardId)` ensures each player can own a given card product only once.

**Foreign Key Policies:**
- `playerId`: Cascade delete (if player deleted, cards deleted)
- `masterCardId`: Restrict delete (don't allow deleting master card if user owns it; forces archive instead)

**Cardinality:**
- **Per player:** 2–20 cards typical (varies by user sophistication)
- **Per application:** Growth with user base; expected millions at scale

---

#### UserBenefit Model

**Entity Purpose:** Claimed/tracked instances of benefits; clones MasterBenefit with user-specific tracking.

**Schema Definition:**

```prisma
model UserBenefit {
  id               String   @id @default(cuid())
  userCardId       String   // FK to UserCard
  playerId         String   // FK to Player (denormalized for query optimization)
  
  // Cloned Fields from MasterBenefit
  name             String   // Benefit name (e.g., "Travel Credit")
  type             String   // Enum: 'StatementCredit' | 'UsagePerk'
  stickerValue     Int      // In cents (original benefit value)
  resetCadence     String   // Enum: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  
  // User Customization & Tracking
  userDeclaredValue Int?    // User's estimated actual value (may differ from stickerValue)
  isUsed           Boolean @default(false)  // User has claimed/utilized this benefit
  timesUsed        Int @default(0)  // Count of resets/claims (for Monthly benefits)
  expirationDate   DateTime?  // When benefit expires (often card renewal date or specific expiration)
  
  // Relationships
  userCard         UserCard @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  player           Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  claimedAt        DateTime?  // When user marked as used
  
  // Indexes
  @@index([userCardId])
  @@index([playerId])
  @@index([type])
  @@index([isUsed])
  @@index([expirationDate])
  @@unique([userCardId, name]) // Prevent duplicate benefit tracking per card
}
```

**Field Specifications:**

| Field | Type | Constraints | Rationale |
|-------|------|-------------|-----------|
| `id` | String (CUID) | Primary Key | Unique benefit claim instance |
| `userCardId` | String | FK, required | Links to UserCard; cascade delete if card deleted |
| `playerId` | String | FK, required | Denormalized for performance (avoiding join on userCard→player) |
| `name` | String | Required | Benefit name (cloned for easy access; not a FK) |
| `type` | String (Enum) | Required, indexed | `StatementCredit` or `UsagePerk` |
| `stickerValue` | Integer | Required, cents | Original template value |
| `resetCadence` | String (Enum) | Required | `Monthly`, `CalendarYear`, `CardmemberYear`, `OneTime` |
| `userDeclaredValue` | Integer | Optional, cents | User's personal assessment of actual value; defaults to stickerValue |
| `isUsed` | Boolean | Default: false, indexed | High cardinality; used for filtering used/unused benefits |
| `timesUsed` | Integer | Default: 0 | Tracks resets (Monthly benefits reset each month within year) |
| `expirationDate` | DateTime | Optional, indexed | When benefit is no longer claimable |
| `claimedAt` | DateTime | Optional | Timestamp when user marked benefit as used |
| `createdAt` | DateTime | Auto-set | When benefit added to user's wallet |
| `updatedAt` | DateTime | Auto-updated | Last modification |

**Unique Constraint:** `(userCardId, name)` prevents duplicate tracking of same benefit per card.

**Denormalization Rationale:**
- `playerId` is denormalized (accessible via userCard→player) for performance:
  - Query: "Get all benefits for this player" avoids join through UserCard
  - Trade-off: Minor data redundancy vs. query speed

**Cardinality:**
- **Per card:** 3–20 benefits tracked
- **Per player:** 20–200 benefits total (varies by card count)
- **Per application:** Potentially 10M+ benefit records at scale

---

## Complete Prisma Schema

### Full `.prisma` File

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================================
// Layer 1: Master Catalog (Read-Only Templates)
// ============================================================

model MasterCard {
  id                 String   @id @default(cuid())
  issuer            String   // e.g., "Chase", "American Express", "Discover"
  cardName          String   // e.g., "Chase Sapphire Reserve"
  defaultAnnualFee  Int      // In cents (e.g., 55000 = $550)
  cardImageUrl      String   // CDN URL to card image
  
  // Relationships
  masterBenefits    MasterBenefit[]
  userCards         UserCard[]
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Indexes & Constraints
  @@index([issuer])
  @@index([cardName])
  @@unique([issuer, cardName])
}

model MasterBenefit {
  id               String   @id @default(cuid())
  masterCardId     String   // FK to MasterCard
  name             String   // e.g., "Travel Credit", "Dining Rebate"
  type             String   // Enum: 'StatementCredit' | 'UsagePerk'
  stickerValue     Int      // In cents
  resetCadence     String   // Enum: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  
  // Relationships
  masterCard       MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  userBenefits     UserBenefit[]
  
  // Metadata
  isActive         Boolean @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
}

// ============================================================
// Layer 2: User Wallet (Editable Clones & Tracking)
// ============================================================

model User {
  id               String   @id @default(cuid())
  email            String   @unique
  passwordHash     String
  firstName        String?
  lastName         String?
  
  // Relationships
  players          Player[]
  
  // Metadata
  emailVerified    Boolean @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes
  @@index([email])
}

model Player {
  id               String   @id @default(cuid())
  userId           String   // FK to User
  playerName       String   // e.g., "Primary", "Spouse"
  isActive         Boolean @default(true)
  
  // Relationships
  user             User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userCards        UserCard[]
  userBenefits     UserBenefit[]
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes & Constraints
  @@index([userId])
  @@unique([userId, playerName])
}

model UserCard {
  id               String   @id @default(cuid())
  playerId         String   // FK to Player
  masterCardId     String   // FK to MasterCard (template reference)
  
  // Cloned/Customizable Fields
  customName       String?  // User rename
  actualAnnualFee  Int?     // Override fee (in cents)
  renewalDate      DateTime // Card anniversary for benefit resets
  isOpen           Boolean @default(true)  // Card is active
  
  // Relationships
  player           Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  masterCard       MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Restrict)
  userBenefits     UserBenefit[]
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Indexes & Constraints
  @@index([playerId])
  @@index([masterCardId])
  @@unique([playerId, masterCardId])
}

model UserBenefit {
  id               String   @id @default(cuid())
  userCardId       String   // FK to UserCard
  playerId         String   // FK to Player (denormalized)
  
  // Cloned Fields
  name             String   // Benefit name
  type             String   // Enum: 'StatementCredit' | 'UsagePerk'
  stickerValue     Int      // Original value (cents)
  resetCadence     String   // Enum reset type
  
  // User Tracking
  userDeclaredValue Int?    // User's estimated actual value
  isUsed           Boolean @default(false)
  timesUsed        Int @default(0)  // Reset count
  expirationDate   DateTime?
  
  // Relationships
  userCard         UserCard @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  player           Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  // Metadata
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  claimedAt        DateTime?
  
  // Indexes & Constraints
  @@index([userCardId])
  @@index([playerId])
  @@index([type])
  @@index([isUsed])
  @@index([expirationDate])
  @@unique([userCardId, name])
}
```

---

## Relationship Mappings & Cardinality

### Complete Relationship Diagram

```
User (1) ──────────────────────── (N) Player
  │                                   │
  │                                   ├─── (1) ──────────────────────── (N) UserCard
  │                                   │                                      │
  │                                   │                                      ├─ FK: playerId
  │                                   │                                      ├─ FK: masterCardId ──┐
  │                                   │                                      │                     │
  │                                   └─── (1) ──────────────────────── (N) UserBenefit          │
  │                                                                              │                 │
  │                                                                              ├─ FK: playerId   │
  │                                                                              ├─ FK: userCardId │
  │                                                                              │                 │
  │                                                                              └─ Denormalized:  │
  │                                                                                  name, type,    │
  │                                                                                  stickerValue  │
  │                                                                                                │
  │                                 MasterCard (1) ◄─────────────────────────────────────────────┘
  │                                      │
  │                                      ├─ FK: issued by Issuer
  │                                      │
  │                                      └─── (1) ──────────────────────── (N) MasterBenefit
  │                                                                              │
  │                                                                              └─ Read-only
  │                                                                                 template
  │
  └─ One-to-Many: Auth & Account Identity
```

### Detailed Cardinality Matrix

| Relationship | From | To | Cardinality | Delete Cascade | Rationale |
|---|---|---|---|---|---|
| User → Player | User | Player | 1:N | YES | Multiple profiles per user (family account); delete user = delete all profiles |
| Player → UserCard | Player | UserCard | 1:N | YES | Multiple cards per player; delete player = remove their cards |
| Player → UserBenefit | Player | UserBenefit | 1:N | YES | Denormalized for performance; cleanup on player delete |
| UserCard → UserBenefit | UserCard | UserBenefit | 1:N | YES | Benefits belong to cards; card deletion = relevant benefits deleted |
| UserCard → MasterCard | UserCard | MasterCard | N:1 | RESTRICT | Many users own same master card; prevent deletion of master while in use |
| MasterCard → MasterBenefit | MasterCard | MasterBenefit | 1:N | CASCADE | Updating master card benefits requires cleanup |
| UserBenefit → MasterBenefit | None | N/A | Soft | N/A | Cloned values; no FK to maintain data independence |

---

## Constraints & Validation Rules

### Entity-Level Constraints

#### MasterCard
```
✓ UNIQUE(issuer, cardName)
  Prevents: "Chase Sapphire Reserve" appearing twice

✓ NOT NULL: issuer, cardName, defaultAnnualFee, cardImageUrl
  Ensures: Complete card profile
```

#### MasterBenefit
```
✓ NOT NULL: masterCardId, name, type, stickerValue, resetCadence
  Ensures: Complete benefit definition

✓ CHECK: stickerValue >= 0
  Prevents: Negative benefit values

✓ isActive: Soft delete for deprecated benefits
  Allows: Historical tracking
```

#### User
```
✓ UNIQUE(email)
  Prevents: Duplicate accounts

✓ NOT NULL: email, passwordHash
  Ensures: Authentication possible

✓ emailVerified: Gated feature access
  Example: Can't add cards until email verified
```

#### Player
```
✓ UNIQUE(userId, playerName)
  Prevents: Duplicate profile names within user

✓ NOT NULL: userId, playerName
  Ensures: Each profile identifiable

✓ isActive: Soft delete
  Preserves: Historical benefit tracking
```

#### UserCard
```
✓ UNIQUE(playerId, masterCardId)
  Prevents: Player owning same card twice

✓ NOT NULL: playerId, masterCardId, renewalDate
  Ensures: Proper linkage & renewal logic

✓ CHECK: actualAnnualFee IS NULL OR actualAnnualFee >= 0
  Allows: Override fee or use default

✓ isOpen: Soft close
  Preserves: Annual benefit resets even after card closed
```

#### UserBenefit
```
✓ UNIQUE(userCardId, name)
  Prevents: Duplicate benefit tracking per card

✓ NOT NULL: userCardId, playerId, name, type, stickerValue, resetCadence
  Ensures: Complete benefit instance

✓ CHECK: timesUsed >= 0
✓ CHECK: userDeclaredValue IS NULL OR userDeclaredValue >= 0
  Allows: Optional overrides

✓ isUsed: Boolean flag
  Simplifies: Queries for unclaimed benefits
```

---

## Index Strategy & Query Optimization

### Primary Indexes

| Model | Columns | Purpose | Query Performance |
|-------|---------|---------|-------------------|
| MasterCard | `issuer` | Filter cards by bank | O(log N) on 100–500 cards |
| MasterCard | `cardName` | Search/autocomplete | O(log N) on card names |
| MasterBenefit | `masterCardId` | Load benefits for card | O(log N); required by relationship |
| MasterBenefit | `type` | Filter by credit vs. perk | O(log N); separates benefit categories |
| User | `email` | Login lookup | O(log N); authentication critical |
| Player | `userId` | Load player profiles | O(log N) on user profiles |
| UserCard | `playerId` | Load wallet cards | O(log N); primary wallet query |
| UserCard | `masterCardId` | Cross-reference with master | O(log N); validates master existence |
| UserBenefit | `userCardId` | Load card benefits | O(log N); primary detail query |
| UserBenefit | `playerId` | Load all player benefits | O(log N); denormalization benefit |
| UserBenefit | `type` | Filter benefits | O(log N); category filtering |
| UserBenefit | `isUsed` | Find unclaimed benefits | O(log N); high-cardinality selector |
| UserBenefit | `expirationDate` | Expired benefit alerts | O(log N); reminder queries |

### Composite Indexes (Unique Constraints)

```sql
-- Enforced by Prisma @@unique

-- MasterCard: Prevent duplicate products
CREATE UNIQUE INDEX idx_mastercard_issuer_cardname 
  ON "MasterCard"("issuer", "cardName");

-- Player: Prevent duplicate profiles per user
CREATE UNIQUE INDEX idx_player_userid_playername 
  ON "Player"("userId", "playerName");

-- UserCard: Prevent duplicate ownership
CREATE UNIQUE INDEX idx_usercard_playerid_mastercardid 
  ON "UserCard"("playerId", "masterCardId");

-- UserBenefit: Prevent duplicate tracking
CREATE UNIQUE INDEX idx_userbenefit_usercardid_name 
  ON "UserBenefit"("userCardId", "name");
```

### Query Performance Examples

#### Fast Queries (Indexed)

```sql
-- Load user's wallet (all cards)
SELECT * FROM "UserCard" WHERE "playerId" = 'player-123';
-- Index: playerId ✓ O(log N)

-- Load card's benefits
SELECT * FROM "UserBenefit" WHERE "userCardId" = 'card-456';
-- Index: userCardId ✓ O(log N)

-- Find unclaimed benefits expiring soon
SELECT * FROM "UserBenefit" 
WHERE "isUsed" = false 
AND "expirationDate" < NOW() + INTERVAL '7 days';
-- Index: isUsed, expirationDate ✓ O(log N)

-- Filter statement credits only
SELECT * FROM "UserBenefit" 
WHERE "userCardId" = 'card-456' 
AND "type" = 'StatementCredit';
-- Index: userCardId, type ✓ O(log N)
```

#### Avoid (Slow, Unindexed)

```sql
-- ✗ Unindexed: Scans all UserBenefit rows
SELECT * FROM "UserBenefit" WHERE "name" LIKE '%Travel%';

-- ✗ Unindexed: Missing composite index
SELECT * FROM "UserCard" 
WHERE "playerId" = 'player-123' 
AND "isOpen" = true;
-- Solution: Add index on (playerId, isOpen)
```

---

## Data Integrity & Foreign Key Policies

### Referential Integrity Rules

```
┌─────────────────────────────────────────────────────────┐
│ Cascade Delete (DELETE child if parent deleted)          │
├─────────────────────────────────────────────────────────┤
│ • User → Player                                          │
│   (Delete user = delete all profiles)                   │
│ • Player → UserCard                                      │
│   (Delete profile = remove their cards)                 │
│ • Player → UserBenefit                                   │
│   (Delete profile = remove their benefits)              │
│ • UserCard → UserBenefit                                │
│   (Delete card = remove its benefits)                   │
│ • MasterCard → MasterBenefit                            │
│   (Archive master card = archive its benefits)          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Restrict Delete (Prevent deletion if child exists)       │
├─────────────────────────────────────────────────────────┤
│ • MasterCard ← UserCard                                  │
│   (Prevent deleting master if user owns it)             │
│   (Solution: Must archive master, not delete)           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ No FK Constraint (Soft Clone)                            │
├─────────────────────────────────────────────────────────┤
│ • UserBenefit → MasterBenefit                            │
│   (Values cloned; independent updates allowed)          │
│   (Allows user customization without master changes)    │
└─────────────────────────────────────────────────────────┘
```

### Transaction Integrity

**Critical Operations Requiring Atomicity:**

```typescript
// Add card to wallet (4 steps)
async function addCardToWallet(playerId, masterCardId) {
  // Must be atomic: all succeed or all roll back
  await prisma.$transaction([
    // 1. Verify master card exists
    prisma.masterCard.findUniqueOrThrow({ where: { id: masterCardId } }),
    
    // 2. Check player doesn't already own this card
    prisma.userCard.findFirst({
      where: { playerId, masterCardId }
    }),
    
    // 3. Create UserCard
    prisma.userCard.create({
      data: {
        playerId,
        masterCardId,
        renewalDate: calculateNextRenewal()
      }
    }),
    
    // 4. Clone all active benefits
    prisma.userBenefit.createMany({
      data: masterBenefits.map(benefit => ({
        userCardId: newUserCard.id,
        playerId,
        name: benefit.name,
        type: benefit.type,
        stickerValue: benefit.stickerValue,
        resetCadence: benefit.resetCadence,
        expirationDate: calculateExpiration(benefit.resetCadence)
      }))
    })
  ]);
}
```

---

## Best Practices & Design Decisions

### 1. Read-Only Master Catalog

**Decision:** MasterCard and MasterBenefit tables are write-restricted.

**Implementation:**
```typescript
// ✓ Correct: Only admin/seed operations
async function seedMasterCards() {
  await prisma.masterCard.create({
    data: { issuer: "Chase", cardName: "...", ... }
  });
}

// ✗ Prevent: Regular endpoints don't write to master
router.post('/card', (req, res) => {
  // Should not allow creating new MasterCard
  // Must edit existing master via admin panel
  const { customName } = req.body; // ← Only UserCard custom field
  await prisma.userCard.create({
    data: { customName, ... }
  });
});
```

### 2. Denormalization in UserBenefit

**Decision:** Clone benefit name, type, stickerValue from MasterBenefit rather than FK.

**Rationale:**
- **Immutability:** User's benefit definition frozen at claim time
- **Performance:** No JOIN required to display benefit details
- **Flexibility:** User can override stickerValue via userDeclaredValue without master changes
- **Audit:** Historical record of what user believed benefit was worth

**Trade-off:**
- Minor data redundancy (same name/type repeated)
- Mitigated: Benefit names are short strings; storage negligible

### 3. Soft Delete Pattern

**Decision:** Use `isActive`/`isOpen`/`isUsed` booleans instead of physical deletion.

**Rationale:**
```
✓ Preserves historical data: Calculate YoY benefit redemption
✓ Simplifies recovery: User re-opens closed card
✓ Audit trail: Understand why user closed card
✓ Referential integrity: Child records remain valid
```

**Implementation:**
```typescript
// Fetch active cards only (default)
const wallet = prisma.userCard.findMany({
  where: { playerId, isOpen: true }
});

// Archive card (not delete)
await prisma.userCard.update({
  where: { id: cardId },
  data: { isOpen: false }
});
```

### 4. Enum Types

**Decision:** Store enums as strings (not integer codes).

**Rationale:**
- **Readability:** Queries show 'StatementCredit', not 1
- **Maintainability:** No mapping table required
- **Type safety:** Enforced at application layer via TypeScript/Enum

**Prisma+TypeScript:**
```typescript
enum BenefitType {
  StatementCredit = "StatementCredit",
  UsagePerk = "UsagePerk"
}

// Validated at insert
await prisma.userBenefit.create({
  data: {
    type: BenefitType.StatementCredit // Type-safe
  }
});
```

### 5. Renewal Date Strategy

**Decision:** Store explicit `renewalDate` on UserCard (not derived from master).

**Rationale:**
```
✓ Users can have different anniversary dates
  (card 1 renewed Jan 15, card 2 renewed Mar 3)
  
✓ Benefit reset logic simplified:
  - Monthly: Reset on 1st of each month
  - CardmemberYear: Reset on renewalDate
  - CalendarYear: Reset on Jan 1
  - OneTime: Never reset
  
✓ Avoids complex date arithmetic in queries
```

### 6. Value Storage (Cents, Not Dollars)

**Decision:** All monetary fields stored as integers (cents).

**Rationale:**
```
✓ Avoids floating-point precision errors
  (0.1 + 0.2 ≠ 0.3 in floats)
  
✓ Consistent with financial software standards
  (database stores 30000 = $300.00)
  
✓ Simplifies calculations
  (annual fee: 55000 cents / 12 = 4583.33 per month)
```

**Display Layer:**
```typescript
function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
// formatCents(30000) → "$300.00"
```

### 7. Denormalized PlayerId in UserBenefit

**Decision:** Store `playerId` in UserBenefit even though accessible via UserCard→Player.

**Rationale:**
```
❌ Without FK: Requires JOIN to query
   SELECT ub.* FROM user_benefit ub
     JOIN user_card uc ON ub.user_card_id = uc.id
     WHERE uc.player_id = 'player-123'  -- Slow

✓ With FK: Direct query
   SELECT * FROM user_benefit 
   WHERE player_id = 'player-123'  -- Fast, indexed
```

**Trade-off:** Maintain data consistency on UserCard→Player changes (in application logic).

---

## Migration & Deployment Strategy

### Phase 1: Schema Creation

```bash
# Generate migration
npx prisma migrate dev --name init_schema

# Verifies:
- All tables created
- Indexes applied
- Constraints enforced
```

### Phase 2: Seed Master Data

```typescript
// prisma/seed.ts
async function seedMasterCatalog() {
  const chase = await prisma.masterCard.create({
    data: {
      issuer: "Chase",
      cardName: "Chase Sapphire Reserve",
      defaultAnnualFee: 55000, // $550
      cardImageUrl: "https://cdn.example.com/csr.jpg",
      masterBenefits: {
        create: [
          {
            name: "Travel Credit",
            type: "StatementCredit",
            stickerValue: 30000, // $300
            resetCadence: "CardmemberYear"
          },
          // ... more benefits
        ]
      }
    }
  });
}

// Run seed
npx prisma db seed
```

### Phase 3: Backfill User Data

```typescript
// If migrating from legacy system:
async function backfillUserCards() {
  const legacyCards = await legacyDB.getUserCards();
  
  for (const legacy of legacyCards) {
    const masterCard = await prisma.masterCard.findFirst({
      where: {
        issuer: legacy.issuer,
        cardName: legacy.cardName
      }
    });
    
    const userCard = await prisma.userCard.create({
      data: {
        playerId: legacy.userId, // Map to Player ID
        masterCardId: masterCard.id,
        customName: legacy.customName,
        renewalDate: legacy.renewalDate,
        isOpen: legacy.isOpen
      }
    });
    
    // Clone benefits
    await prisma.userBenefit.createMany({
      data: legacy.benefits.map(b => ({
        userCardId: userCard.id,
        playerId: legacy.userId,
        name: b.name,
        type: b.type,
        // ...
      }))
    });
  }
}
```

---

## Performance Monitoring

### Key Metrics

| Metric | Target | Query |
|--------|--------|-------|
| Load wallet (10 cards) | < 100ms | SELECT * FROM UserCard WHERE playerId = ? |
| Load card benefits (avg 8 per card) | < 50ms | SELECT * FROM UserBenefit WHERE userCardId = ? |
| List annual renewal benefits | < 200ms | SELECT * FROM UserBenefit WHERE renewalDate BETWEEN now AND +30d |
| Add card + clone benefits | < 500ms | 4-statement transaction |

### Monitoring Queries

```sql
-- Check index usage
SELECT * FROM pg_stat_user_indexes 
WHERE idx_scan = 0  -- Unused indexes
ORDER BY idx_blks_read DESC;

-- Monitor query performance
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%UserBenefit%'
ORDER BY mean_time DESC;
```

---

## Summary & Implementation Checklist

### Schema Components Checklist

- [x] **MasterCard:** 4 fields + 3 relationships + indexes + unique constraint
- [x] **MasterBenefit:** 5 fields + 2 relationships + indexes + soft delete
- [x] **User:** 4 fields + relationships + email unique
- [x] **Player:** 3 fields + relationships + composite unique constraint
- [x] **UserCard:** 6 fields + relationships + unique constraint + cascade/restrict policies
- [x] **UserBenefit:** 10 fields + relationships + indexes + unique constraint + denormalization

### Relationship Completeness

- [x] User ↔ Player (1:N, cascade)
- [x] Player ↔ UserCard (1:N, cascade)
- [x] Player ↔ UserBenefit (1:N, cascade, denormalized)
- [x] UserCard ↔ UserBenefit (1:N, cascade)
- [x] UserCard ↔ MasterCard (N:1, restrict)
- [x] MasterCard ↔ MasterBenefit (1:N, cascade)

### Constraints & Indexes

- [x] Unique constraints prevent duplicates
- [x] Foreign keys enforce referential integrity
- [x] Indexes optimize common queries
- [x] Check constraints validate data ranges
- [x] Soft deletes preserve historical data

### Dual-Layer Design Validation

- [x] Master Catalog is read-only (seed-only writes)
- [x] User Wallet is fully editable
- [x] Cloning strategy defined (MasterBenefit →UserBenefit)
- [x] Customization fields identified (customName, actualAnnualFee, userDeclaredValue)
- [x] Immutability via cloning maintained

---

## Next Steps

### For Full-Stack Engineer

1. **Generate Prisma Client:** `npx prisma generate`
2. **API Endpoints:** Implement CRUD operations for each model
3. **Service Layer:** Business logic for adding cards, claiming benefits, renewals
4. **Validation:** Type-safe input validation using Prisma types

### For QA Specialist

1. **Schema Tests:** Verify constraints (unique, FK, check constraints)
2. **Data Integrity:** Test cascade/restrict delete behavior
3. **Performance:** Benchmark queries against index strategy
4. **Edge Cases:** Soft deletes, denormalized playerId consistency

### For DevOps Engineer

1. **Database Setup:** PostgreSQL with appropriate connection pooling
2. **Migrations:** Plan migration strategy for legacy data
3. **Backup Strategy:** Ensure ACID compliance and point-in-time recovery
4. **Monitoring:** Query performance and index utilization

---

**Document Status:** APPROVED FOR IMPLEMENTATION  
**Last Updated:** 2026-03-31
