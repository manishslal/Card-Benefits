# PHASE 2B: Quick Testing & Verification Guide

## Build Status ✅
```
✓ Compiled successfully
✓ Generating static pages (19/19)
✓ No TypeScript errors
✓ Ready for deployment
```

---

## Quick API Testing with cURL

### Test 1: GET /api/cards/available (BLOCKER #6)

```bash
# Get first 10 cards from catalog
curl -X GET "http://localhost:3000/api/cards/available?limit=10" \
  -H "Content-Type: application/json"

# Filter by issuer
curl -X GET "http://localhost:3000/api/cards/available?issuer=Chase&limit=50" \
  -H "Content-Type: application/json"

# Search by card name
curl -X GET "http://localhost:3000/api/cards/available?search=Sapphire&limit=10" \
  -H "Content-Type: application/json"

# With pagination
curl -X GET "http://localhost:3000/api/cards/available?limit=20&offset=20" \
  -H "Content-Type: application/json"
```

**Expected Response**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "mastercard_xxx",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      "defaultAnnualFee": 9500,
      "cardImageUrl": "...",
      "benefits": {
        "count": 3,
        "preview": ["$300 travel credit", "3x points dining", "..."]
      }
    }
  ],
  "pagination": {
    "total": 450,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### Test 2: GET /api/cards/my-cards (BLOCKER #7 Supporting)

**Note**: Requires authentication. Cookies will be sent automatically in browser.

```bash
# Get user's cards (requires auth cookie)
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "usercard_456",
      "masterCardId": "mastercard_123",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      "customName": "Primary Card",
      "type": "visa",
      "lastFour": "4242",
      "status": "ACTIVE",
      "renewalDate": "2025-12-31T00:00:00.000Z",
      "actualAnnualFee": 9500,
      "defaultAnnualFee": 9500,
      "cardImageUrl": "...",
      "benefits": [
        {
          "id": "userbenefit_789",
          "name": "$300 Travel Credit",
          "type": "StatementCredit",
          "stickerValue": 30000,
          "userDeclaredValue": 30000,
          "resetCadence": "CalendarYear",
          "isUsed": false,
          "expirationDate": "2025-01-15T00:00:00.000Z",
          "status": "ACTIVE"
        }
      ],
      "createdAt": "2024-01-15T10:30:00.000Z"
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

**Test Error Cases**:
```bash
# Missing authentication
curl -X GET "http://localhost:3000/api/cards/my-cards"
# Expected: 401 Unauthorized

# Invalid auth token
curl -X GET "http://localhost:3000/api/cards/my-cards" \
  -b "sessionToken=invalid_token"
# Expected: 401 Unauthorized
```

---

### Test 3: POST /api/user/profile (BLOCKER #8)

**Note**: Requires authentication.

```bash
# Update profile (all fields)
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "notificationPreferences": {
      "emailNotifications": true,
      "renewalReminders": true,
      "newFeatures": false
    }
  }'

# Update only firstName
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "Jane"}'

# Update only email
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{"email": "newemail@example.com"}'
```

**Expected Response (Success)**:
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Profile updated successfully"
}
```

**Test Error Cases**:

1. **Invalid email format**:
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{"email": "invalid-email"}'
# Expected: 400 Bad Request
# Response: { "success": false, "fieldErrors": { "email": "Invalid email format" } }
```

2. **Email already in use**:
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{"email": "existing@example.com"}'
# Expected: 409 Conflict
# Response: { "success": false, "fieldErrors": { "email": "This email is already in use" } }
```

3. **Name too long**:
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -b "sessionToken=YOUR_SESSION_TOKEN" \
  -d '{"firstName": "VeryLongNameThatExceedsTheMaximumOf50Characters"}'
# Expected: 400 Bad Request
```

4. **Not authenticated**:
```bash
curl -X POST "http://localhost:3000/api/user/profile" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "John"}'
# Expected: 401 Unauthorized
```

---

## Browser Testing Checklist

### Dashboard Page (BLOCKER #7)

1. **Login** to the application
2. Navigate to `/dashboard`
3. Verify:
   - ✅ **Loading state**: See skeleton loader while cards load
   - ✅ **Real data**: Dashboard shows your actual cards (not hardcoded 3)
   - ✅ **Personalization**: Welcome message shows your first name
   - ✅ **Card count**: Accurate count of your cards displayed
   - ✅ **Card selection**: Can select different cards
   - ✅ **Error recovery**: If load fails, see reload button

4. **Empty wallet test** (if no cards):
   - ✅ See "No Cards Added Yet" message
   - ✅ See call-to-action button to add first card

5. **Add Card flow**:
   - Click "Add Card" button
   - ✅ Modal loads real cards from API (not 3 hardcoded)
   - ✅ Can select from full card list
   - Add a card
   - ✅ Dashboard refreshes automatically
   - ✅ New card appears in list

---

### Add Card Modal (BLOCKER #6)

1. On Dashboard, click "Add Card"
2. Verify modal loads:
   - ✅ "Loading cards..." message appears initially
   - ✅ Real card list loads from API
   - ✅ Can see issuer names (Chase, Amex, etc.)
   - ✅ Can see card names (Sapphire, Platinum, etc.)
   - ✅ Can see annual fees

3. **Test card selection**:
   - ✅ Can select any card from list
   - ✅ Selected card displays correctly

4. **Test error handling**:
   - Open browser DevTools Network tab
   - Simulate network error (disable network)
   - Click "Add Card"
   - ✅ See error message
   - ✅ Enable network again
   - ✅ Try again, works correctly

---

### Settings Page (BLOCKER #8)

1. Navigate to `/settings`
2. Verify:
   - ✅ Profile form loads with current data
   - ✅ First name, last name, email populated
   - ✅ Can edit each field

3. **Test profile update**:
   - Change first name
   - Click "Save Changes"
   - ✅ See "Profile updated successfully" message
   - ✅ Form updates with new data
   - Refresh page
   - ✅ Change persists (data came from database)

4. **Test validation**:
   - Try email that already exists
   - ✅ See error message: "This email is already in use"
   - Try invalid email format
   - ✅ See error message: "Invalid email format"
   - Try name too long
   - ✅ See error message about length limit

5. **Test error recovery**:
   - Try to save invalid email
   - See error
   - ✅ Can fix and retry
   - ✅ Success message appears on second attempt

---

## Data Verification

### Check Database for Added Cards

After adding a card via the UI:

```sql
-- View all master cards
SELECT id, issuer, cardName, defaultAnnualFee FROM "MasterCard" LIMIT 10;

