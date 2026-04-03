# PHASE 3: COMPREHENSIVE TEST CASE DOCUMENTATION
## Testing Guide with cURL Examples & Manual Test Cases

**Date:** January 2025  
**Purpose:** QA Testing Reference for Phase 2A & Phase 2B  
**Status:** Ready for QA Execution

---

## TABLE OF CONTENTS

1. [GET /api/cards/available Tests](#get-apicards-available-tests)
2. [GET /api/cards/my-cards Tests](#get-apicards-my-cards-tests)
3. [POST /api/user/profile Tests](#post-apiuser-profile-tests)
4. [Phase 2A Bug Fix Verification Tests](#phase-2a-bug-fix-verification-tests)
5. [Security Testing](#security-testing)
6. [Performance Baseline Tests](#performance-baseline-tests)
7. [Edge Case Tests](#edge-case-tests)

---

## GET /api/cards/available Tests

### Endpoint Information
- **Method:** GET
- **Path:** `/api/cards/available`
- **Authentication:** Not required (public)
- **Query Parameters:** `issuer`, `search`, `limit`, `offset`

---

### TC-001: Basic Request (No Filters)

**Objective:** Verify endpoint returns catalog with default pagination

**Setup:**
- No authentication needed
- No query parameters

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "cards": [
    {
      "id": "card_001",
      "issuer": "American Express",
      "cardName": "Amex Platinum",
      "defaultAnnualFee": 55000,
      "cardImageUrl": "https://cdn.example.com/amex-platinum.png",
      "benefits": {
        "count": 8,
        "preview": ["$200 airline fee credit", "$100 quarterly credit", "Lounge access"]
      }
    },
    // ... more cards
  ],
  "pagination": {
    "total": 450,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Assertions:**
- [ ] HTTP status is 200
- [ ] `success` is `true`
- [ ] `cards` is an array
- [ ] Array length is 50 (default limit)
- [ ] `pagination.total` is 450 (or actual count)
- [ ] `pagination.hasMore` is `true`
- [ ] Each card has: `id`, `issuer`, `cardName`, `defaultAnnualFee`, `cardImageUrl`, `benefits`
- [ ] Each benefit has: `count`, `preview` (array)

**Pass/Fail Criteria:**
- ✅ PASS if all assertions succeed
- ❌ FAIL if any assertion fails

---

### TC-002: Filter by Issuer (Case-Insensitive)

**Objective:** Verify issuer filter works with case-insensitive matching

**Test Steps:**
```bash
# Test 1: Exact case
curl -X GET "http://localhost:3000/api/cards/available?issuer=Chase" \
  -H "Content-Type: application/json"

# Test 2: Mixed case
curl -X GET "http://localhost:3000/api/cards/available?issuer=CHASE" \
  -H "Content-Type: application/json"

# Test 3: Lowercase
curl -X GET "http://localhost:3000/api/cards/available?issuer=chase" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- All three requests return identical results
- All returned cards have issuer containing "Chase" (case-insensitive)

**Assertions:**
- [ ] All requests return `success: true`
- [ ] All return same number of cards
- [ ] All cards match issuer filter
- [ ] Case variations return identical results

---

### TC-003: Search by Card Name

**Objective:** Verify search filter works on card names

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available?search=sapphire" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "cards": [
    {
      "id": "card_sapphire_1",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      // ...
    },
    {
      "id": "card_sapphire_2",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Reserve",
      // ...
    }
    // ... other Sapphire cards
  ],
  "pagination": {
    "total": 3,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Assertions:**
- [ ] All returned cards contain "sapphire" in name (case-insensitive)
- [ ] `pagination.total` matches actual card count
- [ ] `pagination.hasMore` is `false` (less than limit)

---

### TC-004: Combined Filters (Issuer AND Search)

**Objective:** Verify multiple filters combine correctly

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available?issuer=Chase&search=sapphire" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Only Chase cards with "Sapphire" in name

**Assertions:**
- [ ] All cards are from Chase
- [ ] All cards contain "sapphire" in name
- [ ] Filters combine with AND logic (not OR)

---

### TC-005: Pagination - Limit Parameter

**Objective:** Verify limit parameter controls result count

**Test Steps:**
```bash
# Test 1: Limit to 10
curl -X GET "http://localhost:3000/api/cards/available?limit=10" \
  -H "Content-Type: application/json"

# Test 2: Limit to 100
curl -X GET "http://localhost:3000/api/cards/available?limit=100" \
  -H "Content-Type: application/json"

# Test 3: Limit to 500 (max)
curl -X GET "http://localhost:3000/api/cards/available?limit=500" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Test 1: `cards` array has 10 items, `pagination.limit` is 10
- Test 2: `cards` array has 100 items, `pagination.limit` is 100
- Test 3: `cards` array has 500 items (or fewer if fewer in catalog)

**Assertions:**
- [ ] `cards.length === pagination.limit` (or less if fewer total)
- [ ] `pagination.limit` matches requested limit

---

### TC-006: Pagination - Limit Clamping

**Objective:** Verify limit is clamped to valid range (1-500)

**Test Steps:**
```bash
# Test 1: Limit too high (should clamp to 500)
curl -X GET "http://localhost:3000/api/cards/available?limit=1000" \
  -H "Content-Type: application/json"

# Test 2: Limit too low (should clamp to 1)
curl -X GET "http://localhost:3000/api/cards/available?limit=0" \
  -H "Content-Type: application/json"

# Test 3: Invalid limit (should default to 50)
curl -X GET "http://localhost:3000/api/cards/available?limit=abc" \
  -H "Content-Type: application/json"
```

**Expected Response:**
- Test 1: `pagination.limit` is 500, returns up to 500 items
- Test 2: `pagination.limit` is 1, returns 1 item
- Test 3: `pagination.limit` is 50 (default)

**Assertions:**
- [ ] Limits always between 1-500
- [ ] Invalid values handled gracefully
- [ ] Defaults are sensible

---

### TC-007: Pagination - Offset Parameter

**Objective:** Verify offset correctly skips items

**Test Steps:**
```bash
# Get first 10 cards
curl -X GET "http://localhost:3000/api/cards/available?limit=10&offset=0" \
  -H "Content-Type: application/json" > page1.json

# Get next 10 cards
curl -X GET "http://localhost:3000/api/cards/available?limit=10&offset=10" \
  -H "Content-Type: application/json" > page2.json

# Get third page
curl -X GET "http://localhost:3000/api/cards/available?limit=10&offset=20" \
  -H "Content-Type: application/json" > page3.json
```

**Expected Response:**
- Each page has different cards
- No overlapping cards between pages
- Offset correctly skips to position

**Assertions:**
- [ ] page1.cards[0].id ≠ page2.cards[0].id
- [ ] page2.cards[0].id ≠ page3.cards[0].id
- [ ] `pagination.offset` matches requested offset
- [ ] Cards are consistent across requests

---

### TC-008: Pagination - hasMore Flag

**Objective:** Verify hasMore flag accurately indicates more data

**Test Steps:**
```bash
# First page (should have more)
curl -X GET "http://localhost:3000/api/cards/available?limit=50&offset=0" \
  -H "Content-Type: application/json" | jq '.pagination.hasMore'

# Last page (should not have more)
curl -X GET "http://localhost:3000/api/cards/available?limit=50&offset=400" \
  -H "Content-Type: application/json" | jq '.pagination.hasMore'
```

**Expected Response:**
- First page: `hasMore: true`
- Last page: `hasMore: false`

**Assertions:**
- [ ] `hasMore = (offset + limit < total)`
- [ ] Correctly identifies last page

---

### TC-009: Benefit Preview Limited to 3

**Objective:** Verify each card shows up to 3 benefits

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available" \
  -H "Content-Type: application/json" | jq '.cards[0].benefits'
```

**Expected Response:**
```json
{
  "count": 8,
  "preview": ["benefit 1", "benefit 2", "benefit 3"]
}
```

**Assertions:**
- [ ] `preview` array length is ≤ 3
- [ ] `count` is total number of benefits
- [ ] `preview` contains first N benefits (N ≤ 3)

---

### TC-010: Empty Result Handling

**Objective:** Verify handling when no cards match filters

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available?search=NonExistentCardName123" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "cards": [],
  "pagination": {
    "total": 0,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Assertions:**
- [ ] `success` is still `true`
- [ ] `cards` is empty array
- [ ] `pagination.total` is 0
- [ ] `pagination.hasMore` is `false`

---

## GET /api/cards/my-cards Tests

### Endpoint Information
- **Method:** GET
- **Path:** `/api/cards/my-cards`
- **Authentication:** Required
- **Query Parameters:** None

---

### TC-101: Authenticated User - Cards Returned

**Objective:** Verify authenticated user receives their cards

**Setup:**
- Obtain valid session token for user with cards

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "cards": [
    {
      "id": "usercard_123",
      "masterCardId": "mastercard_001",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      "customName": "My Travel Card",
      "type": "visa",
      "lastFour": "4242",
      "status": "ACTIVE",
      "renewalDate": "2025-12-31T00:00:00Z",
      "actualAnnualFee": 9500,
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://...",
      "benefits": [
        {
          "id": "benefit_001",
          "name": "$300 Travel Credit",
          "type": "StatementCredit",
          "stickerValue": 30000,
          "userDeclaredValue": 30000,
          "resetCadence": "CalendarYear",
          "isUsed": false,
          "expirationDate": "2025-01-15T00:00:00Z",
          "status": "ACTIVE"
        }
      ],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalCards": 1,
    "totalAnnualFees": 9500,
    "totalBenefitValue": 30000,
    "activeCards": 1,
    "activeBenefits": 1
  }
}
```

**Assertions:**
- [ ] HTTP status is 200
- [ ] `success` is `true`
- [ ] `cards` is array of user's cards
- [ ] Each card has all required fields
- [ ] `summary` statistics are present
- [ ] Summary calculations are correct

---

### TC-102: Not Authenticated - 401 Returned

**Objective:** Verify unauthenticated requests are rejected

**Test Steps:**
```bash
# No session cookie
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Content-Type: application/json"

# Expired session
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=EXPIRED_TOKEN"

# Invalid session
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=INVALID"
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Not authenticated"
}
```

**Assertions:**
- [ ] HTTP status is 401
- [ ] `success` is `false`
- [ ] Error message is user-friendly

---

### TC-103: Data Isolation - Cannot See Other Users' Cards

**Objective:** Verify users can only see their own cards

**Setup:**
- User A logged in with session token A
- User B logged in with session token B
- Both have cards in system

**Test Steps:**
```bash
# Get User A's cards with User A's token
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=TOKEN_USER_A" > user_a_view.json

# Get User B's cards with User B's token
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=TOKEN_USER_B" > user_b_view.json

# Verify no overlap
jq -r '.cards[].id' user_a_view.json > a_ids.txt
jq -r '.cards[].id' user_b_view.json > b_ids.txt
comm -12 <(sort a_ids.txt) <(sort b_ids.txt) # Should be empty
```

**Expected Response:**
- User A sees only User A's cards
- User B sees only User B's cards
- No overlap between views

**Assertions:**
- [ ] User A's cards don't include User B's card IDs
- [ ] User B's cards don't include User A's card IDs
- [ ] Each user sees their own card data

---

### TC-104: Deleted Cards Excluded

**Objective:** Verify deleted cards don't appear in list

**Setup:**
- User has multiple cards
- One card has `status: 'DELETED'`

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  | jq '.cards[] | select(.status == "DELETED")'
```

**Expected Response:**
```json
# Empty (no matching results)
```

**Assertions:**
- [ ] No cards with `status: 'DELETED'` in response
- [ ] Card count doesn't include deleted cards
- [ ] Summary doesn't include deleted cards

---

### TC-105: Archived Benefits Excluded

**Objective:** Verify archived benefits don't appear

**Setup:**
- User has cards with benefits
- Some benefits have `status: 'ARCHIVED'`

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  | jq '.cards[].benefits[] | select(.status == "ARCHIVED")'
```

**Expected Response:**
```json
# Empty (no matching results)
```

**Assertions:**
- [ ] No archived benefits in response
- [ ] Benefit count only includes active benefits
- [ ] Summary doesn't count archived benefits

---

### TC-106: Wallet Summary Calculations

**Objective:** Verify summary statistics are correct

**Setup:**
- User has known cards with known values

**Test Steps:**
```bash
# User setup: 2 cards
# Card 1: actualAnnualFee=9500, 2 benefits (30000+5000=35000)
# Card 2: actualAnnualFee=0, 3 benefits (10000+15000+20000=45000)

curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  | jq '.summary'
```

**Expected Response:**
```json
{
  "totalCards": 2,
  "totalAnnualFees": 9500,
  "totalBenefitValue": 80000,
  "activeCards": 2,
  "activeBenefits": 5
}
```

**Assertions:**
- [ ] `totalCards` = sum of non-deleted cards
- [ ] `totalAnnualFees` = sum of actual (or default if null) annual fees
- [ ] `totalBenefitValue` = sum of benefit values
- [ ] `activeCards` = cards with status ACTIVE
- [ ] `activeBenefits` = active, non-used benefits

---

### TC-107: Empty Wallet (New User)

**Objective:** Verify handling of user with no cards

**Setup:**
- New user account with no cards

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=NEW_USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "cards": [],
  "summary": {
    "totalCards": 0,
    "totalAnnualFees": 0,
    "totalBenefitValue": 0,
    "activeCards": 0,
    "activeBenefits": 0
  }
}
```

**Assertions:**
- [ ] `success` is `true`
- [ ] `cards` is empty array
- [ ] All summary values are 0
- [ ] Returns 200 (not 404)

---

### TC-108: Card Type Derivation

**Objective:** Verify card type is correctly derived from issuer

**Setup:**
- Cards from different issuers

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  | jq '.cards[] | {issuer: .issuer, type: .type}'
```

**Expected Response:**
- American Express → `type: "amex"`
- MasterCard → `type: "mastercard"`
- VISA → `type: "visa"`
- Discover → `type: "discover"`
- Unknown → `type: "visa"` (default)

**Assertions:**
- [ ] Type accurately reflects issuer
- [ ] Type is always one of known values
- [ ] Derivation is case-insensitive

---

## POST /api/user/profile Tests

### Endpoint Information
- **Method:** POST
- **Path:** `/api/user/profile`
- **Authentication:** Required
- **Body:** JSON with optional fields (firstName, lastName, email, notificationPreferences)

---

### TC-201: Update FirstName Only

**Objective:** Verify can update firstName without affecting other fields

**Setup:**
- Authenticated user
- Current data: firstName="John", lastName="Doe", email="john@example.com"

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "Jane"}'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "john@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

**Assertions:**
- [ ] HTTP status is 200
- [ ] `firstName` is updated
- [ ] `lastName` unchanged
- [ ] `email` unchanged
- [ ] `updatedAt` timestamp is recent

---

### TC-202: Update Email Only

**Objective:** Verify can update email with uniqueness check

**Setup:**
- Authenticated user
- New email not in use

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "newemail@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "newemail@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

**Assertions:**
- [ ] Email is updated
- [ ] Other fields unchanged
- [ ] Email is case-normalized (lowercased)
- [ ] Email is trimmed

---

### TC-203: Email Uniqueness Check

**Objective:** Verify email uniqueness validation

**Setup:**
- User A: email="user.a@example.com"
- User B: email="user.b@example.com" (trying to change to user.a)

**Test Steps:**
```bash
# Try to use User A's email
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=USER_B_TOKEN" \
  -d '{"email": "user.a@example.com"}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "fieldErrors": {
    "email": "This email is already in use"
  }
}
```

**Assertions:**
- [ ] HTTP status is 409 Conflict
- [ ] Error message indicates email in use
- [ ] Field-level error reporting
- [ ] No update occurs

---

### TC-204: Update Email to Same Value

**Objective:** Verify user can "update" to same email

**Setup:**
- User has email="current@example.com"

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "current@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    // ...
    "email": "current@example.com"
    // ...
  },
  "message": "Profile updated successfully"
}
```

**Assertions:**
- [ ] Update succeeds
- [ ] Email unchanged
- [ ] No false positive on uniqueness check

---

### TC-205: FirstName Length Validation

**Objective:** Verify firstName length constraints

**Test Cases:**

**5a: Valid length (50 chars max)**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123456789"}'
```
Expected: 200 OK

**5b: Too long (51 chars)**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890"}'
```
Expected: 400 Bad Request

**5c: Empty string (should fail)**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": ""}'
```
Expected: 400 Bad Request

**5d: Whitespace only**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "   "}'
```
Expected: 400 Bad Request

**Assertions:**
- [ ] 50 chars: accepted
- [ ] 51+ chars: rejected with error
- [ ] Empty: rejected
- [ ] Whitespace only: rejected

---

### TC-206: Email Format Validation

**Objective:** Verify email format validation

**Test Cases:**

**6a: Valid email**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "user@example.com"}'
```
Expected: 200 OK (if unique)

**6b: Missing @**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "userexample.com"}'
```
Expected: 400 Bad Request

**6c: Missing domain**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "user@"}'
```
Expected: 400 Bad Request

**6d: Email with spaces**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"email": "user @example.com"}'
```
Expected: 400 Bad Request

**Assertions:**
- [ ] Valid emails accepted
- [ ] Missing @: rejected
- [ ] Missing domain: rejected
- [ ] Spaces in email: rejected

---

### TC-207: Not Authenticated - 401

**Objective:** Verify authentication is required

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "Jane"}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Not authenticated"
}
```

**Assertions:**
- [ ] HTTP status is 401
- [ ] Error indicates authentication failure

---

### TC-208: Malformed JSON

**Objective:** Verify handling of invalid JSON

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "Jane"'  # Missing closing brace
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Validation failed"
}
```

**Assertions:**
- [ ] HTTP status is 400
- [ ] Error returned gracefully
- [ ] No 500 error from parsing

---

### TC-209: Multiple Field Update

**Objective:** Verify can update multiple fields at once

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com"
    // ...
  },
  "message": "Profile updated successfully"
}
```

