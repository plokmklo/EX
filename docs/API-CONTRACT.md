# EX-IMS API Contract (v1) — single source of truth

Base URL: relative `/api/...` only. All responses JSON unless stated. Auth via `ims_session`
httpOnly cookie (set by login). Errors: `{ error: string }` with proper HTTP status
(400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 429 rate-limited).

## Roles
`ADMIN` | `MANAGER` | `STOREKEEPER` | `STAFF`

## Shared types

```ts
type Role = 'ADMIN' | 'MANAGER' | 'STOREKEEPER' | 'STAFF';

interface SafeUser {
  id: string; empId: string; firstName: string; lastName: string; email: string;
  phone: string | null; department: string | null; office: string | null;
  role: Role; status: 'ACTIVE' | 'INACTIVE'; createdAt: string; // ISO
}

interface ItemDto {
  id: string; code: string; name: string;
  categoryId: string; category: { id: string; name: string };
  brand: string | null; model: string | null; serial: string | null;
  unit: string; quantity: number; minStockLevel: number; unitPrice: number;
  location: string | null; description: string | null;
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'MAINTENANCE' | 'DISCONTINUED';
  reservedQty: number;      // sum of quantities in APPROVED requests (not yet issued)
  availableQty: number;     // quantity - reservedQty (>= 0)
  isDeleted: boolean; createdAt: string; updatedAt: string;
}

interface RequestDto {
  id: string; itemId: string; quantity: number; reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'CANCELLED';
  item: { id: string; code: string; name: string; unit: string; quantity: number; availableQty: number };
  requester: { id: string; firstName: string; lastName: string; empId: string; email: string };
  reviewer: { id: string; firstName: string; lastName: string } | null;
  reviewedAt: string | null; decisionNote: string | null;
  issuedAt: string | null; returnedAt: string | null;
  createdAt: string;
}

interface CategoryDto { id: string; name: string; description: string | null; itemCount?: number; createdAt: string; }

interface AuditDto {
  id: string; action: string; entity: string; entityId: string | null; details: string | null;
  actorName: string | null; userId: string | null; createdAt: string;
}

interface MovementDto {
  id: string; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; note: string | null;
  item: { id: string; code: string; name: string };
  user: { firstName: string; lastName: string } | null;
  createdAt: string;
}
```

List envelope: `{ data: T[], total: number, page: number, pageSize: number }`

---

## Auth

### `POST /api/auth/login`
Body: `{ identifier: string, password: string }` (identifier = email OR empId, case-insensitive)
- 200 `{ user: SafeUser }` + sets `ims_session` cookie (7d, httpOnly, sameSite=lax)
- 401 `{ error: "Invalid credentials" }`; 403 `{ error: "Account is inactive" }`
- 429 `{ error: "Too many attempts. Try again later." }`
- Audited as `AUTH_LOGIN` / `AUTH_LOGIN_FAILED`.

### `POST /api/auth/logout` → `{ ok: true }` (clears cookie)

### `GET /api/auth/me`
- 200 `{ user: SafeUser }` or 401

### `PUT /api/auth/profile` (any authenticated)
Body (all optional): `{ firstName, lastName, phone, department, office }` → `{ user: SafeUser }`

### `PUT /api/auth/password` (any authenticated)
Body: `{ currentPassword: string, newPassword: string (min 8) }` → `{ ok: true }`
- 400 on wrong current password.

---

## Users

### `GET /api/users` (ADMIN, MANAGER)
Query: `search?, role?, status?, page=1, pageSize=10`
→ `{ data: SafeUser[], total, page, pageSize }`

### `POST /api/users` (ADMIN)
Body: `{ empId, firstName, lastName, email, password (min 8), role, phone?, department?, office?, status? }`
→ 201 `{ user: SafeUser }`; 409 duplicate email/empId.

### `PUT /api/users/[id]` (ADMIN)
Body (all optional): `{ firstName, lastName, email, phone, department, office, role, status, password? }`
→ `{ user: SafeUser }` (cannot deactivate/demote self; guarded with 409/400)

### `DELETE /api/users/[id]` (ADMIN) → soft: sets status INACTIVE → `{ ok: true }`

## Categories

### `GET /api/categories` (any authenticated) → `{ data: CategoryDto[] }` (with itemCount)

### `POST /api/categories` (ADMIN, STOREKEEPER) Body `{ name, description? }` → 201 `{ category }` (409 dup)

### `PUT /api/categories/[id]` (ADMIN, STOREKEEPER) Body `{ name?, description? }` → `{ category }`

### `DELETE /api/categories/[id]` (ADMIN) — 409 if items exist in it → `{ ok: true }`

## Items

