# Admin Management Feature - Quick Reference

## �� Document Location
`.github/specs/admin-feature-spec.md` - Full 2,268-line technical specification

## 🎯 Quick Overview

| Aspect | Details |
|--------|---------|
| **Feature** | Admin dashboard for managing card types, benefits, and user roles |
| **Scope** | 3 main areas: Cards, Benefits, Users + Audit Logging |
| **Timeline** | 11-15 days (4 phases) |
| **Database** | PostgreSQL with Prisma ORM |
| **Auth** | JWT + Session with role-based access control |
| **Testing** | Unit tests (80%+), E2E tests, security audit |

## 🏗️ Architecture

### Database Changes Required
- Add `role` enum field to User model (USER, ADMIN)
- Create `AdminAuditLog` table (comprehensive audit trail)
- Extend MasterCard: `displayOrder`, `isArchived`, `isActive`
- Extend MasterBenefit: `isDefault`, `isActive`

### API Layer (17 endpoints)
```
Cards:        GET/POST/PATCH/DELETE /api/admin/cards[/id]
Benefits:     GET/POST/PATCH/DELETE /api/admin/cards/[id]/benefits[/id]
Users:        GET /api/admin/users, PATCH /api/admin/users/[id]/role
Audit Logs:   GET /api/admin/audit-logs[/id]
```

### UI Components
```
- AdminLayout (sidebar nav, header)
- CardsListSection (table, pagination, search)
- CardFormModal (create/edit forms)
- BenefitsTable (benefit management)
- UsersListSection (role assignment)
- AuditLogSection (audit trail viewer)
- Common: modals, confirmations, notifications
```

## 📊 Implementation Phases

