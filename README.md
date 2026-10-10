# EX-IMS — Enterprise Inventory Management System

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](LICENSE)

A production-grade, web-based **Inventory & Asset Management System** for universities and
enterprises — originally scoped as a *Web Based Inventory Management System for Debre Berhan
University (DBU)* and rebuilt to enterprise standards with research-backed architecture
(studying 30+ open-source systems including **Snipe-IT, InvenTree, Odoo Inventory** and 40+
papers/guides on inventory theory, RBAC security and database design).

## ✨ Features

### Core (from the DBU specification — upgraded)
- **4-actor RBAC** — `ADMIN`, `MANAGER`, `STOREKEEPER` (stock clerk), `STAFF`, with a server-side
  permission matrix enforced on every endpoint *and* reflected in the UI
- **Item catalogue** — CRUD with categories, brands, models, serials, locations, unit prices,
  min-stock levels, soft deletes, search (name/code/brand/serial), filters, sorting, pagination
- **Full requisition workflow** — `Request → Approve/Reject → Issue → Return` with
  **stock reservation** (approved-not-issued units can't double-issue), transactional stock
  movements, decision notes, and requester notifications
- **Stock movement ledger** — every IN/OUT/ADJUST is recorded immutably (perpetual inventory)
- **User management** — add/update/deactivate accounts, role assignment, self-protection guards
- **Reports & analytics** — inventory valuation by category, movement history, request analytics
  (by status/day/requester, avg. decision time), **CSV export** for inventory/movements/requests
- **Comments** on items; **dashboard** with KPIs, 7-day movement chart, category breakdown
- **Audit log** — who did what, when, to what entity — for every mutation and login

### Enterprise hardening
| Concern | Implementation |
|---|---|
| Authentication | Email **or** employee-ID login, bcrypt password hashing |
| Sessions | HMAC-SHA256 signed tokens in `httpOnly` `sameSite=lax` cookies (7-day expiry) |
| Brute force | In-memory rate limiting — 5 login attempts / 10 min / identity |
| Validation | Strict **zod** schemas on every mutating endpoint |
| Authorization | Central `PERMISSIONS` matrix + `requirePermission()` guards |
| Integrity | FK constraints, unique natural keys (item code, empId), indexed queries |
| Auditability | Append-only audit trail with denormalized actor names |
| UX | Dark mode, responsive (375px→1440px), skeletons, toasts, empty/error states, sticky footer |

## 🏗 Architecture

```
Next.js 16 (App Router, TypeScript strict)
├── src/app/api/**          REST API routes (19 endpoints)
│   ├── auth/               login · logout · me · profile · password
│   ├── items/              list · create · detail(+comments, movements, requests)
│   ├── requests/           list · create · approve/reject/issue/return/cancel
│   ├── users/ categories/  RBAC-guarded management
│   ├── dashboard/ reports/ KPIs, analytics, CSV export
│   └── audit/ seed/        audit trail + demo seeding
├── src/components/ims/**   13 feature components (SPA views on /)
├── src/lib/                auth · audit · validators · inventory · api-utils · db
└── prisma/schema.prisma    7-table relational schema (SQLite, Postgres-portable)
```

**Data model:** `User · Category · Item · ItemRequest · Comment · StockMovement · AuditLog`

## 🚀 Getting Started

```bash
bun install            # or npm install
cp .env.example .env   # DATABASE_URL=file:./db/custom.db
bun run db:push        # create schema
bun run dev            # http://localhost:3000
curl -X POST http://localhost:3000/api/seed   # demo data (idempotent)
```

### Demo accounts

| Role | Email (or EmpID) | Password |
|---|---|---|
| Admin | `admin@ex-ims.dev` (`EMP-0001`) | `Admin@123` |
| Manager | `manager@ex-ims.dev` (`EMP-0002`) | `Manager@123` |
| Storekeeper | `clerk@ex-ims.dev` (`EMP-0003`) | `Clerk@123` |
| Staff | `staff@ex-ims.dev` (`EMP-0004`) | `Staff@123` |

## 🔒 Role permission matrix

| Capability | ADMIN | MANAGER | STOREKEEPER | STAFF |
|---|:-:|:-:|:-:|:-:|
| Browse/search inventory | ✅ | ✅ | ✅ | ✅ |
| Create/update items & categories | ✅ | — | ✅ | — |
| Delete items (soft) | ✅ | — | — | — |
| Request stock | ✅ | ✅ | ✅ | ✅ |
| Approve/reject requests | ✅ | ✅ | ✅ | — |
| Issue & return (custody) | ✅ | — | ✅ | — |
| Manage users | ✅ | — | — | — |
| View users | ✅ | ✅ | — | — |
| Reports, valuation & CSV export | ✅ | ✅ | — | — |
| Audit log | ✅ | ✅ | — | — |

## 📚 Research basis

See [`docs/RESEARCH.md`](docs/RESEARCH.md) — synthesized from Snipe-IT, InvenTree, Odoo
Inventory, PartKeepr, Grocy and Shelf.nu, plus literature on ABC classification, reorder-point
theory, perpetual inventory, KPI frameworks and RBAC/JWT security practice.

## 📄 License

MIT — see [LICENSE](LICENSE).
