# Prisma Schema Documentation

## Overview

This `schema.prisma` file implements a **dual-layer database architecture** for the Credit Card Benefits Tracker application. The design separates master catalog data (read-only templates) from user-editable wallet data.

## Architecture Layers

### Layer 1: Master Catalog (Read-Only Templates)

The master catalog stores canonical definitions of credit cards and their standard benefits:

- **MasterCard**: Represents a credit card product (e.g., "Chase Sapphire Reserve")
  - Fields: `id`, `issuer`, `cardName`, `defaultAnnualFee`, `cardImageUrl`
  - Serves as a template referenced by all users

- **MasterBenefit**: Represents a benefit offered by a MasterCard (e.g., "Travel Credit")
  - Fields: `id`, `masterCardId`, `name`, `type`, `stickerValue`, `resetCadence`
  - Types: `StatementCredit` or `UsagePerk`
  - Reset cadences: `Monthly`, `CalendarYear`, `CardmemberYear`, `OneTime`

### Layer 2: User Wallet (Editable Clones & Tracking)

The user wallet stores user-specific data and benefit tracking:

- **User**: Authentication and account identity
  - Standard user model with email-based login

- **Player**: Multi-user profiles within a User account (e.g., "Jon", "Allie")
  - Enables family account scenarios
  - Each player owns their own cards and benefits

- **UserCard**: A cloned instance of a MasterCard owned by a Player
  - Fields: `id`, `playerId`, `masterCardId`, `customName`, `actualAnnualFee`, `renewalDate`, `isOpen`
  - Allows users to customize card name, override annual fee, and set renewal dates
  - One player cannot own the same card twice

- **UserBenefit**: A cloned instance of a MasterBenefit linked to a UserCard
  - Tracks user claims and customizations
  - Fields: `id`, `userCardId`, `playerId`, `name`, `type`, `stickerValue`, `userDeclaredValue`, `resetCadence`, `isUsed`, `timesUsed`, `expirationDate`
  - Users can set custom valuations for benefits

## Key Relationships

```
User (1) ──N── Player (1) ──N── UserCard (1) ──N── UserBenefit
                 │
                 └──N── UserBenefit (denormalized)

                                    ↓ references
                            
                            MasterCard (1) ──N── MasterBenefit
```

## Foreign Key Policies

| Relationship | Delete Policy | Rationale |
|---|---|---|
| User → Player | CASCADE | Deleting a user deletes all their profiles |
| Player → UserCard | CASCADE | Deleting a player deletes their cards |
| Player → UserBenefit | CASCADE | Cleaning up denormalized benefits |
| UserCard → UserBenefit | CASCADE | Deleting a card removes its benefits |
| UserCard → MasterCard | RESTRICT | Prevents deleting a master card while users own it |
| MasterCard → MasterBenefit | CASCADE | Updating master cards cleans up benefits |

## Indexes

All indexes are configured for optimal query performance:

- **MasterCard**: Indexed on `issuer`, `cardName`, and unique constraint on `(issuer, cardName)`
- **MasterBenefit**: Indexed on `masterCardId`, `type`, `resetCadence`
- **User**: Indexed on `email` (authentication)
- **Player**: Indexed on `userId`, unique constraint on `(userId, playerName)`
- **UserCard**: Indexed on `playerId`, `masterCardId`, unique constraint on `(playerId, masterCardId)`
- **UserBenefit**: Indexed on `userCardId`, `playerId`, `type`, `isUsed`, `expirationDate`, unique constraint on `(userCardId, name)`

## Getting Started

### 1. Set up environment

Copy `.env.example` to `.env` and configure your PostgreSQL connection:

```bash
cp .env.example .env
```

Update `DATABASE_URL` with your PostgreSQL credentials.

### 2. Install dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Initialize the database

Create an initial migration:

```bash
npx prisma migrate dev --name init
```

This command:
- Creates a migration file in `prisma/migrations/`
- Applies the migration to your database
- Generates the Prisma Client

### 4. Generate Prisma Client

```bash
npx prisma generate
```

This creates `node_modules/@prisma/client` with TypeScript types for all models.

### 5. View database (optional)

Open Prisma Studio to browse your database:

```bash
npx prisma studio
```

## Usage in Code

### TypeScript/JavaScript

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create a master card
const card = await prisma.masterCard.create({
  data: {
    issuer: 'Chase',
    cardName: 'Sapphire Reserve',
    defaultAnnualFee: 55000, // $550 in cents
    cardImageUrl: 'https://cdn.example.com/cards/sapphire.png',
  },
});

// Create a benefit for that card
const benefit = await prisma.masterBenefit.create({
  data: {
    masterCardId: card.id,
    name: 'Travel Credit',
    type: 'StatementCredit',
    stickerValue: 30000, // $300 in cents
    resetCadence: 'CalendarYear',
  },
});

// User adds a card to their wallet
const userCard = await prisma.userCard.create({
  data: {
    playerId: 'player-123',
    masterCardId: card.id,
    customName: 'My CSR',
    renewalDate: new Date('2024-12-15'),
    isOpen: true,
  },
});

// Track a benefit claim
const userBenefit = await prisma.userBenefit.create({
  data: {
    userCardId: userCard.id,
    playerId: 'player-123',
    name: 'Travel Credit',
    type: 'StatementCredit',
    stickerValue: 30000,
    userDeclaredValue: 25000, // "I value this at $250"
    resetCadence: 'CalendarYear',
    isUsed: false,
    expirationDate: new Date('2025-12-31'),
  },
});

// Query user's wallet
const wallet = await prisma.userCard.findMany({
  where: { playerId: 'player-123' },
  include: {
    masterCard: true,
    userBenefits: true,
  },
});

// Find unclaimed benefits
const unclaimed = await prisma.userBenefit.findMany({
  where: {
    playerId: 'player-123',
    isUsed: false,
    expirationDate: {
      gt: new Date(),
    },
  },
});
```

## Data Integrity Notes

1. **Unique Constraints**: Prevent duplicate ownership
   - One player cannot own the same card twice
   - One card cannot appear twice in the master catalog for the same issuer

2. **Soft Deletes**: Preserved for audit trails
   - `MasterBenefit.isActive`
   - `Player.isActive`
   - `UserCard.isOpen`

3. **Denormalization**: UserBenefit includes `playerId` for query optimization
   - Allows fast "get all player benefits" without joining through UserCard
   - Maintains referential integrity with CASCADE delete

4. **Money in Cents**: All currency fields use integers (cents) to avoid floating-point precision issues
   - `$550` → `55000` cents
   - `$300` → `30000` cents

## Schema Evolution

To modify the schema:

1. Update `prisma/schema.prisma`
2. Create a migration:
   ```bash
   npx prisma migrate dev --name description_of_changes
   ```
3. Review the migration in `prisma/migrations/`
4. Commit migration files to version control

## For More Information

- Full specification: [`.github/specs/card-benefits-schema-spec.md`](../../.github/specs/card-benefits-schema-spec.md)
- Prisma documentation: https://pris.ly/d/prisma-schema
- Prisma best practices: https://pris.ly/d/best-practices