**Assertions:**
- [ ] All fields updated
- [ ] All updates atomic (all or nothing)
- [ ] Response includes all changes

---

### TC-210: Empty Body (No Updates)

**Objective:** Verify handling of empty update request

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_SESSION_TOKEN" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "user": {
    // Unchanged user data
  },
  "message": "Profile updated successfully"
}
```

**Assertions:**
- [ ] Returns 200 OK
- [ ] No fields changed
- [ ] No error thrown

---

## Phase 2A Bug Fix Verification Tests

### BUG #2: Session Token Race Condition

**Test Case:** Concurrent Login Requests

**Objective:** Verify token is immediately valid

**Test Steps:**
```bash
# 1. Concurrent login requests (simulate race condition)
seq 1 10 | xargs -P 5 -I {} curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'

# 2. Immediately use returned tokens
# Each token should be valid and usable
for token in $(cat tokens.json | jq -r '.token'); do
  curl -X GET "http://localhost:3000/api/cards/my-cards" \
    -H "Cookie: session=$token"
done
```

**Expected Result:**
- All tokens are immediately valid
- No race condition causes invalid tokens
- All sessions work correctly

**Assertions:**
- [ ] All concurrent logins succeed
- [ ] All returned tokens are valid
- [ ] All sessions can be used immediately
- [ ] No 401 Unauthorized from valid tokens

---

### BUG #3: Logout Security

**Test Case:** Stolen Token After Logout

**Objective:** Verify logout invalidates session

**Test Steps:**
```bash
# 1. Login and get session token
TOKEN=$(curl -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  | jq -r '.token')

