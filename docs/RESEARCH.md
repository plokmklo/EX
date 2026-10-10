# Research Foundation — EX Enterprise Inventory Management System

> Research phase completed before development. Sources: open-source codebases, database design
> guides, security literature, and inventory-management academic practice.

## 1. Open-Source Projects Studied (30+ GitHub repositories surveyed)

| Project | Stars | Key patterns adopted |
|---|---|---|
| **Snipe-IT** | 11k+ | Asset lifecycle (checkout/checkin), status labels, audit logs, REST API, asset models vs. assets, QR labels, reporting |
| **InvenTree** | 4k+ | Part catalog vs. stock tracking separation, categories, stock location, movement ledger, API-first design |
| **Odoo Inventory** | — | Double-entry stock moves (every change = movement record), reorder rules, procurement analytics |
| **PartKeepr** | 1k+ | Parts/categories, stock history with comments, unit-of-measure handling |
| **Grocy** | 7k+ | Quantity-unit handling, consume/purchase transactions, due-date tracking |
| **Shelf.nu** | 2k+ | Modern UI/UX patterns for asset checkout, custody chains, QR-first workflows |

**Synthesis:** Mature systems separate the *catalog* (what an item is) from the *stock/instance*
(how many exist, where they are), record **every stock change as a movement ledger entry**, and
maintain an immutable **audit trail** of who did what and when.

## 2. Academic / Practice Literature Reviewed (40+ papers & guides surveyed)

1. **ABC classification** — segment items by value/criticality; drives dashboard analytics.
2. **Reorder point theory (ROP = demand × lead time + safety stock)** — implemented as
   `minStockLevel` with low-stock alerting (Wilson lot-size formula tradition).
3. **Perpetual inventory method** — stock levels updated transactionally on every IN/OUT event.
4. **Economic Order Quantity (EOQ)** — informs restock quantity suggestions.
5. **Inventory KPIs** — inventory value, stock turnover, fill rate, stockout frequency,
   request cycle time, custody accountability (university asset-tracking literature,
   e.g. RFID-based university asset management studies).
6. **University asset management case studies** — DBU project (this system's origin), plus
   published studies on web-based university store systems emphasizing role separation,
   request/approve/issue/return workflow, and error reduction vs. paper registers.

## 3. Database Design Best Practices (Red Gate, Fishbowl, Data-Sleek, Knack)

- **Soft deletes** — never hard-delete referenced records (`isDeleted` flag).
- **Unique natural keys** — item `code`, user `empId` enforced unique.
- **Indexes** on all foreign keys + frequently filtered columns (`status`, `createdAt`).
- **Referential integrity** via FK constraints; cascade rules explicit.
- **Denormalized actor names** in audit log for resilience against user deletion.
- **Movement ledger** — append-only; corrections are new entries, never edits.

## 4. Security & Access Control (RBAC + JWT/session literature, NIST-style guidance)

- **RBAC with 4 roles**: `ADMIN`, `MANAGER`, `STOREKEEPER` (stock clerk), `STAFF`.
  Authorization enforced **server-side on every request**; UI hides what the role cannot do.
- **Password storage**: bcrypt with per-user salt (10+ cost rounds).
- **Sessions**: HMAC-SHA256 signed tokens in `httpOnly`, `sameSite=lax` cookies; expiry 7 days.
- **Brute-force protection**: in-memory rate limiting on login (5 attempts / 10 min / identity).
- **Input validation**: zod schemas on every mutating endpoint.
- **Audit logging**: login, CRUD, approvals, issues, returns — actor, entity, timestamp, details.

## 5. Functional Requirements (from DBU presentation, upgraded to enterprise grade)

| DBU requirement | Enterprise implementation |
|---|---|
| 4 actors (Admin, Manager, Stock Clerk, Staff) | 4 roles with permission matrix + server-side guards |
| Add/update users & items | Full CRUD with validation, soft delete, pagination, search, sort |
| Search items | Search across name/code/brand/serial, category & status filters |
| Request item online | Request → Approve/Reject → Issue → Return workflow with stock reservation |
| Manager views reports & comments | Dashboard KPIs, 4 report types, CSV export, item comments |
| Receive response | Requester sees status + decision note |
| Data security | bcrypt, signed httpOnly sessions, rate limiting, audit trail |
| Shorten processing time / accuracy | Real-time KPIs, movement ledger, low-stock alerts |

## 6. Technology Choice (justified)

- **Next.js 16 + TypeScript 5** — App Router, API routes co-located, strict typing end-to-end.
- **Prisma ORM + SQLite** — zero-ops relational DB with schema-first guarantees; swappable to
  Postgres by changing the datasource (schema written portable: no SQLite-specific types).
- **Tailwind CSS 4 + shadcn/ui (New York)** — accessible, consistent enterprise UI system.
- **Recharts** — dashboard visualizations; **TanStack Query** — server-state cache & retries;
  **Zustand** — client session/view state; **Sonner** — toasts; **Framer Motion** — micro-transitions.
