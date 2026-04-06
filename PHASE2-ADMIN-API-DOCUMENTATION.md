# Phase 2 Admin API - Complete Documentation

## Overview

Phase 2 delivers a complete Admin Management API for the Card-Benefits application, enabling administrative users to manage the master card catalog, benefits, user roles, and audit trails.

**Total Endpoints Implemented: 15**
- Card Management: 6 endpoints
- Benefit Management: 5 endpoints  
- User Role Management: 2 endpoints
- Audit Logging: 2 endpoints

---

## Authentication & Authorization

All endpoints require:
1. **Valid session token** - Verified via secure cookie in middleware
2. **Admin role** - User must have `role = 'ADMIN'` in database
3. **Request context** - IP address and User-Agent captured automatically

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Not authenticated",
  "code": "AUTH_UNAUTHORIZED"
}
```

#### 403 Forbidden  
```json
{
  "success": false,
  "error": "Admin access required",
  "code": "FORBIDDEN_ADMIN_REQUIRED"
}
```

---

## Card Management API

### 1. List Cards
```
GET /api/admin/cards
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20, max: 100) - Cards per page
- `issuer` (optional) - Filter by issuer (case-insensitive)
- `search` (optional) - Search in cardName and issuer
- `isActive` (optional) - Filter by active status (true/false)
- `sortBy` (optional, default: 'displayOrder') - 'issuer' | 'cardName' | 'displayOrder' | 'updatedAt'
- `sortDirection` (optional, default: 'asc') - 'asc' | 'desc'

**Response 200 (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": "card_123",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.png",
      "displayOrder": 1,
      "isActive": true,
      "isArchived": false,
      "benefitCount": 8,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

### 2. Get Card Detail
```
GET /api/admin/cards/:cardId
```

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Chase Sapphire Preferred",
    "defaultAnnualFee": 9500,
    "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.png",
    "displayOrder": 1,
    "isActive": true,
    "isArchived": false,
    "description": "Premium travel card",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-20T14:30:00Z",
    "benefits": [
      {
        "id": "benefit_123",
        "name": "Travel Insurance",
        "type": "INSURANCE",
        "stickerValue": 50000,
        "resetCadence": "ANNUAL",
        "isDefault": true,
        "isActive": true,
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "userCardCount": 234
  }
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}
```

---

### 3. Create Card
```
POST /api/admin/cards
Content-Type: application/json

{
  "issuer": "Amex",
  "cardName": "American Express Gold",
  "defaultAnnualFee": 29900,
  "cardImageUrl": "https://cdn.example.com/cards/amex-gold.png",
  "description": "Premium Gold card"
}
```

**Validation Rules:**
- `issuer`: required, 1-100 characters
- `cardName`: required, 1-200 characters
- `defaultAnnualFee`: required, integer >= 0
- `cardImageUrl`: required, valid URL
- `description`: optional, max 1000 characters
- **Uniqueness**: (issuer, cardName) combination must be unique

**Response 201 (Created):**
```json
{
  "success": true,
  "data": {
    "id": "card_456",
    "issuer": "Amex",
    "cardName": "American Express Gold",
    "defaultAnnualFee": 29900,
    "cardImageUrl": "https://cdn.example.com/cards/amex-gold.png",
    "displayOrder": 0,
    "isActive": true,
    "isArchived": false,
    "createdAt": "2024-02-01T12:00:00Z",
    "updatedAt": "2024-02-01T12:00:00Z"
  },
  "message": "Card created successfully"
}
```

**Response 409 (Duplicate):**
```json
{
  "success": false,
  "error": "A card with this issuer and name already exists",
  "code": "DUPLICATE_CARD",
  "existingCardId": "card_123"
}
```

---

### 4. Update Card
```
PATCH /api/admin/cards/:cardId
Content-Type: application/json

{
  "cardName": "Updated Name",
  "defaultAnnualFee": 15000,
  "cardImageUrl": "https://...",
  "description": "Updated description"
}
```

**Validation Rules:**
- All fields optional (PATCH semantics)
- `issuer` cannot be changed
- Same validation rules as create
- Duplicate check for cardName + issuer

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Updated Name",
    "defaultAnnualFee": 15000,
    "cardImageUrl": "https://...",
    "displayOrder": 1,
    "isActive": true,
    "isArchived": false,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Card updated successfully",
  "changes": {
    "cardName": { "old": "Chase Sapphire Preferred", "new": "Updated Name" },
    "defaultAnnualFee": { "old": 9500, "new": 15000 }
  }
}
```

---

### 5. Delete Card
```
DELETE /api/admin/cards/:cardId?force=false&archiveInstead=false
```

**Query Parameters:**
- `force` (optional, default: false) - Force delete even if users have card
- `archiveInstead` (optional, default: false) - Soft delete (archive) instead of hard delete

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Card deleted successfully",
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Chase Sapphire Preferred"
  }
}
```

**Response 409 (Card In Use):**
```json
{
  "success": false,
  "error": "Card cannot be deleted: it is used by 42 user(s)",
  "code": "CARD_IN_USE",
  "userCardCount": 42,
  "suggestion": "Archive the card instead or use force=true to delete anyway"
}
```

---

### 6. Reorder Cards
```
PATCH /api/admin/cards/reorder
Content-Type: application/json

