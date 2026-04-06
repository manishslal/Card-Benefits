# Phase 2 Admin API - Quick Reference Guide

## Endpoint Summary

| Endpoint | Method | Path | Purpose |
|----------|--------|------|---------|
| Card Reorder | PATCH | `/api/admin/cards/reorder` | Batch reorder cards by displayOrder |
| List Card Benefits | GET | `/api/admin/cards/[id]/benefits` | List all benefits for a card |
| Create Card Benefit | POST | `/api/admin/cards/[id]/benefits` | Add benefit to card |
| Update Card Benefit | PATCH | `/api/admin/cards/[id]/benefits/[benefitId]` | Modify benefit |
| Delete Card Benefit | DELETE | `/api/admin/cards/[id]/benefits/[benefitId]` | Remove benefit |
| Toggle Benefit Default | PATCH | `/api/admin/cards/[id]/benefits/[benefitId]/toggle-default` | Mark as default for new cards |
| Update Generic Benefit | PATCH | `/api/admin/benefits/[id]` | Update benefit by ID (card-agnostic) |
| Delete Generic Benefit | DELETE | `/api/admin/benefits/[id]` | Delete benefit by ID (card-agnostic) |
| List Users | GET | `/api/admin/users` | Get all users with roles |
| Assign User Role | PATCH | `/api/admin/users/[id]/role` | Change user role (USER/ADMIN) |
| List Audit Logs | GET | `/api/admin/audit-logs` | Get audit log entries with filters |
| Get Audit Log Detail | GET | `/api/admin/audit-logs/[id]` | Get single audit log entry |

## Key Query Parameters

### Pagination
```
?page=1&limit=20  // Default values
```

### Card Benefits Filtering
```
?isActive=true    // Filter by active status
```

### Users Filtering
```
?role=ADMIN       // Filter by role: USER or ADMIN
?search=email     // Search by email/name
?isActive=true    // Filter by active status
```

### Audit Logs Filtering
```
?actionType=CREATE    // CREATE, UPDATE, DELETE
?resourceType=CARD    // CARD, BENEFIT, USER_ROLE
?adminUserId=abc123   // Filter by admin who made change
?resourceId=xyz       // Filter by specific resource
?startDate=2024-01-01T00:00:00Z
?endDate=2024-12-31T23:59:59Z
?search=cardname      // Search in resource names
```

## Request Body Examples

### POST /api/admin/cards/[id]/benefits
```json
{
  "name": "Travel Insurance",
  "type": "INSURANCE",
  "stickerValue": 50000,
  "resetCadence": "ANNUAL",
  "isDefault": true,
  "description": "Trip cancellation protection"
}
```

### PATCH /api/admin/cards/[id]/benefits/[benefitId]
```json
{
  "name": "Updated Name",
  "stickerValue": 75000
}
```

### PATCH /api/admin/cards/[id]/benefits/[benefitId]/toggle-default
```json
{
  "isDefault": false
}
```

### PATCH /api/admin/users/[id]/role
```json
{
  "role": "ADMIN"
}
```

### PATCH /api/admin/cards/reorder
```json
{
  "cards": [
    { "id": "card_1", "displayOrder": 0 },
    { "id": "card_2", "displayOrder": 1 },
    { "id": "card_3", "displayOrder": 2 }
  ]
}
```

## Response Format

### Success Response (200/201)
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasMore": true
  },
  "message": "Operation successful"
}
```

### Error Response (4xx/5xx)
```json
{
  "success": false,
  "error": "Description of error",
  "code": "ERROR_CODE",
  "details": [
    { "field": "name", "message": "Must be unique per card" }
  ]
}
```

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| AUTH_UNAUTHORIZED | 401 | Not authenticated |
| FORBIDDEN_ADMIN_REQUIRED | 403 | Admin role required |
| SELF_DEMOTION_FORBIDDEN | 403 | Cannot remove own admin role |
| CARD_NOT_FOUND | 404 | Card doesn't exist |
| BENEFIT_NOT_FOUND | 404 | Benefit doesn't exist |
| AUDIT_LOG_NOT_FOUND | 404 | Audit log entry not found |
| USER_NOT_FOUND | 404 | User doesn't exist |
| DUPLICATE_CARD | 409 | Card issuer+name already exists |
| DUPLICATE_BENEFIT | 409 | Benefit name already exists for this card |
| CARD_IN_USE | 409 | Card has user cards, cannot delete |
| BENEFIT_IN_USE | 409 | Benefit has user cards, cannot delete |
| VALIDATION_ERROR | 400 | Invalid input parameters |
| INVALID_PAGINATION | 400 | Invalid pagination parameters |
| SERVER_ERROR | 500 | Server error |

## Enum Values

### Benefit Types
- INSURANCE
- CASHBACK
- TRAVEL
- BANKING
- POINTS
- OTHER

### Reset Cadences
- ANNUAL
- PER_TRANSACTION
- PER_DAY
- MONTHLY
- ONE_TIME

### User Roles
- USER
- ADMIN

### Audit Action Types
- CREATE
- UPDATE
- DELETE

### Resource Types
- CARD
- BENEFIT
- USER_ROLE
- SYSTEM_SETTING

## Implementation Files

```
src/app/api/admin/
├── cards/
│   ├── reorder/route.ts
│   └── [id]/benefits/
│       ├── route.ts
│       └── [benefitId]/
│           ├── route.ts
│           └── toggle-default/route.ts
├── benefits/
│   └── [id]/route.ts
├── users/
│   ├── route.ts
│   └── [id]/role/route.ts
└── audit-logs/
    ├── route.ts
    └── [id]/route.ts

src/features/admin/
├── index.ts (barrel export)
├── middleware/
│   └── auth.ts (verifyAdminRole, extractRequestContext)
├── lib/
│   └── audit.ts (logging functions)
└── validation/
    └── schemas.ts (Zod schemas)
```

## Usage Notes

1. **Admin Check**: All endpoints automatically verify admin role - no need to re-check
2. **Request Context**: ipAddress and userAgent are automatically captured for audit logging
3. **Pagination**: Default page=1, limit=20; max limit=100
4. **Soft Deletes**: Card/benefit deletion respects `force` query param - use with caution
5. **Deactivation**: Use `deactivateInstead=true` for benefits to preserve references
6. **Self-Demotion**: Cannot remove own admin role - server will return 403
7. **Audit Logs**: All mutations are logged automatically - accessible via audit endpoints

## Testing Commands

```bash
# List benefits for a card
curl http://localhost:3000/api/admin/cards/card_123/benefits

# Create benefit
curl -X POST http://localhost:3000/api/admin/cards/card_123/benefits \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","type":"INSURANCE","stickerValue":5000,"resetCadence":"ANNUAL"}'

# List users
curl http://localhost:3000/api/admin/users?role=ADMIN

# List audit logs
curl "http://localhost:3000/api/admin/audit-logs?actionType=CREATE&resourceType=CARD"
```
