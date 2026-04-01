# Quick Reference: Credit Card Benefits Tracker Database

## Database Models at a Glance

### 🏢 Master Catalog (Read-Only Templates)

#### MasterCard
```typescript
{
  id: string                    // Card ID (CUID)
  issuer: string               // e.g., "Chase", "American Express"
  cardName: string             // e.g., "Sapphire Reserve"
  defaultAnnualFee: number     // In cents (55000 = $550)
  cardImageUrl: string         // CDN URL to card image
  createdAt: Date              // Auto-set
  updatedAt: Date              // Auto-updated
  
  // Relations
  masterBenefits: MasterBenefit[]
  userCards: UserCard[]
}
```

#### MasterBenefit
```typescript
{
  id: string                    // Benefit ID (CUID)
  masterCardId: string         // FK to MasterCard
  name: string                 // e.g., "Travel Credit"
  type: "StatementCredit"      // or "UsagePerk"
  stickerValue: number         // In cents (30000 = $300)
  resetCadence: "CalendarYear" // Options: Monthly, CalendarYear, CardmemberYear, OneTime
  isActive: boolean            // Default: true (soft delete)
  createdAt: Date
  updatedAt: Date
  
  // Relations
  masterCard: MasterCard
  userBenefits: UserBenefit[]
}
```

---

### 👥 User Wallet (Editable Clones & Tracking)

#### User
```typescript
{
  id: string                    // User ID (CUID)
  email: string                // Unique email for login
  passwordHash: string         // Bcrypt hash (never plain text!)
  firstName?: string
  lastName?: string
  emailVerified: boolean       // Default: false
  createdAt: Date
  updatedAt: Date
  
  // Relations
  players: Player[]
}
```

#### Player
```typescript
{
  id: string                    // Player ID (CUID)
  userId: string               // FK to User
  playerName: string           // e.g., "Primary", "Spouse", "Jon"
  isActive: boolean            // Default: true
  createdAt: Date
  updatedAt: Date
  
  // Relations
  user: User
  userCards: UserCard[]
  userBenefits: UserBenefit[]
}
```

#### UserCard
```typescript
{
  id: string                    // Card instance ID (CUID)
  playerId: string             // FK to Player (who owns this card)
  masterCardId: string         // FK to MasterCard (which card template)
  customName?: string          // e.g., "My Amex Gold", "CSR - Jon"
  actualAnnualFee?: number     // Override fee in cents (null = use default)
  renewalDate: Date            // Card anniversary (triggers benefit resets)
  isOpen: boolean              // Default: true (false = soft-closed)
  createdAt: Date
  updatedAt: Date
  
  // Relations
  player: Player
  masterCard: MasterCard
  userBenefits: UserBenefit[]
}
```

#### UserBenefit
```typescript
{
  id: string                    // Benefit claim ID (CUID)
  userCardId: string           // FK to UserCard (which card)
  playerId: string             // FK to Player (denormalized for perf)
  
  // Cloned from MasterBenefit
  name: string                 // e.g., "Travel Credit"
  type: "StatementCredit"      // or "UsagePerk"
  stickerValue: number         // Original value in cents
  resetCadence: "CalendarYear" // When it resets
  
  // User-specific tracking
  userDeclaredValue?: number   // Custom valuation in cents (e.g., "$250 instead of $300")
  isUsed: boolean              // Default: false (have you claimed it?)
  timesUsed: number            // Default: 0 (how many times reset/used)
  expirationDate?: Date        // When benefit expires
  claimedAt?: Date             // When user marked as used
  
  createdAt: Date
  updatedAt: Date
  
  // Relations
  userCard: UserCard
  player: Player
}
```

---

## Common Queries

### Get User's Wallet
```typescript
const wallet = await prisma.userCard.findMany({
  where: { playerId: "player-123" },
  include: {
    masterCard: { include: { masterBenefits: true } },
    userBenefits: true,
  },
});
```

### Get Unclaimed Benefits
```typescript
const unclaimed = await prisma.userBenefit.findMany({
  where: {
    playerId: "player-123",
    isUsed: false,
    expirationDate: { gt: new Date() }, // Not expired
  },
});
```

### Search Master Cards
```typescript
const cards = await prisma.masterCard.findMany({
  where: {
    issuer: { contains: "Chase", mode: "insensitive" },
  },
  include: { masterBenefits: true },
});
```