{
  "cards": [
    { "id": "card_123", "displayOrder": 0 },
    { "id": "card_456", "displayOrder": 1 },
    { "id": "card_789", "displayOrder": 2 }
  ]
}
```

**Validation Rules:**
- `cards` array required, at least 1 item
- Each item must have `id` and `displayOrder`
- `displayOrder` must be non-negative integer

**Response 200 (Success):**
```json
{
  "success": true,
  "message": "Cards reordered successfully",
  "data": {
    "updated": 3,
    "cards": [
      { "id": "card_123", "displayOrder": 0 },
      { "id": "card_456", "displayOrder": 1 },
      { "id": "card_789", "displayOrder": 2 }
    ]
  }
}
```

---

## Benefit Management API

### 1. List Benefits for Card
```
GET /api/admin/cards/:cardId/benefits?page=1&limit=50&isActive=true
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 100)
- `isActive` (optional) - Filter by active status

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "benefit_123",
      "masterCardId": "card_123",
      "name": "Travel Insurance",
      "type": "INSURANCE",
      "stickerValue": 50000,
      "resetCadence": "ANNUAL",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### 2. Create Benefit
```
POST /api/admin/cards/:cardId/benefits
Content-Type: application/json

{
  "name": "Travel Insurance",
  "type": "INSURANCE",
  "stickerValue": 50000,
  "resetCadence": "ANNUAL",
  "isDefault": true,
  "description": "Trip protection up to $50k"
}
```

**Validation Rules:**
- `name`: required, 1-200 characters, unique per card
- `type`: required, enum: INSURANCE | CASHBACK | TRAVEL | BANKING | POINTS | OTHER
- `stickerValue`: required, integer >= 0
- `resetCadence`: required, enum: ANNUAL | PER_TRANSACTION | PER_DAY | MONTHLY | ONE_TIME
- `isDefault`: optional, default: true
- `description`: optional, max 1000 characters

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "benefit_456",
    "masterCardId": "card_123",
    "name": "Travel Insurance",
    "type": "INSURANCE",
    "stickerValue": 50000,
    "resetCadence": "ANNUAL",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2024-02-01T12:00:00Z",
    "updatedAt": "2024-02-01T12:00:00Z"
  },
  "message": "Benefit created successfully"
}
```

---

### 3. Update Benefit
```
PATCH /api/admin/cards/:cardId/benefits/:benefitId
Content-Type: application/json

{
  "stickerValue": 75000,
  "isDefault": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "benefit_123",
    "masterCardId": "card_123",
    "name": "Travel Insurance",
    "type": "INSURANCE",
    "stickerValue": 75000,
    "resetCadence": "ANNUAL",
    "isDefault": false,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Benefit updated successfully",
  "changes": {
    "stickerValue": { "old": 50000, "new": 75000 },
    "isDefault": { "old": true, "new": false }
  }
}
```

---

### 4. Delete Benefit
```
DELETE /api/admin/cards/:cardId/benefits/:benefitId?force=false&deactivateInstead=false
```

**Query Parameters:**
- `force` (optional, default: false)
- `deactivateInstead` (optional, default: false) - Soft delete

**Response 200:**
```json
{
  "success": true,
  "message": "Benefit deleted successfully"
}
```

---

### 5. Toggle Benefit Default
```
PATCH /api/admin/cards/:cardId/benefits/:benefitId/toggle-default
Content-Type: application/json

