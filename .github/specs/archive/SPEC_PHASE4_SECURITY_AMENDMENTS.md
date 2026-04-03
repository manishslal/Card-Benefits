# Phase 4 Security Amendments - Cross-Cutting Specifications

**Date:** April 2, 2026
**Version:** 1.0
**Status:** Critical amendments required before implementation

---

## Executive Summary

This document addresses critical security gaps identified in Phase 4 specifications that span multiple features (Import/Export, Email Alerts, Card Management, and Custom Values). These amendments must be integrated into respective specification files before implementation begins.

**Critical Issues Addressed:**
1. Timezone & DST Handling (Issue #3)
2. Authorization Scope Clarity (Issue #5)
3. Duplicate Detection Logic (Issue #6)

---

## Issue #3: Timezone & DST Handling - Complete Specification

### 3.1 Timezone Storage & Management

#### 3.1.1 Timezone Identifier Format

**Requirement:** All user timezones MUST be stored using IANA timezone identifiers (not UTC offsets).

```
Valid formats:
- "America/New_York"
- "Europe/London"
- "Asia/Tokyo"
- "Australia/Sydney"

Invalid formats (DO NOT USE):
- "UTC-5"
- "EST"
- "+05:00"
```

**Rationale:** IANA identifiers automatically handle DST transitions, UTC offsets do not.

#### 3.1.2 Storage Location

**Database Tables:**
- `User.timezone: String` - User's preferred timezone (IANA format, default: "UTC")
- `UserEmailPreferences.timezone: String` - Email alert timezone (can differ from user timezone for different devices)
- Both fields are required, non-nullable

**Example:**
```sql
-- User in New York gets alerts in New York time
INSERT INTO "User" (id, email, timezone, ...)
VALUES ('user-123', 'user@example.com', 'America/New_York', ...);

-- But might want digest emails at London time
INSERT INTO "UserEmailPreferences" (userId, timezone, ...)
VALUES ('user-123', 'Europe/London', ...);
```

#### 3.1.3 Default Timezone

**Requirement:** Default timezone MUST be "UTC" for all users/preferences.

When user first signs up:
- Set `User.timezone = "UTC"`
- Set `UserEmailPreferences.timezone = "UTC"`
- Prompt user to set their actual timezone during onboarding
- Store timezone change history for audit trail

### 3.2 DST Transition Handling

#### 3.2.1 Spring Forward Transition (e.g., March 10, 2024)

**Scenario:** Renewal alert scheduled for 2:30 AM EST on DST transition day

In "America/New_York":
- 2:00 AM EST exists
- 2:30 AM does NOT exist (clock jumps to 3:00 AM EDT)
- 3:00 AM EDT exists

**Handling:**
1. When DST transition occurs, adjust alert time to next valid time
2. If scheduled for 2:30 AM and DST skip happens:
   - Alert MUST be sent at 3:00 AM EDT (not skipped)
   - Log: "Alert adjusted from 2:30 AM EST to 3:00 AM EDT due to DST forward transition"
3. User perceives: Alert received at normal time

**Implementation:**
```typescript
// When scheduling alert for DST transition day:
function scheduleAlertWithDSTHandling(
  scheduledTime: Date,
  timezone: string
): Date {
  // Use date-fns-tz or similar
  const localized = toZonedTime(scheduledTime, timezone);

  // Check if time exists in timezone
  if (!isValidTimeInTimezone(localized, timezone)) {
    // Move to next valid time (usually +1 hour)
    const adjusted = new Date(localized.getTime() + 60 * 60 * 1000);
    logAdjustment(scheduledTime, adjusted, timezone, 'DST_FORWARD');
    return adjusted;
  }

  return localized;
}
```

#### 3.2.2 Fall Back Transition (e.g., November 3, 2024)

**Scenario:** Renewal alert scheduled for 1:30 AM EDT on DST transition day

In "America/New_York":
- 1:00 AM EDT exists (before transition)
- 1:30 AM occurs TWICE (EDT, then EST after clock falls back)
- 2:00 AM EDT exists

**Handling:**
1. When DST transition occurs, use the FIRST occurrence (EDT)
2. Log which occurrence was used
3. If user has 2 alerts in that hour, send both (don't deduplicate)

**Implementation:**
```typescript
// When DST transition creates ambiguous time:
function resolveAmbiguousDSTTime(
  scheduledTime: Date,
  timezone: string,
  preference: 'first' | 'last' = 'first'
): Date {
  // 'first' = before transition (EDT)
  // 'last' = after transition (EST)

  if (preference === 'first') {
    // Add transitions to keep EDT version
    return toZonedTime(scheduledTime, timezone);
  } else {
    // Adjust for EST version (add 1 hour after transition)
    return new Date(scheduledTime.getTime() + 60 * 60 * 1000);
  }
}
```

#### 3.2.3 Test Cases for DST

**Test Case 1: Spring Forward (Mar 10, 2024)**
```
timezone: "America/New_York"
scheduled_time: 2024-03-10 02:30:00 (EST)
expected_time: 2024-03-10 03:00:00 (EDT)
reason: 2:30 AM doesn't exist
```

**Test Case 2: Fall Back (Nov 3, 2024)**
```
timezone: "America/New_York"
scheduled_time: 2024-11-03 01:30:00 (EDT)
expected_time: 2024-11-03 01:30:00 (EDT - first occurrence)
reason: Use first occurrence, not second
```

**Test Case 3: Different Timezone**
```
timezone: "Europe/London"
scheduled_time: 2024-03-31 01:30:00 (GMT)
expected_time: 2024-03-31 02:00:00 (BST)
reason: Clocks spring forward at 1 AM GMT → 2 AM BST
```

**Test Case 4: No DST Change**
```
timezone: "Asia/Tokyo"
scheduled_time: 2024-06-15 14:30:00 (JST)
expected_time: 2024-06-15 14:30:00 (JST)
reason: Japan doesn't observe DST
```

### 3.3 Timezone Change Handling

#### 3.3.1 When User Changes Timezone

**Requirement:** When user updates their timezone setting, all future scheduled alerts MUST be recalculated.

**Process:**
1. User updates `User.timezone` from "America/New_York" to "Europe/London"
2. System identifies all pending alerts in old timezone
3. For each pending alert:
   - Convert wall-clock time to UTC
   - Re-interpret in new timezone
   - Update scheduled time
   - Log change with reason
4. Email user: "Timezone changed from Eastern to London. Your alerts will now arrive at [new times]"

**Example:**
```
OLD: Renewal alert scheduled for 2024-04-15 10:00 AM EDT
    = 2024-04-15 14:00 UTC

NEW: Same instant in London time = 2024-04-15 3:00 PM BST (British Summer Time)
    Alert will now trigger at 15:00 BST (wall clock time)

User experiences: Alert shifted from 10 AM to 3 PM in their new timezone
```

#### 3.3.2 Partial Timezone Changes

**Scenario:** Multi-player household where members have different timezones

**Rule:** Timezone change ONLY affects that user's alerts, not household alerts.

```sql
-- User A (New York) and User B (London) in same household
-- Each has their own timezone and email preferences

User A:
  timezone: "America/New_York"
  email_preferences.timezone: "America/New_York"

User B:
  timezone: "Europe/London"
  email_preferences.timezone: "Europe/London"

-- Each gets alerts at their own time
-- Alert for shared card: sent to both at appropriate times for each user
```

### 3.4 UTC Storage & Display Conversion

#### 3.4.1 Database Storage Rule

**Requirement:** All timestamps MUST be stored in UTC in the database.

```sql
-- Correct
created_at: "2024-04-15T14:30:00Z"  -- UTC, Z suffix
scheduled_alert_time: "2024-04-15T14:30:00Z"  -- UTC

-- Incorrect
created_at: "2024-04-15T10:30:00-04:00"  -- Timezone-aware (don't store this)
```

#### 3.4.2 Display Conversion Rule

**Requirement:** Convert UTC timestamps to user's timezone only when displaying to user.

```typescript
// Service function for alert time display
function formatAlertTimeForUser(
  utcTime: Date,
  userTimezone: string
): string {
  // Convert UTC → user's timezone
  const userTime = toZonedTime(utcTime, userTimezone);

  // Format: "Monday, April 15 at 10:30 AM EDT"
  return format(
    userTime,
    "EEEE, MMMM d 'at' h:mm a zzz",
    { timeZone: userTimezone }
  );
}

// Example
const utcTime = new Date("2024-04-15T14:30:00Z");
const newyorkDisplay = formatAlertTimeForUser(utcTime, "America/New_York");
// Result: "Monday, April 15 at 10:30 AM EDT"

const londonDisplay = formatAlertTimeForUser(utcTime, "Europe/London");
// Result: "Monday, April 15 at 3:30 PM BST"
```

#### 3.4.3 Renewal Date Handling

**Special Rule:** Card renewal dates MAY be stored without time component.

```sql
-- Renewal date (date only, no time)
renewal_date: "2024-04-15"  -- Just date, no timezone needed

-- But renewal alert timestamp IS timezone-aware
renewal_alert_scheduled: "2024-04-14T22:00:00Z"  -- 24 hours before, in UTC
```

When displaying renewal countdown:
```typescript
// "Your card renews in 42 days" - uses wall clock date only
function calculateRenewalCountdown(renewalDate: string, userTimezone: string): string {
  const now = new Date();
  const today = toZonedTime(now, userTimezone).toDateString();
  const renewal = new Date(renewalDate).toDateString();

  const daysUntil = Math.ceil(
    (new Date(renewal).getTime() - new Date(today).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return `Your card renews in ${daysUntil} days`;
}
```

### 3.5 Email Alert Timezone Integration

**Requirement:** Email alerts MUST be sent at user's preferred timezone + time, not server time.

```typescript
// Email alert scheduling
async function scheduleEmailAlert(
  benefitId: string,
  userEmailPref: UserEmailPreferences,
  alertType: 'EXPIRATION' | 'RENEWAL'
) {
  // User's email preference timezone (may differ from their main timezone)
  const timezone = userEmailPref.timezone; // "America/New_York"

  // Calculate when to send in user's timezone
  // Example: "Send at 8:00 AM on expiration day"
  const sendTime = calculateAlertTime(alertType, userEmailPref, timezone);

  // Convert to UTC for storage
  const utcSendTime = toUtc(sendTime, timezone);

  // Schedule job with UTC time
  await scheduleJob({
    userId: userEmailPref.userId,
    scheduledAt: utcSendTime,
    timezone: timezone,  // Track original timezone for audit
    ...
  });
}
```

### 3.6 Timezone Testing Requirements

All Phase 4 features with timezone handling MUST include:

1. **Unit Tests:**
   - DST forward transition (3 timezones minimum)
   - DST backward transition (3 timezones minimum)
   - No-DST timezone (1 timezone: Asia/Tokyo)
   - Timezone change handling
   - UTC ↔ local conversion accuracy

2. **Integration Tests:**
   - End-to-end alert scheduling across DST boundaries
   - Email sent at correct time for user's timezone
   - Renewal date countdown accuracy across DST
   - Multi-timezone household handling

3. **Edge Case Tests:**
   - User at DST boundary (2:00 AM transition)
   - Email preference differs from user timezone
   - Timezone change with pending alerts
   - Timezone update during DST transition

---

## Issue #5: Authorization Scope Clarity - Complete Specification

### 5.1 Authorization Model Overview

**Role Definitions:**
- **Owner:** User who created the account, can manage all settings and player permissions
- **Admin:** Can create players, manage all data (if delegated)
- **Editor/Contributor:** Can add/modify cards and benefits for assigned player
- **Viewer:** Read-only access to assigned player's data
- **Guest:** No access (invited but not yet accepted)

### 5.2 Multi-Player Household Authorization Rules

#### 5.2.1 Card Import Authorization

**Rule: Who can import cards?**

```
Import new cards (to wallet):
  ✓ Owner: Can import for themselves or any household member
  ✓ Player (contributor): Can import for own wallet only
  ✗ Viewer: Cannot import (read-only)
  ✗ Guest: Cannot import (no access)

Import MasterCard templates (admin function):
  ✓ Owner: Can add to master catalog
  ✗ All others: Cannot modify master catalog
```

**Authorization Check:**
```typescript
async function authorizeCardImport(
  importingUser: User,
  targetPlayer: Player,
  importSource: 'SELF' | 'HOUSEHOLD_MEMBER' | 'MASTER_CATALOG'
): Promise<boolean> {
  // Verify user is in household
  const userInHousehold = await verifyUserInHousehold(
    importingUser.id,
    targetPlayer.household.id
  );
  if (!userInHousehold) return false;

  // Check role for import type
  const userRole = await getUserRoleInHousehold(
    importingUser.id,
    targetPlayer.householdId
  );

  if (importSource === 'SELF') {
    // Can only import to own wallet
    return importingUser.id === targetPlayer.userId;
  } else if (importSource === 'HOUSEHOLD_MEMBER') {
    // Can import to other player's wallet if Editor+
    return ['OWNER', 'ADMIN', 'EDITOR'].includes(userRole);
  } else if (importSource === 'MASTER_CATALOG') {
    // Only owner can add master cards
    return userRole === 'OWNER';
  }

  return false;
}
```

#### 5.2.2 Benefit Custom Value Authorization

**Rule: Who can modify custom benefit values?**

```
Edit custom value:
  ✓ Owner: Can edit for any player/card
  ✓ Player (editor): Can edit own benefits only
  ✓ Player (viewer): Read-only, cannot edit
  ✗ Guest: No access

Bulk edit values:
  ✓ Owner: Can bulk edit any benefits
  ✓ Player (editor): Can only bulk edit own benefits
  ✗ Viewer: Cannot bulk edit
```

**Implementation:**
```typescript
async function authorizeBenefitEdit(
  editingUser: User,
  benefit: UserBenefit,
  operation: 'READ' | 'EDIT' | 'BULK_EDIT'
): Promise<boolean> {
  // Get benefit owner (player who owns this benefit)
  const benefitOwner = await getUserFromBenefit(benefit);

  // Verify user and benefit in same household
  const inSameHousehold = await verifyHouseholdMembership(
    editingUser.id,
    benefitOwner.householdId
  );
  if (!inSameHousehold) return false;

  // Get user's role
  const userRole = await getUserRole(editingUser.id, benefitOwner.householdId);

  // Authorization checks
  if (operation === 'READ') {
    return ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'].includes(userRole);
  } else if (operation === 'EDIT') {
    if (userRole === 'OWNER') return true;
    if (userRole === 'EDITOR') return editingUser.id === benefitOwner.userId;
    return false;
  } else if (operation === 'BULK_EDIT') {
    if (userRole === 'OWNER') return true;
    // Editors can bulk edit only their own
    if (userRole === 'EDITOR') {
      const allBenefitsOwned = await verifyAllBenefitsOwned(
        editingUser.id,
        benefit.ids  // All benefit IDs in bulk operation
      );
      return allBenefitsOwned;
    }
    return false;
  }

  return false;
}
```

#### 5.2.3 Email Alert Configuration Authorization

**Rule: Who can modify email alert preferences?**

```
View own preferences:
  ✓ Everyone: Can view their own email preferences

Modify own preferences:
  ✓ Player: Can modify their own preferences only
  ✗ Other players: Cannot modify another's preferences

View others' preferences:
  ✓ Owner: Can view all player preferences (for management)
  ✗ Editor/Viewer: Cannot view others' preferences (privacy)
```

**Implementation:**
```typescript
async function authorizeEmailPreferencesModification(
  modifyingUser: User,
  targetPlayer: Player
): Promise<boolean> {
  // Can only modify own preferences or owned players' (as Owner)
  if (modifyingUser.id === targetPlayer.userId) {
    return true;  // Can modify own
  }

  const userRole = await getUserRole(
    modifyingUser.id,
    targetPlayer.householdId
  );

  // Only Owner can modify other players' preferences
  return userRole === 'OWNER';
}
```

#### 5.2.4 Card Archival/Deletion Authorization

**Rule: Who can archive or delete cards?**

```
Archive card:
  ✓ Card owner: Can archive own cards
  ✓ Household owner: Can archive any card
  ✗ Editor (other player's card): Cannot archive
  ✗ Viewer: Cannot archive

Permanent delete card:
  ✓ Card owner: Can delete with 2-factor confirmation
  ✓ Household owner: Can delete with reason logging
  ✗ All others: Cannot delete
```

**Implementation:**
```typescript
async function authorizeCardArchival(
  archivingUser: User,
  card: UserCard,
  isDelete: boolean = false
): Promise<{ authorized: boolean; reason?: string }> {
  const cardOwner = await getPlayerFromCard(card);

  // Verify same household
  const inSameHousehold = await verifyHouseholdMembership(
    archivingUser.id,
    cardOwner.householdId
  );
  if (!inSameHousehold) {
    return { authorized: false, reason: 'NOT_IN_HOUSEHOLD' };
  }

  // Get role
  const userRole = await getUserRole(archivingUser.id, cardOwner.householdId);

  // Archive requires owner or player
  if (!isDelete) {
    if (userRole === 'OWNER') return { authorized: true };
    if (archivingUser.id === cardOwner.userId && userRole === 'EDITOR') {
      return { authorized: true };
    }
    return { authorized: false, reason: 'INSUFFICIENT_ROLE' };
  }

  // Delete requires owner + confirmation
  if (userRole === 'OWNER') return { authorized: true };
  if (archivingUser.id === cardOwner.userId && userRole === 'EDITOR') {
    // Card owner can delete own, but need confirmation
    return { authorized: true };
  }

  return { authorized: false, reason: 'CANNOT_DELETE' };
}
```

### 5.3 Import/Export Authorization Rules

#### 5.3.1 Import Permission Matrix

| User Role    | Import to Own | Import to Other | Import Master | Can View Others |
|--------------|---------------|-----------------|---------------|-----------------|
| Owner        | ✓             | ✓               | ✓             | ✓               |
| Admin        | ✓             | ✓ (if delegated)| ✗             | ✓ (admin only)  |
| Editor       | ✓             | ✗               | ✗             | ✗               |
| Viewer       | ✗             | ✗               | ✗             | ✗               |
| Guest        | ✗             | ✗               | ✗             | ✗               |

#### 5.3.2 Export Permission Matrix

| User Role    | Own Data | Household Data | Entire Wallet |
|--------------|----------|----------------|---------------|
| Owner        | ✓        | ✓              | ✓             |
| Admin        | ✓        | ✓ (admin view) | ✗             |
| Editor       | ✓        | ✗              | ✗             |
| Viewer       | ✓        | ✗              | ✗             |
| Guest        | ✗        | ✗              | ✗             |

### 5.4 Cross-Specification Authorization Dependencies

#### 5.4.1 Integration with Phase 1 Auth System

**Required Functions from Phase 1:**
```typescript
// Verify user owns resource
async function verifyOwnership(
  userId: string,
  resourceId: string,
  resourceType: 'CARD' | 'BENEFIT' | 'PREFERENCE'
): Promise<boolean>

// Verify user in household
async function verifyHouseholdMembership(
  userId: string,
  householdId: string
): Promise<boolean>

// Get user role
async function getUserRole(
  userId: string,
  householdId: string
): Promise<'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'GUEST'>
```

**All Phase 4 features MUST use these utilities, not inline role checking.**

---

## Issue #6: Duplicate Detection Logic - Complete Specification

### 6.1 Duplicate Detection Rules

#### 6.1.1 Card Duplicate Definition

**Two cards are considered duplicates if:**
- Same `MasterCard` (by mastercardId)
- Owned by same `Player` (same householdId + playerId)

**Example - Duplicates:**
```
Card 1: Chase Sapphire Preferred (mastercardId: 'chase-sapp-pref')
        Player: user-123@alice.com
        Renewal: 2024-04-15

Card 2: Chase Sapphire Preferred (mastercardId: 'chase-sapp-pref')
        Player: user-123@alice.com
        Renewal: 2024-05-20

Result: DUPLICATE (same card, same player, different renewal dates)
```

**Example - NOT duplicates:**
```
Card 1: Chase Sapphire Preferred (player: alice)
Card 2: Chase Sapphire Preferred (player: bob)

Result: NOT DUPLICATE (different players in same household)
```

**Example - NOT duplicates (user might have 2 physical cards):**
```
Card 1: Chase Sapphire Preferred (mastercardId: 'chase-sapp-pref')
        Annual Fee: $695
        Notes: Personal

Card 2: Chase Sapphire Preferred (mastercardId: 'chase-sapp-pref')
        Annual Fee: $695
        Notes: Business

Result: NOT DUPLICATE (user has legitimate 2 physical cards)
        → System asks: "You already have this card. Add as duplicate?"
```

#### 6.1.2 Detection Implementation

```typescript
async function detectCardDuplicate(
  playerInfo: { playerId: string; householdId: string },
  masterCardId: string
): Promise<{
  isDuplicate: boolean;
  existingCard?: UserCard;
  confidence: number;
  recommendation: 'SKIP' | 'UPDATE' | 'ADD_AS_DUPLICATE';
}> {
  // Check for exact duplicate
  const existing = await db.userCard.findFirst({
    where: {
      playerId: playerInfo.playerId,
      mastercardId: masterCardId,
      status: { not: 'DELETED' }  // Ignore soft-deleted cards
    }
  });

  if (existing) {
    return {
      isDuplicate: true,
      existingCard: existing,
      confidence: 1.0,  // 100% confident
      recommendation: 'SKIP'  // Default: don't re-import
    };
  }

  return {
    isDuplicate: false,
    confidence: 0,
    recommendation: 'ADD_AS_DUPLICATE'  // Can add as second card
  };
}
```

#### 6.1.3 Benefit Duplicate Definition

**Two benefits are considered duplicates if:**
- Same benefit name (case-insensitive, whitespace-insensitive)
- Same card
- Same player

**Example - Benefit Duplicates:**
```
Benefit 1: Travel Insurance (Card: Chase Sapphire, Player: alice)
Benefit 2: travel insurance (Card: Chase Sapphire, Player: alice)

Result: DUPLICATE (normalized name match)
```

**Example - NOT duplicates:**
```
Benefit 1: Travel Insurance (Card: Chase Sapphire)
Benefit 2: Travel Insurance (Card: Amex Platinum)

Result: NOT DUPLICATE (different cards)
```

#### 6.1.4 Benefit Duplicate Detection Implementation

```typescript
// Normalize for comparison
function normalizeBenefitName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .replace(/[^\w\s]/g, '');  // Remove special chars
}

async function detectBenefitDuplicate(
  cardId: string,
  benefitName: string
): Promise<{
  isDuplicate: boolean;
  existingBenefit?: UserBenefit;
  confidence: number;
  recommendation: 'SKIP' | 'MERGE' | 'ADD_AS_VARIANT';
}> {
  const normalized = normalizeBenefitName(benefitName);

  // Find existing benefit with normalized match
  const existing = await db.userBenefit.findFirst({
    where: {
      userCardId: cardId,
      status: { not: 'DELETED' }
    }
  });

  if (existing) {
    const existingNormalized = normalizeBenefitName(existing.name);

    if (normalized === existingNormalized) {
      return {
        isDuplicate: true,
        existingBenefit: existing,
        confidence: 1.0,
        recommendation: 'SKIP'  // Don't re-import duplicate
      };
    }
  }

  return {
    isDuplicate: false,
    confidence: 0,
    recommendation: 'ADD_AS_VARIANT'  // Might be similar but not exact
  };
}
```

### 6.2 Duplicate Resolution Strategies

#### 6.2.1 Skip Duplicate

**Behavior:** Don't import the duplicate record

```
User selects: "Skip"
Import continues with remaining records
Duplicate record is not added to database
Audit log: "Skipped duplicate card (existing: card-uuid-123)"
```

#### 6.2.2 Update Existing

**Behavior:** Update existing card/benefit with new values

**Rules:**
- Update allowed fields: annual_fee, renewal_date, status, notes
- DO NOT overwrite: stickerValue, userDeclaredValue, claimed status
- Preserve all existing data

**Example:**
```
Existing card:
  - Annual Fee: $695
  - Renewal: 2024-04-15
  - Benefits: 5 claimed

Import card:
  - Annual Fee: $750 (new fee for this year)
  - Renewal: 2024-05-15 (updated cycle)
  - Benefits: same 5

User selects: "Update"
Result:
  - Annual Fee: $750 (updated)
  - Renewal: 2024-05-15 (updated)
  - Benefits: preserved (still 5)
  - Change log entry: "Updated annual fee $695→$750"
```

**Implementation:**
```typescript
async function updateCardOnDuplicate(
  existingCard: UserCard,
  importData: {
    annualFee?: number;
    renewalDate?: Date;
    status?: string;
    notes?: string;
  }
): Promise<UserCard> {
  const updates: Record<string, any> = {};

  // Only allow specific fields to be updated
  if (importData.annualFee !== undefined) {
    updates.annualFee = importData.annualFee;
  }
  if (importData.renewalDate !== undefined) {
    updates.renewalDate = importData.renewalDate;
  }
  if (importData.status && isValidStatus(importData.status)) {
    updates.status = importData.status;
  }
  if (importData.notes !== undefined) {
    updates.notes = importData.notes;
  }

  // Log what changed
  if (Object.keys(updates).length > 0) {
    await logCardUpdate(existingCard.id, existingCard, updates);
  }

  return await db.userCard.update({
    where: { id: existingCard.id },
    data: updates
  });
}
```

#### 6.2.3 Merge Benefits (for benefit duplicates)

**Behavior:** Combine duplicate benefits, keeping highest values

**Rules for merging:**
- Use the highest stickerValue
- Use the highest userDeclaredValue (if both have custom values)
- Combine usage status (if one is claimed, merged is claimed)
- Keep earliest expiration date (most conservative)
- Create audit record showing merge source

**Example:**
```
Existing benefit "Travel Insurance":
  - Sticker Value: $250
  - User Declared: $200
  - Claimed: true
  - Expires: 2024-12-31

Import benefit "Travel Insurance":
  - Sticker Value: $250
  - User Declared: $225
  - Claimed: false
  - Expires: 2024-12-31

User selects: "Merge"
Result:
  - Sticker Value: $250 (same)
  - User Declared: $225 (higher value kept)
  - Claimed: true (existing claim preserved)
  - Expires: 2024-12-31 (same)
  - Audit: "Merged with import, user value updated $200→$225"
```

**Implementation:**
```typescript
async function mergeBenefits(
  existing: UserBenefit,
  imported: { stickerValue?: number; userDeclaredValue?: number; ... }
): Promise<UserBenefit> {
  const updates: Record<string, any> = {};

  // Keep highest sticker value
  if (imported.stickerValue && imported.stickerValue > existing.stickerValue) {
    updates.stickerValue = imported.stickerValue;
  }

  // Keep highest user declared value
  if (imported.userDeclaredValue && existing.userDeclaredValue) {
    updates.userDeclaredValue = Math.max(
      existing.userDeclaredValue,
      imported.userDeclaredValue
    );
  } else if (imported.userDeclaredValue) {
    updates.userDeclaredValue = imported.userDeclaredValue;
  }

  // Preserve existing claim status (don't unmark claimed benefits)
  // Don't override expiration with newer date (use earliest)

  await logBenefitMerge(existing.id, imported, updates);

  return await db.userBenefit.update({
    where: { id: existing.id },
    data: updates
  });
}
```

### 6.3 Confidence Scoring for Fuzzy Matching

**Note:** Exact duplicate detection is used (not fuzzy matching).

However, for near-duplicates (e.g., "Chase Sapphire" vs. "Chase Sapphire Reserve"), confidence scoring can help:

```typescript
function calculateDuplicateConfidence(
  card1: { name: string; issuer: string; annualFee: number },
  card2: { name: string; issuer: string; annualFee: number }
): number {
  let score = 0;

  // Issuer match (high confidence)
  if (card1.issuer.toLowerCase() === card2.issuer.toLowerCase()) {
    score += 0.4;
  }

  // Name similarity (Levenshtein distance)
  const nameSimilarity = calculateStringSimilarity(card1.name, card2.name);
  score += nameSimilarity * 0.4;

  // Annual fee match (within $50)
  if (Math.abs(card1.annualFee - card2.annualFee) <= 50) {
    score += 0.2;
  }

  return Math.min(score, 1.0);  // Max 1.0
}

// Result:
// score >= 0.95 = "Very likely duplicate"
// score >= 0.80 = "Possible duplicate"
// score >= 0.60 = "Similar (might be variant)"
// score < 0.60 = "Different cards"
```

### 6.4 Duplicate Handling Workflow

**Complete state machine for duplicate handling:**

```
User uploads file with potential duplicates
                    ↓
System detects duplicates (exact match)
                    ↓
For each duplicate:
  ├─ Show existing record
  ├─ Show import record
  ├─ Recommend action (SKIP / UPDATE / MERGE)
  └─ User selects action
                    ↓
For each near-duplicate (confidence 0.8+):
  ├─ Highlight as potential match
  ├─ Show confidence score
  └─ User confirms or skips
                    ↓
Apply selected actions
                    ↓
Show summary:
  ├─ Skipped: N
  ├─ Updated: N
  ├─ Merged: N
  └─ New added: N
```

---

## Implementation Task Updates

### Tasks added to Import/Export spec:
- SEC-1: Implement transaction-based rollback for imports
- SEC-2: Add file size validation (50MB max)
- SEC-3: Implement duplicate detection per rules
- SEC-4: Add CSV injection prevention

### Tasks added to Email Alerts spec:
- SEC-5: Implement IANA timezone storage and conversion
- SEC-6: Add DST transition handling with tests
- SEC-7: Implement secure unsubscribe tokens (CSRF-protected)
- SEC-8: Add timezone change recalculation

### Tasks added to Card Management spec:
- SEC-9: Define and enforce role-based authorization
- SEC-10: Implement multi-player household auth checks
- SEC-11: Add bulk operation authorization tests

---

## Quality Assurance Checklist

- [ ] All timezone handling uses IANA identifiers
- [ ] DST transitions tested for 5+ timezones
- [ ] UTC storage verified in database
- [ ] Authorization checks present before all operations
- [ ] Role-based access control integrated with Phase 1 auth
- [ ] Duplicate detection uses exact matching for cards
- [ ] Duplicate resolution tested for skip/update/merge
- [ ] All cross-specification dependencies documented
- [ ] Test cases cover all edge cases
- [ ] Security assumptions explicitly stated

---

## Dependencies

- Phase 1: Authentication System (auth utilities)
- Phase 2: ROI Centralization (for authorization scope definition)
- All Phase 4 specs (import/export, card management, email alerts, custom values)