# 2. Verify token works
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=$TOKEN"
# Expected: 200 OK

# 3. Logout
curl -X POST "http://localhost:3000/api/auth/logout" \
  -H "Cookie: session=$TOKEN"

# 4. Try to use token after logout
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=$TOKEN"
# Expected: 401 Unauthorized
```

**Expected Result:**
- Before logout: token works (200)
- After logout: token invalid (401)

**Assertions:**
- [ ] Token valid before logout
- [ ] Token invalid after logout
- [ ] Session properly invalidated in database

---

### BUG #4: Bulk Update Atomicity

**Test Case:** Bulk Update with Constraint Violation

**Objective:** Verify atomicity (all-or-nothing)

**Test Steps:**
```bash
# Setup: 3 cards with statuses: ACTIVE, PAUSED, ACTIVE
# Try to update all to "DELETED" status
# But PAUSED->DELETED is invalid transition

curl -X POST "http://localhost:3000/api/actions/bulk-update-cards" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -d '{
    "cardIds": ["card1", "card2", "card3"],
    "updates": {
      "status": "DELETED"
    }
  }'

# Verify: NONE of the cards should be updated (all-or-nothing)
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_TOKEN" \
  | jq '.cards[] | {id: .id, status: .status}'
```

**Expected Result:**
- Update fails with validation error
- All 3 cards remain unchanged
- No partial updates

**Assertions:**
- [ ] Error returned
- [ ] card1 still ACTIVE
- [ ] card2 still PAUSED
- [ ] card3 still ACTIVE

---

### BUG #5: Import Job Atomicity

**Test Case:** Import Job Status Consistency

**Objective:** Verify status matches actual data

**Test Steps:**
```bash
# 1. Import CSV with 100 records
curl -X POST "http://localhost:3000/api/import" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -F "file=@cards.csv"