### `GET /api/items` (any authenticated)
Query: `search?, categoryId?, status?, lowStock=1?, page=1, pageSize=10, sort=name|quantity|unitPrice|createdAt, order=asc|desc`
→ `{ data: ItemDto[], total, page, pageSize }`

### `POST /api/items` (ADMIN, STOREKEEPER)
Body: `{ code, name, categoryId, quantity (>=0), unit?, minStockLevel?, unitPrice?, brand?, model?, serial?, location?, description?, status? }`
→ 201 `{ item: ItemDto }`; 409 duplicate code. Creates IN movement if quantity > 0. Audited `ITEM_CREATE`.

### `GET /api/items/[id]` (any authenticated)
→ `{ item: ItemDto, comments: CommentDto[], movements: MovementDto[], requests: RequestDto[] }`
`CommentDto = { id, body, createdAt, user: { id, firstName, lastName, role } }`

### `PUT /api/items/[id]` (ADMIN, STOREKEEPER)
Body: any subset of create fields + `status`. → `{ item: ItemDto }` Audited `ITEM_UPDATE`.
If `quantity` changed → writes ADJUST movement automatically.

### `DELETE /api/items/[id]` (ADMIN) → soft delete → `{ ok: true }` Audited `ITEM_DELETE`.

## Requests (workflow)

### `GET /api/requests` (any authenticated)
Query: `status?, itemId?, page=1, pageSize=10`
- STAFF: always scoped to own requests (server-enforced).
- Others: all requests. Optional `mine=1` for own.
→ `{ data: RequestDto[], total, page, pageSize }`

### `POST /api/requests` (any authenticated)
Body: `{ itemId, quantity (>=1), reason? }` → 201 `{ request: RequestDto }`
- Validated against `availableQty` (409 if exceeds). Audited `REQUEST_CREATE`.

### `PUT /api/requests/[id]` (action-based)
Body: `{ action: 'approve' | 'reject' | 'issue' | 'return' | 'cancel', note? }`
Permissions & effects:
- `approve` (ADMIN, MANAGER, STOREKEEPER): PENDING→APPROVED. Audited `REQUEST_APPROVE`.
- `reject` (ADMIN, MANAGER, STOREKEEPER): PENDING→REJECTED, saves note. Audited `REQUEST_REJECT`.
- `issue` (ADMIN, STOREKEEPER): APPROVED→ISSUED, decrements item quantity, OUT movement, sets issuedAt. Audited `REQUEST_ISSUE`. 409 if stock insufficient.
- `return` (ADMIN, STOREKEEPER): ISSUED→RETURNED, increments item quantity, IN movement, sets returnedAt. Audited `REQUEST_RETURN`.
- `cancel` (requester only, PENDING/APPROVED): →CANCELLED. Audited `REQUEST_CANCEL`.
→ `{ request: RequestDto }`; 409 on invalid transition.

## Dashboard

### `GET /api/dashboard` (any authenticated; MANAGER/ADMIN get full metrics)
→ `{ kpis: { totalItems, totalUnits, inventoryValue, lowStockCount, outOfStockCount, pendingRequests, activeLoans, usersCount, requestsThisMonth },
    categoryBreakdown: { name, itemCount, totalValue }[],
    statusBreakdown: { name, itemCount }[],
    movements7d: { date: 'MM-DD', in: number, out: number }[],
    topRequested: { name, requestCount }[],
    recentActivity: AuditDto[] (10) }`

## Reports

### `GET /api/reports?type=valuation|movements|requests&days=30`
- `valuation` → `{ data: { categoryId, categoryName, itemCount, totalUnits, totalValue }[], totals: {...} }` (MANAGER, ADMIN)
- `movements` → `{ data: MovementDto[], total }` (MANAGER, ADMIN)
- `requests` → `{ byStatus: { name, count }[], byDay: { date, count }[], avgDecisionHours: number, topRequesters: { name, count }[] }` (MANAGER, ADMIN)

### `GET /api/reports/export?type=inventory|movements|requests` (MANAGER, ADMIN)
→ `text/csv` attachment download.

## Audit

### `GET /api/audit` (ADMIN, MANAGER)
Query: `entity?, action?, search?, page=1, pageSize=15` → `{ data: AuditDto[], total, page, pageSize }`

## Seed

### `GET /api/seed` → `{ seeded: boolean, counts: {...} }`
### `POST /api/seed` → idempotent demo-data seeding → `{ ok: true, seeded: boolean }`

Demo accounts (password pattern `<Role>@123`):
- `admin@ex-ims.dev` / `Admin@123` (ADMIN)
- `manager@ex-ims.dev` / `Manager@123` (MANAGER)
- `clerk@ex-ims.dev` / `Clerk@123` (STOREKEEPER)
- `staff@ex-ims.dev` / `Staff@123` (STAFF)