### Add Card to Player's Wallet
```typescript
const userCard = await prisma.userCard.create({
  data: {
    playerId: "player-123",
    masterCardId: "card-456",
    customName: "My CSR",
    renewalDate: new Date("2025-12-15"),
  },
});
```

### Claim a Benefit
```typescript
const claimed = await prisma.userBenefit.update({
  where: { id: "benefit-789" },
  data: {
    isUsed: true,
    claimedAt: new Date(),
    timesUsed: { increment: 1 },
  },
});
```

---

## Key Constraints

| Model | Constraint | Reason |
|-------|-----------|--------|
| MasterCard | UNIQUE(issuer, cardName) | Can't have duplicate cards from same issuer |
| Player | UNIQUE(userId, playerName) | Can't have duplicate profile names per user |
| UserCard | UNIQUE(playerId, masterCardId) | Player can't own same card twice |
| UserBenefit | UNIQUE(userCardId, name) | Can't track same benefit twice on a card |

---

## Reset Cadence Meanings

| Cadence | Meaning | Example |
|---------|---------|---------|
| `Monthly` | Resets every calendar month | Dining credit valid Jan 1-31, Feb 1-28, etc. |
| `CalendarYear` | Resets Jan 1 annually | Travel credit valid Jan 1 - Dec 31 |
| `CardmemberYear` | Resets on card anniversary | Resets on renewal date (card anniversary) |
| `OneTime` | Never resets | Welcome bonus, once-per-year only |

---

## Benefit Types

| Type | Meaning | Example |
|------|---------|---------|
| `StatementCredit` | Dollar credit applied to bill | "$300 travel credit" |
| `UsagePerk` | Feature/access benefit | "Airport lounge access", "TSA PreCheck reimbursement" |

---

## Money Fields (All in Cents!)

Always store and transfer money as **integers representing cents**:

```typescript
// ✅ CORRECT
defaultAnnualFee: 55000   // $550.00
stickerValue: 30000       // $300.00
userDeclaredValue: 25000  // $250.00

// ❌ NOT CORRECT (floating point errors!)
defaultAnnualFee: 550.00
stickerValue: 300.00

// Convert in frontend
const dollars = cents / 100;  // 30000 / 100 = 300
const formatted = `$${(cents / 100).toFixed(2)}`;  // "$300.00"
```

---

## Relationship Overview

```
User (1) ──N── Player (1) ──N── UserCard (1) ──N── UserBenefit
              │                      │
              │                      └──> MasterCard (1) ──N── MasterBenefit
              │
              └──────────────N────────────> UserBenefit
```

- **User**: Holds authentication & account data
- **Player**: Sub-account within User (for multi-person households)
- **UserCard**: Player's owned card (cloned from MasterCard with customizations)
- **UserBenefit**: Claimed benefit linked to a UserCard + Player
- **MasterCard**: Template/catalog entry (shared by all users)
- **MasterBenefit**: Template benefit (shared by all users)

---

## Delete Policies

| Relationship | On Delete | Effect |
|---|---|---|
| User → Player | CASCADE | Delete user = delete all their profiles |
| Player → UserCard | CASCADE | Delete player = delete their cards |
| Player → UserBenefit | CASCADE | Delete player = delete their benefits |
| UserCard → UserBenefit | CASCADE | Delete card = delete its benefits |
| UserCard → MasterCard | RESTRICT | Can't delete master if users own it |
| MasterCard → MasterBenefit | CASCADE | Delete master = delete its benefits |

---

## Tips for Development

### ✅ DO
- ✅ Always include relationships in queries when needed
- ✅ Use `where` conditions to filter at database level
- ✅ Store money as cents (integers)
- ✅ Check `expirationDate` when showing benefits to users
- ✅ Use `userDeclaredValue` if it exists, else fall back to `stickerValue`
- ✅ Soft delete by setting `isOpen: false` instead of deleting cards
- ✅ Create a new Player for each family member

### ❌ DON'T
- ❌ Don't create duplicate UserCard entries for same player + card
- ❌ Don't delete MasterCard if active UserCard instances exist
- ❌ Don't use floating-point numbers for money
- ❌ Don't modify MasterCard/MasterBenefit from user actions
- ❌ Don't assume all players belong to same user without checking
- ❌ Don't forget to include `playerId` when creating UserBenefit (denormalized)

---

## Environment Variables

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/card_benefits"
NODE_ENV=development
```

---

## Generated With Prisma v5.8.0

For full documentation: https://www.prisma.io/docs/