-- View user's cards (replace USER_ID)
SELECT uc.id, uc.masterCardId, mc.cardName, uc.status, uc.renewalDate
FROM "UserCard" uc
JOIN "MasterCard" mc ON uc.masterCardId = mc.id
WHERE uc.playerId IN (
  SELECT id FROM "Player" WHERE userId = 'USER_ID'
)
ORDER BY uc.createdAt DESC;

-- View benefits for a card (replace CARD_ID)
SELECT id, name, type, stickerValue FROM "UserBenefit"
WHERE userCardId = 'CARD_ID'
ORDER BY name;

-- View user profile
SELECT id, email, firstName, lastName FROM "User" WHERE id = 'USER_ID';
```

---

## Performance Checks

### API Response Times

Test API response times with browser DevTools:

1. **GET /api/cards/available**
   - Expected: 50-100ms
   - With pagination limit=50

2. **GET /api/cards/my-cards**
   - Expected: 50-150ms
   - Depends on number of cards/benefits

3. **POST /api/user/profile**
   - Expected: 30-50ms
   - Email uniqueness check included

---

## Edge Cases to Test

### Test Cases

1. **Empty Results**:
   - Search for non-existent card name
   - ✅ Should return empty array, not error

2. **Pagination Boundaries**:
   - Request limit=1000 (exceeds max 500)
   - ✅ Should clamp to 500
   - Request limit=-5
   - ✅ Should clamp to 1

3. **Missing Fields**:
   - POST profile with empty JSON body {}
   - ✅ Should succeed (optional fields)

4. **Case Sensitivity**:
   - Search for "chase" (lowercase)
   - ✅ Should match "Chase" (case-insensitive)
   - Email "John@Example.com" then "john@example.com"
   - ✅ Should detect as duplicate (case-insensitive)

5. **Whitespace Handling**:
   - Update firstName with "  John  "
   - ✅ Should trim to "John"

---

## Success Criteria

All tests pass when:

| Test | Status | Notes |
|------|--------|-------|
| Build compiles | ✅ | No TypeScript errors |
| GET /api/cards/available | ✅ | Returns real master cards |
| GET /api/cards/my-cards | ✅ | Returns user's actual cards |
| POST /api/user/profile | ✅ | Updates database with validation |
| Dashboard loads real data | ✅ | No hardcoded mock cards |
| Add Card uses real API | ✅ | Card list from database |
| Settings saves to database | ✅ | Changes persist |
| Error handling | ✅ | User-friendly error messages |
| Validation works | ✅ | Field-level error feedback |
| Authentication required | ✅ | Protected endpoints return 401 |

---

## Troubleshooting

### Issue: Dashboard shows loading state indefinitely

**Solution**:
- Check browser console for errors
- Verify session token is valid
- Check API server is running
- Verify database connection
- Check `/api/cards/my-cards` endpoint directly

### Issue: Add Card modal shows no cards

**Solution**:
- Check if master catalog has cards in database
- Verify `/api/cards/available` endpoint works
- Check for network errors in DevTools

### Issue: Profile update says "Email already in use"

**Solution**:
- Email is genuinely already in use (try different email)
- Check database for existing user with that email
- Note: Email comparison is case-insensitive

### Issue: Settings form doesn't show current data

**Solution**:
- Check if `/api/auth/user` endpoint returns user data
- Verify session is valid
- Check browser console for fetch errors

---

## Deployment Checklist

Before deploying to production:

- [ ] All three endpoints working in staging
- [ ] Dashboard loads real data
- [ ] Add Card modal uses real API
- [ ] Settings page saves changes
- [ ] Error messages are user-friendly
- [ ] No hardcoded mock data remaining
- [ ] Build passes with zero errors
- [ ] Database migrations complete
- [ ] Master card catalog seeded
- [ ] Session authentication working
- [ ] Rate limiting considered (optional)
- [ ] Logging enabled for debugging

---

## Documentation Reference

For detailed implementation:
- See: `PHASE2B_FIXES_SUMMARY.md` (full documentation)
- Source: `src/app/api/cards/available/route.ts`
- Source: `src/app/api/cards/my-cards/route.ts`
- Source: `src/app/api/user/profile/route.ts`
- UI: `src/app/(dashboard)/page.tsx`
- Modal: `src/components/AddCardModal.tsx`
- Settings: `src/app/(dashboard)/settings/page.tsx`

---

**Test Date**: April 3, 2024
**Prepared By**: Senior Full-Stack Engineer
**Status**: Ready for QA and Deployment
