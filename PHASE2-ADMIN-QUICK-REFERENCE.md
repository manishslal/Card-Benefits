# Phase 2 Admin API - Quick Reference

## Quick Endpoint Summary

### Card Management (6 endpoints)
```
GET    /api/admin/cards                    # List all cards
POST   /api/admin/cards                    # Create card
GET    /api/admin/cards/[id]               # Get card detail
PATCH  /api/admin/cards/[id]               # Update card
DELETE /api/admin/cards/[id]               # Delete card
PATCH  /api/admin/cards/reorder            # Reorder cards
```

### Benefit Management (5 endpoints)
```
GET    /api/admin/cards/[id]/benefits              # List benefits for card
POST   /api/admin/cards/[id]/benefits              # Create benefit
PATCH  /api/admin/cards/[id]/benefits/[id]        # Update benefit
DELETE /api/admin/cards/[id]/benefits/[id]        # Delete benefit
PATCH  /api/admin/cards/[id]/benefits/[id]/toggle-default  # Toggle default
```

### User Management (2 endpoints)
```
GET    /api/admin/users              # List users
PATCH  /api/admin/users/[id]/role    # Update user role
```

### Audit Logs (2 endpoints)
```
GET    /api/admin/audit-logs         # List audit logs
GET    /api/admin/audit-logs/[id]    # Get audit log detail
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request succeeded |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Not authenticated |
| 403 | Forbidden - Not admin |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate or in-use error |
| 500 | Server Error - Internal error |

## Response Format

### Success
```json
{
  "success": true,
  "data": { },
  "pagination": { "total": 0, "page": 1, "limit": 20, "totalPages": 0, "hasMore": false }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": [{"field": "name", "message": "Error"}]
}
```

## Files Created

- `src/features/admin/validation/schemas.ts` - Zod validation
- `src/features/admin/middleware/auth.ts` - Admin auth
- `src/features/admin/lib/audit.ts` - Audit logging
- `src/features/admin/index.ts` - Barrel export
- `src/app/api/admin/cards/route.ts` - List & create cards
- `src/app/api/admin/cards/[id]/route.ts` - Detail, update, delete
- `src/app/api/admin/cards/reorder/route.ts` - Reorder
- `src/app/api/admin/cards/[id]/benefits/route.ts` - Benefit list & create
- `src/app/api/admin/cards/[id]/benefits/[id]/route.ts` - Benefit update & delete
- `src/app/api/admin/cards/[id]/benefits/[id]/toggle-default/route.ts` - Toggle default
- `src/app/api/admin/benefits/[id]/route.ts` - Generic benefit operations
- `src/app/api/admin/users/route.ts` - List users
- `src/app/api/admin/users/[id]/role/route.ts` - Update role
- `src/app/api/admin/audit-logs/route.ts` - List logs
- `src/app/api/admin/audit-logs/[id]/route.ts` - Log detail