{
  "isDefault": true
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "benefit_123",
    "isDefault": true,
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Benefit default status updated"
}
```

---

## User Role Management API

### 1. List Users
```
GET /api/admin/users?page=1&limit=50&role=ADMIN&search=john&isActive=true
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 100)
- `role` (optional) - Filter by role: USER | ADMIN
- `search` (optional) - Search by email or name
- `isActive` (optional) - Filter by active status

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00Z",
      "lastLoginAt": "2024-02-01T15:00:00Z"
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "totalPages": 25,
    "hasMore": true
  }
}
```

---

### 2. Assign/Update User Role
```
PATCH /api/admin/users/:userId/role
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Validation Rules:**
- `role`: required, enum: USER | ADMIN
- Self-demotion prevention: returns 403 if trying to remove own admin role

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user_456",
    "email": "user@example.com",
    "role": "ADMIN",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "User role updated to ADMIN"
}
```

**Response 403 (Self-Demotion):**
```json
{
  "success": false,
  "error": "Cannot remove your own admin role",
  "code": "CANNOT_SELF_DEMOTE"
}
```

---

## Audit Log API

### 1. List Audit Logs
```
GET /api/admin/audit-logs?page=1&limit=50&actionType=UPDATE&resourceType=CARD&startDate=2024-01-01T00:00:00Z&endDate=2024-02-01T23:59:59Z&search=gold
```

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 50, max: 100)
- `actionType` (optional) - CREATE | UPDATE | DELETE
- `resourceType` (optional) - CARD | BENEFIT | USER_ROLE | SYSTEM_SETTING
- `adminUserId` (optional) - Filter by admin who made change
- `resourceId` (optional) - Filter by specific resource
- `startDate` (optional) - ISO 8601 datetime
- `endDate` (optional) - ISO 8601 datetime
- `search` (optional) - Search resource names

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "actionType": "UPDATE",
      "resourceType": "CARD",
      "resourceId": "card_123",
      "resourceName": "Chase Sapphire Preferred",
      "adminUserId": "admin_001",
      "adminEmail": "admin@example.com",
      "timestamp": "2024-02-01T15:00:00Z",
      "ipAddress": "192.168.1.1",
      "oldValues": {
        "defaultAnnualFee": 9500
      },
      "newValues": {
        "defaultAnnualFee": 15000
      }
    }
  ],
  "pagination": {
    "total": 5432,
    "page": 1,
    "limit": 50,
    "totalPages": 109,
    "hasMore": true
  }
}
```

---

### 2. Get Audit Log Detail
```
GET /api/admin/audit-logs/:logId
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "log_123",
    "actionType": "UPDATE",
    "resourceType": "CARD",
    "resourceId": "card_123",
    "resourceName": "Chase Sapphire Preferred",
    "adminUserId": "admin_001",
    "adminUser": {
      "id": "admin_001",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "timestamp": "2024-02-01T15:00:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "oldValues": {
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://old-url.com/card.png"
    },
    "newValues": {
      "defaultAnnualFee": 15000,
      "cardImageUrl": "https://new-url.com/card.png"
    },
    "changes": [
      {
        "field": "defaultAnnualFee",
        "old": 9500,
        "new": 15000
      }
    ]
  }
}
```

---

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| AUTH_UNAUTHORIZED | 401 | Not authenticated or session expired |
| FORBIDDEN_ADMIN_REQUIRED | 403 | User doesn't have admin role |
| INVALID_PAGINATION | 400 | Invalid page/limit parameters |
| INVALID_REQUEST_BODY | 400 | Malformed JSON |
| VALIDATION_ERROR | 400 | Field validation failed |
| CARD_NOT_FOUND | 404 | Card doesn't exist |
| DUPLICATE_CARD | 409 | Card (issuer, name) already exists |
| CARD_IN_USE | 409 | Card has user cards, can't delete |
| BENEFIT_NOT_FOUND | 404 | Benefit doesn't exist |
| DUPLICATE_BENEFIT | 409 | Benefit name already exists for card |
| BENEFIT_IN_USE | 409 | Benefit is used, can't delete |
| USER_NOT_FOUND | 404 | User doesn't exist |
| CANNOT_SELF_DEMOTE | 403 | Can't remove own admin role |
| AUDIT_LOG_NOT_FOUND | 404 | Audit log doesn't exist |
| SERVER_ERROR | 500 | Internal server error |

---

## Implementation Notes

### Authentication Flow
1. Request contains session cookie
2. Middleware verifies JWT token
3. Admin endpoints check User.role = 'ADMIN'
4. Request context (IP, User-Agent) extracted
5. All write operations logged to AdminAuditLog

### Validation Pattern
```typescript
const parseResult = parseRequestBody(CreateCardSchema, body);
if (!parseResult.success) {
  return NextResponse.json({ error: ..., details: parseResult.errors.details }, { status: 400 });
}
const input = parseResult.data!;
```

### Audit Logging Pattern
```typescript
await logResourceUpdate(
  { ...adminContext, ...context },
  'CARD',
  cardId,
  resourceName,
  oldValues,
  newValues,
  context.ipAddress,
  context.userAgent
);
```

### Pagination Pattern
```typescript
const skip = (page - 1) * limit;
const [total, items] = await Promise.all([
  prisma.model.count({ where }),
  prisma.model.findMany({ where, skip, take: limit })
]);
```

---

## Rate Limiting

Admin endpoints are rate limited to **100 requests per minute per user** to prevent abuse.

---

## Performance Targets

- **List endpoints**: p95 < 500ms
- **Detail endpoints**: p95 < 300ms
- **Create/Update**: p95 < 400ms
- **Delete**: p95 < 300ms (soft delete faster than hard delete)

---

## Changelog

### Phase 2 - Initial Release (v1.0.0)
- All 15 admin endpoints implemented
- Complete validation with Zod schemas
- Audit logging for all operations
- Admin role enforcement
- Comprehensive error handling
- Support for pagination, search, filtering