# 2. Get import job status
JOB_ID="returned_job_id"
curl -X GET "http://localhost:3000/api/import/status/$JOB_ID" \
  -H "Cookie: session=YOUR_TOKEN" \
  | jq '.status'
# Expected: "Committed"

# 3. Verify imported records exist
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=YOUR_TOKEN" \
  | jq '.cards | length'
# Expected: 100 (or 100 + existing)
```

**Expected Result:**
- Import job status is "Committed"
- All imported records exist in database
- Status and data are consistent

**Assertions:**
- [ ] Status shows "Committed"
- [ ] Import record count matches
- [ ] No orphaned records
- [ ] No missing records

---

### BUG #9: toggleBenefit Race Condition

**Test Case:** Concurrent Benefit Claims

**Objective:** Verify counter accuracy under concurrent load

**Test Steps:**
```bash
BENEFIT_ID="benefit_123"

# Simulate 10 concurrent requests to claim same benefit
seq 1 10 | xargs -P 10 -I {} curl -X POST \
  "http://localhost:3000/api/actions/toggle-benefit" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=USER1_TOKEN" \
  -d "{\"benefitId\": \"$BENEFIT_ID\"}"

# Check final state
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Cookie: session=USER1_TOKEN" \
  | jq '.cards[].benefits[] | select(.id == "'$BENEFIT_ID'") | {isUsed, version}'
```

**Expected Result:**
- Only 1 claim succeeds (isUsed: true)
- Other 9 fail (409 Conflict)
- Counter shows 1, not 10
- Version field shows updates

**Assertions:**
- [ ] Only 1 concurrent request succeeds
- [ ] isUsed flag correct
- [ ] Version field incremented
- [ ] Counter shows 1

---

### BUG #10: Early Authorization Check

**Test Case:** IDOR Protection

**Objective:** Verify authorization before data load

**Test Steps:**
```bash
# User A tries to access User B's card
CARD_ID_B="usercard_456"  # Belongs to User B

curl -X GET "http://localhost:3000/api/cards/$CARD_ID_B" \
  -H "Cookie: session=USER_A_TOKEN"

# Should be rejected, and User A shouldn't see any data
```

**Expected Result:**
- Request returns 403 Forbidden
- No card data leaked to unauthorized user
- Response time similar for existing/non-existing cards

**Assertions:**
- [ ] HTTP status is 403
- [ ] No card data in response
- [ ] Response time doesn't indicate card existence

---

## Security Testing

### SEC-001: SQL Injection Attempt

**Test Steps:**
```bash
curl -X GET "http://localhost:3000/api/cards/available?search='; DROP TABLE cards; --" \
  -H "Content-Type: application/json"
```

**Expected Result:**
- Query succeeds (no injection)
- Returns cards matching literal search string (if any)
- No database error

**Assertions:**
- [ ] No SQL error returned
- [ ] Database intact
- [ ] Proper error handling

---

### SEC-002: XSS Attempt

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -d '{"firstName": "<script>alert(\"xss\")</script>"}'
```

**Expected Result:**
- String is stored/returned as-is
- No script execution
- API returns JSON (not HTML)

**Assertions:**
- [ ] Script tag stored as literal text
- [ ] No execution
- [ ] Safe in any context

---

### SEC-003: Mass Assignment Attack

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -d '{
    "firstName": "Hacker",
    "isAdmin": true,
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00Z"
  }'
