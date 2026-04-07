# Phase 6: Technical Decisions & Rationale

## Architecture Decisions

### 1. **Utility-First Design for Period Calculations**

**Decision**: Create dedicated `benefit-period-utils.ts` with pure functions

**Rationale**:
- Period calculations are complex and error-prone (timezones, leap years, edge cases)
- Pure functions easier to test and reason about
- Reusable across API, components, and future features
- No external dependencies required
- Functions are idempotent and deterministic

**Alternative Considered**: Embed calculations directly in API routes
- ❌ Code duplication across endpoints
- ❌ Harder to test
- ❌ Less reusable

---

### 2. **API Layer: RESTful Endpoints Over GraphQL**

**Decision**: Use 5 RESTful endpoints instead of GraphQL

**Rationale**:
- Simpler to implement and maintain
- Better cache-ability (HTTP GET caching)
- Easier error handling (standard HTTP status codes)
- Smaller payload sizes
- Team already familiar with REST pattern

**Alternative Considered**: GraphQL
- Would require additional setup and libraries
- Overkill for this feature's complexity
- Not aligned with existing API patterns

---

### 3. **Period Selection: Dropdown with Discrete Options**

**Decision**: Offer finite list of historical periods (past 24 periods)

**Rationale**:
- Users rarely need to access ancient periods
- Finite list prevents accidental year-off errors
- Easier UX than free-form date picker
- Matches common credit card benefit claiming flows

**Alternative Considered**: Free-form date picker
- More flexible but complex
- Users might pick wrong dates
- Historical UX concern: can pick future dates

---

### 4. **Component Separation: Modal + Progress Bar + Table**

**Decision**: Create 3 separate, composable components

**Rationale**:
- Single Responsibility Principle
- Modal reusable for edit flows
- Progress bar reusable in dashboards
- Table reusable for other periods

**Alternative Considered**: Monolithic benefit card component
- Would be 500+ lines
- Hard to test individually
- Low reusability
- Maintenance nightmare

---

### 5. **No UI Component Library Dependency**

**Decision**: Use plain HTML + Tailwind CSS instead of shadcn/ui

**Rationale**:
- Project doesn't have UI library set up
- Tailwind sufficient for required functionality
- Reduces dependencies
- Simpler styling maintenance
- Faster development

**Trade-off**: Slightly more CSS code vs framework
- Acceptable: Tailwind handles 95% of styling needs
- Components still clean and readable

---

### 6. **Database: Work with Existing Schema**

**Decision**: Adapt to existing UserBenefit model instead of requiring migration

**Rationale**:
- Zero migration risk
- Backwards compatible
- No database downtime required
- Existing claims continue to work
- Flexible: Can migrate schema later if needed

**How**:
- Use `userBenefitId` as benefit reference
- Use existing `BenefitUsageRecord` model
- Store `usageDate` instead of `periodStart/periodEnd`
- Calculate periods on-the-fly using utility functions

---

### 7. **UTC-Only for Period Calculations**

**Decision**: All period boundaries calculated in UTC

**Rationale**:
- Eliminates timezone ambiguity
- Card anniversaries consistent globally
- Period boundaries don't "shift" for different users
- Cleaner calculation logic
- Database stores UTC timestamps

**Trade-off**: Frontend must convert to local timezone for display
- Acceptable: JavaScript handles automatically
- User sees correct local time in UI

---

### 8. **Partial Claims: Cumulative Model**

**Decision**: Allow multiple claims per period (cumulative)

**Rationale**:
- Matches real-world usage patterns
- User might remember partial spending over time
- Don't force all-or-nothing claiming
- Actual implementation simpler (just sum claims)

**Alternative Considered**: Allow only one claim per period
- Too restrictive
- Users might lose track of partial spending
- Doesn't match real habits

---

### 9. **Soft Delete Support (Infrastructure)**

**Decision**: Include `deletedAt` field support in responses (not yet used)

**Rationale**:
- Common enterprise pattern
- Future-proofs for 30-day recovery feature
- Can implement without schema change
- Infrastructure in place, feature togglegable