### Phase 1: Database & Auth (2-3 days)
- [ ] Add role field to User model
- [ ] Create AdminAuditLog table
- [ ] Create audit logging helper
- [ ] Extend auth context for admin role
- [ ] Protect /admin/* routes in middleware

### Phase 2: API Layer (3-4 days)
- [ ] Card CRUD endpoints (5 endpoints)
- [ ] Benefit CRUD endpoints (5 endpoints)
- [ ] User role endpoints (2 endpoints)
- [ ] Audit log endpoints (2 endpoints)
- [ ] Validation & error handling
- [ ] API tests (80%+ coverage)

### Phase 3: Admin Dashboard UI (4-5 days)
- [ ] Admin layout & navigation
- [ ] Cards management interface
- [ ] Benefits management interface
- [ ] Users & role assignment
- [ ] Audit log viewer
- [ ] E2E tests for critical flows

### Phase 4: Testing & Polish (2-3 days)
- [ ] Security audit
- [ ] Performance testing
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Documentation
- [ ] Code review & refinement

## 🔐 Security Checklist

- [ ] Admin role verification on every /admin/* request
- [ ] JWT signature verification + database session check
- [ ] Input validation (API level + DB constraints)
- [ ] Audit logging for all changes (CREATE, UPDATE, DELETE)
- [ ] No sensitive data in error messages
- [ ] XSS prevention (output sanitization)
- [ ] SQL injection prevention (parameterized queries)
- [ ] CSRF protection on state-changing operations
- [ ] Session revocation effective immediately

## 🚨 Key Edge Cases Handled

1. ✅ Concurrent card edits (last-write-wins, future: optimistic locking)
2. ✅ Deleting cards used by users (safety check, archive option)
3. ✅ Benefit default flag changes (only affects new user cards)
4. ✅ Admin role revocation mid-request (401 response)
5. ✅ Invalid card image URLs (validation + error message)
6. ✅ Duplicate benefit names (409 conflict, show existing)
7. ✅ Race condition on unique constraint (409 conflict)
8. ✅ Large user lists (pagination, indexed search)
9. ✅ Audit log storage limits (2-year retention policy)
10. ✅ Self-demotion prevention (UI warning + API check)
11. ✅ Large concurrent admin operations (pagination, rate limiting)
12. ✅ Circular dependencies (design prevents them)

## 📈 Performance Targets

| Operation | Target | Achievable |
|-----------|--------|-----------|
| Load card list | < 500ms (p95) | ✅ With pagination + indexes |
| Create card | < 1000ms (p95) | ✅ With validation + audit log |
| Search audit logs | < 1000ms (p95) | ✅ With proper indexing |
| Render admin dashboard | < 2000ms (p95) | ✅ With React Query caching |

## 📝 Data Validation Rules

### Card Creation
- Issuer: required, string, max 100 chars
- Card Name: required, string, max 200 chars
- Annual Fee: required, integer ≥ 0 (cents)
- Card Image URL: required, valid and accessible
- (issuer, cardName) must be unique

### Benefit Creation
- Name: required, string, max 200 chars, unique per card
- Type: required, enum (INSURANCE, CASHBACK, TRAVEL, BANKING, POINTS, OTHER)
- Value: required, integer ≥ 0
- Cadence: required, enum (ANNUAL, PER_TRANSACTION, PER_DAY, MONTHLY, ONE_TIME)

### User Role Change
- Cannot demote self (checked at API + UI)
- Any user can be promoted to ADMIN
- Any ADMIN can be demoted to USER (except self)

## 🔄 Audit Logging Schema

Every admin action creates an audit log entry:
```
{
  id: string
  actionType: CREATE | UPDATE | DELETE
  resourceType: CARD | BENEFIT | USER_ROLE
  resourceId: string
  resourceName: string
  adminUserId: string (who made the change)
  oldValues: JSON (before values)
  newValues: JSON (after values)
  timestamp: DateTime
  ipAddress: string
  userAgent: string
}
```

## 🧪 Testing Strategy

### Unit Tests
- Validation functions
- Audit logging helper
- Role checking utilities
- Pagination logic

### Integration Tests
- All API endpoints (success + error cases)
- Database transactions
- Authorization checks
- Audit log creation

### E2E Tests
- Create card flow (form → API → DB → list update)
- Edit card flow
- Delete card with safety checks
- Assign admin role flow
- View audit logs with filters

### Security Tests
- SQL injection attempts
- XSS payload attempts
- Unauthorized access attempts
- CSRF attacks
- Rate limiting enforcement

## 📦 Dependencies & Technology

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 15.0.0 |
| Language | TypeScript | 5.3.0 |
| Styling | Tailwind CSS | 3.4.19 |
| Components | shadcn/ui | - |
| ORM | Prisma | 5.8.0 |
| Database | PostgreSQL | 12+ |
| Auth | JWT (jsonwebtoken) | 9.0.3 |
| Testing | Vitest | 4.1.2 |
| E2E | Playwright | 1.59.0 |

## 🎯 Success Criteria

**Functionality:**
- ✅ All CRUD operations working (cards, benefits, users, logs)
- ✅ Admin dashboard responsive and intuitive
- ✅ Role-based access control functional
- ✅ Audit logging comprehensive

**Quality:**
- ✅ 80%+ test coverage for APIs
- ✅ Zero TypeScript errors
- ✅ No security vulnerabilities
- ✅ Performance targets met

**Operations:**
- ✅ Deployment runbook created
- ✅ API documentation (Swagger/OpenAPI)
- ✅ Admin user guide created
- ✅ Monitoring/alerting configured

## 📚 Document Sections

1. **Executive Summary** - Goals and business value
2. **Functional Requirements** - Features and constraints
3. **Implementation Phases** - 4-phase breakdown
4. **Data Schema** - Database design and relationships
5. **User Flows** - Complete user journeys (5 main flows)
6. **API Routes** - Full endpoint specifications (17 endpoints)
7. **Edge Cases** - 12 documented edge cases with handling
8. **Component Architecture** - UI component breakdown (10+ components)
9. **Implementation Tasks** - 45+ specific, actionable tasks
10. **Security & Compliance** - Auth, RBAC, audit, data protection
11. **Performance & Scalability** - Caching, indexing, rate limiting

## 🚀 Next Steps

1. **Review & Approval:** Have team review specification for completeness
2. **Database Design:** Finalize Prisma schema, create migration
3. **API Implementation:** Start with Phase 2 API endpoints
4. **UI Development:** Build admin dashboard components in parallel
5. **Testing:** Write tests as features are implemented
6. **Deployment:** Follow deployment runbook

---

**Status:** ✅ Specification Complete and Ready for Implementation  
**Version:** 1.0  
**Last Updated:** February 2024