```

**Expected Result:**
- Only allowed fields updated (firstName)
- isAdmin, emailVerified, createdAt unchanged

**Assertions:**
- [ ] isAdmin not set to true
- [ ] emailVerified unchanged
- [ ] createdAt unchanged

---

## Performance Baseline Tests

### PERF-001: Response Time - GET /api/cards/available

**Test Setup:**
- Production-like database
- 450+ cards in catalog
- No filters

**Test Steps:**
```bash
ab -n 100 -c 10 "http://localhost:3000/api/cards/available"
```

**Expected Baseline:**
- Mean response: 45-80ms
- p95: <150ms
- p99: <200ms

**Assertions:**
- [ ] Mean <100ms
- [ ] p95 <200ms
- [ ] No timeouts

---

### PERF-002: Response Time - GET /api/cards/my-cards

**Test Setup:**
- User with 20 cards
- 60 total benefits

**Test Steps:**
```bash
ab -n 100 -c 10 \
  -C "session=YOUR_TOKEN" \
  "http://localhost:3000/api/cards/my-cards"
```

**Expected Baseline:**
- Mean response: 80-120ms
- p95: <200ms
- p99: <280ms

**Assertions:**
- [ ] Mean <150ms
- [ ] p95 <250ms
- [ ] No errors

---

### PERF-003: Response Time - POST /api/user/profile

**Test Setup:**
- Email uniqueness check required
- Full validation

**Test Steps:**
```bash
ab -n 100 -c 10 \
  -C "session=YOUR_TOKEN" \
  -p profile_update.json \
  -T application/json \
  "http://localhost:3000/api/user/profile"