**Status**: Infrastructure ready, hard delete only for now
- Can add soft delete feature in Phase 6B without code changes

---

### 10. **Error Handling: Detailed Error Codes**

**Decision**: Return structured error responses with codes (VALIDATION_ERROR, UNAUTHORIZED, etc.)

**Rationale**:
- Frontend can show context-specific messages
- Easier internationalization
- Better debugging
- Prevents exposing internal details

**Response Format**:
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "User-friendly message",
  "details": { "field": "value" },
  "statusCode": 400
}
```

---

## Implementation Decisions

### 1. **Cadence Strategy: Enum Over Strings**

**Decision**: Use ResetCadence type union instead of raw strings

```typescript
type ResetCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
```

**Rationale**:
- Type-safe: Compiler catches typos
- Exhaustiveness checking in switch statements
- Clear enumeration of valid options
- Self-documenting code

---

### 2. **Period Boundaries: Inclusive Start, Exclusive End Pattern**

**Decision**: `periodStart` is inclusive, `periodEnd` is 23:59:59.999 UTC

**Why**:
- Matches calendar expectations (first to last day)
- No ambiguity at period boundaries
- Queries use `gte start` and `lte end` safely

---

### 3. **Amount Storage: Decimal (Cents)**

**Decision**: Store all amounts in cents as integers in calculations

**Rationale**:
- Avoid floating-point precision errors
- No currency rounding issues
- Standard in finance applications
- API accepts amounts in dollars, converts internally

---

### 4. **Period Calculation Caching: Component State**

**Decision**: Calculate periods once on component mount, cache in state

**Rationale**:
- Calculations fast but not free
- Period doesn't change during session
- Reduces re-renders
- Clean up with useEffect

---

### 5. **Pagination: Server-Side**

**Decision**: Paginate records on server, not client

**Rationale**:
- Users might have 1000+ records
- Memory efficient
- Scalable as data grows
- Standard API pattern

**Limits**:
- Default: 20 records per page
- Maximum: 100 per page
- Prevents accidental full-table fetches

---

### 6. **Validation: Two-Tier Approach**

**Decision**: Client-side + server-side validation

**Client-side**: Real-time feedback (UX)
- Amount can't exceed available
- Notes max 500 chars
- All fields required

**Server-side**: Security enforcement
- User must own card
- Benefit must exist
- Amount verified again
- Duplicate checks

**Why**: Defense in depth
- Client validation bypassed by hackers
- Server-side catches real errors
- Client improves UX

---

## Trade-offs & Compromises

### 1. **No GraphQL, No Advanced Querying**

**Trade-off**: Cannot query nested period data in single request
**Why**: RESTful approach simpler for team, sufficient for requirements
**Future**: Could add GraphQL layer later if needed

### 2. **Finite Historical Periods (24 instead of infinite)**

**Trade-off**: Users can't access very old claims
**Why**: Real users rarely need 5-year-old data, simplifies UX
**Future**: Could allow "custom date range" if demand appears

### 3. **No Real-Time Updates**

**Trade-off**: Multiple tabs won't auto-refresh
**Why**: Added complexity not justified by requirements
**Future**: Could add WebSocket/polling if needed

### 4. **Hard Delete Only (No Undo)**

**Trade-off**: Deleted claims can't be recovered
**Why**: Soft delete infrastructure in place, can add later
**Future**: 30-day recovery feature could be implemented

---

## Code Quality Decisions

### 1. **TypeScript Strict Mode**

**Decision**: All code uses `strict: true` in tsconfig

**Ensures**:
- No implicit `any` types
- Null/undefined checks
- Type safety throughout

---

### 2. **JSDoc Comments for Utilities**

**Decision**: Comprehensive JSDoc on all public functions

**Why**:
- IDE auto-complete help
- Documentation in code
- Clear parameter expectations

---

### 3. **Consistent Error Logging**

**Decision**: All errors logged via `logSafeError()` without PII

**Protects**:
- User privacy
- Compliance (GDPR, etc.)
- Debuggability (non-sensitive errors logged)

---

## Performance Decisions

### 1. **Database Indexes**

**Decision**: Existing schema already has appropriate indexes

**Current Indexes**:
- `userId` - query by user
- `benefitId` - query by benefit
- `usageDate` - filter by date range

---

### 2. **Pagination Defaults**

**Decision**: 20 records per page by default, 100 max

**Rationale**:
- 20: Good UX, prevents slow queries
- 100: Allows power users to fetch more
- Not unlimited: Protects from DoS

---

### 3. **Lazy Loading**

**Decision**: Fetch data only when needed, not on mount

**Example**: Historical records only fetched when user clicks "History" tab

**Benefit**: Faster initial page load

---

## Security Decisions

### 1. **User Ownership Verification**

**Decision**: Every endpoint verifies `userId` owns the card/benefit

```typescript
if (existing.userId !== userId) {
  // Reject
}
```

**Prevents**: Users accessing other users' claims

### 2. **No Soft Delete by Default**

**Decision**: Hard delete records (can't recover)

**Rationale**: 
- Simpler logic
- Users can edit instead of delete
- Soft delete infrastructure ready for future

### 3. **Future Dates Rejected**

**Decision**: Cannot record usage for dates in future

```typescript
if (usageDate > now) {
  // Reject
}
```

**Prevents**: Gaming/fraud with future claims

---

## Testing Strategy

### Unit Tests

**Scope**: Period calculation utilities

**Coverage**:
- All cadences (monthly, quarterly, semi-annual, annual)
- Edge cases (leap years, month ends, year boundaries)
- Label generation
- Period comparison

---

### Integration Tests

**Scope**: API endpoints

**Coverage**:
- POST: Create with validation
- GET: Pagination and filtering
- PATCH: Update validation
- DELETE: Ownership verification

---

### E2E Scenarios

**Scope**: User workflows

**Coverage**:
- Claim full benefit in one period
- Partial claim + complete later
- Edit historical claim
- Delete claim

---

## Monitoring & Observability

### Logging Strategy

**What's Logged**:
- API errors (non-sensitive)
- Failed validations (error type only)
- Usage patterns (anonymized)

**Not Logged**:
- PII (user IDs, emails)
- Sensitive claim amounts
- Notes content

---

### Metrics to Track

**Recommended**:
- Claims per day / per user
- Average claim amount
- Period distribution (which cadences used most)
- Error rates by endpoint
- API response times

---

## Backward Compatibility

### Strategy

**No Breaking Changes**:
- Existing UserBenefit records continue to work
- Old usage records accessible
- API responses backward compatible

**Upgrade Path**:
- Phase 6A: New period system runs alongside old binary system
- Users see new UI for new claims
- Old claims still visible (converted to period format)
- No mandatory migration for users

---

## Future Considerations

### Phase 6B Enhancements

1. **Soft Delete + 30-Day Recovery**
   - Set `deletedAt` instead of deleting
   - Allow restore within 30 days
   - "Trash" functionality

2. **Bulk Import**
   - CSV upload of historical claims
   - Validation before import
   - Duplicate detection

3. **Admin Dashboard**
   - View all user claims
   - Dispute resolution UI
   - Analytics

4. **Notifications**
   - Remind before period reset
   - Low-balance alerts
   - Monthly digest

### Phase 6C Enhancements

1. **Advanced Querying**
   - Filter by benefit category
   - Comparison across cards
   - Time-series analytics

2. **Auto-Claiming**
   - Detect spending and auto-claim
   - Confidence scores
   - User approval workflow

3. **Custom Periods**
   - Beyond standard cadences
   - User-specific reset dates
   - Irregular schedules

---

## Summary

Phase 6 implementation prioritizes:

✅ **Simplicity** - Vanilla approach, minimal dependencies
✅ **Safety** - Server-side validation, user verification
✅ **Scalability** - Pagination, indexing, efficient queries
✅ **Maintainability** - Clear code, comprehensive comments
✅ **Backward Compatibility** - Zero breaking changes
✅ **User Experience** - Intuitive UI, real-time feedback
✅ **Type Safety** - TypeScript strict mode throughout
✅ **Error Handling** - Detailed error codes and messages

All decisions align with current tech stack and team practices.
Ready for production deployment.
