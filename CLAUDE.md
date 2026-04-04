# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Wakkiez Shipment Management System — a web PWA for managing shipments from Salla (wakkiez.com) with Aramex + SMSA couriers. Arabic RTL UI. Owner + 1-2 staff with role-based access (admin/operator).

## Stack

- **Backend:** FastAPI (Python 3.9) + Prisma Client Python + Supabase PostgreSQL
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + React Router
- **Auth:** JWT (python-jose + passlib/bcrypt)
- **Barcode scanning:** ZXing-js (browser-native camera)
- **Integrations:** Salla Partner API (OAuth 2.0 + webhooks), Aramex API, SMSA API

## Commands

### Backend (run from `backend/`)
```bash
source .venv/bin/activate              # Activate virtualenv
uvicorn app.main:app --reload --port 8000  # Dev server
prisma generate --schema=prisma/schema.prisma  # Regenerate Prisma client after schema changes
prisma db push --schema=prisma/schema.prisma   # Push schema to Supabase (no migration files)
python3 seed.py                        # Seed admin user (admin@wakkiez.com / admin123)
python3 -c "from app.main import app"  # Quick import check
```

### Frontend (run from `frontend/`)
```bash
npm run dev      # Dev server on :5173, proxies /api → backend :8000
npm run build    # TypeScript check + production build
npm run lint     # ESLint
```

## Architecture

### Backend (`backend/app/`)
- `main.py` — FastAPI app with lifespan (Prisma connect/disconnect), CORS, router registration
- `config.py` — Pydantic Settings from `.env`
- `database.py` — Singleton `Prisma` instance (`db`)
- `routers/` — One file per domain: `auth`, `users`, `orders`, `handover`, `returns`, `salla`
- `schemas/` — Pydantic request/response models per domain
- `services/` — Business logic (e.g., `salla.py` for OAuth token management, order sync, Salla API calls)
- `middleware/auth.py` — `get_current_user` and `require_admin` FastAPI dependencies

### Frontend (`frontend/src/`)
- `App.tsx` — Router with auth guard (unauthenticated → `/login`, authenticated → Layout with routes)
- `hooks/useAuth.ts` — JWT token management, login/logout
- `lib/api.ts` — Axios instance with auth interceptor, auto-redirect on 401
- `lib/utils.ts` — `cn()`, `formatDate()` (ar-SA), `formatCurrency()` (SAR)
- `components/Layout.tsx` — App shell with top bar + bottom mobile nav
- `components/BarcodeScanner.tsx` — ZXing camera scanner with debounce
- `pages/` — One file per screen

### Database (Prisma schema at `backend/prisma/schema.prisma`)
Tables: `users`, `orders`, `order_items`, `handover_batches`, `handover_items`, `returns`, `salla_tokens`. The Prisma model for returns is `ReturnRecord` (not `Return`) because `Return` is a Python keyword.

### Vite proxy
Frontend dev server proxies `/api/*` → `http://localhost:8000/*` (strips `/api` prefix). Frontend code uses `/api/...` paths via axios.

## Key Constraints

- **Python 3.9:** Use `Optional[X]` not `X | None`, use `from __future__ import annotations` where needed
- **Prisma JSON fields:** Must wrap with `Json()` from prisma package, not plain dicts
- **Prisma Decimal:** Requires `enable_experimental_decimal = true` in generator config
- **Never break existing Prisma schema** — use `prisma db push`, not destructive resets
- **Role permissions:** Operators cannot: approve refunds, see refund amounts, create users, manually sync Salla, resolve disputed batches
- **Arabic RTL:** All UI text in Arabic, `dir="ltr"` on phone numbers/emails/AWB numbers
- **passlib/bcrypt warning:** `(trapped) error reading bcrypt version` is harmless, ignore it