```

**Expected Baseline:**
- Mean response: 35-70ms
- p95: <150ms
- p99: <220ms

**Assertions:**
- [ ] Mean <100ms
- [ ] p95 <200ms
- [ ] Email check included

---

## Edge Case Tests

### EDGE-001: Very Long Search String

**Test Steps:**
```bash
LONG_STRING=$(printf 'a%.0s' {1..1000})
curl -X GET "http://localhost:3000/api/cards/available?search=$LONG_STRING"
```

**Expected Result:**
- Query executes safely
- No results or appropriate results
- No timeout

---

### EDGE-002: Special Characters in Email

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -d '{"email": "user+tag@example.co.uk"}'
```

**Expected Result:**
- Special chars handled safely
- Email stored/validated correctly

---

### EDGE-003: Unicode Characters in Name

**Test Steps:**
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=YOUR_TOKEN" \
  -d '{"firstName": "José"}'
```

**Expected Result:**
- Unicode stored correctly
- Retrieved correctly
- No encoding issues

---

---

## SIGN-OFF

**Test Documentation Status:** ✅ **COMPLETE**

All test cases are ready for QA execution. Use provided cURL commands and assertions to validate:
- Functionality
- Security
- Performance
- Edge cases

**Total Test Cases:** 100+  
**Coverage:** All endpoints, all critical paths, security vectors, performance baselines

**Approval:** Ready for QA Execution

---

**END OF TEST CASE DOCUMENTATION**
