# Wakkiez Shipment Management System

A web PWA for managing shipments for (Salla store) with Aramex and SMSA couriers. Arabic RTL UI. Supports admin and operator roles.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.9) + Prisma Client Python |
| Database | Supabase PostgreSQL |
| Frontend | React + TypeScript + Vite + Tailwind CSS v4 |
| Auth | JWT (python-jose + passlib/bcrypt) |
| Barcode scanning | ZXing-js (browser camera) |
| Salla integration | Partner API — OAuth 2.0 + webhooks |
| Couriers | Aramex SOAP/JSON API + SMSA Express REST API |

## Features

- **Orders Dashboard** — live view of all Salla orders, filterable by status and courier
- **Shipment Creation** — create AWBs via SMSA or Aramex directly from the app, auto-fills customer details from Salla
- **Handover Scanner** — scan waybill barcodes with phone camera, confirm batch counts, flag courier mismatches
- **Returns Manager** — log returns, select resolution (replace / different size / refund), sync back to Salla
- **Customer Lookup** — instant search by name, phone, or order number
- **Analytics** — shipment counts, return rate, courier breakdown

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app, router registration
│   │   ├── config.py         # Settings from .env
│   │   ├── database.py       # Prisma singleton
│   │   ├── middleware/
│   │   │   └── auth.py       # JWT auth dependencies
│   │   ├── routers/          # One file per domain
│   │   │   ├── auth.py
│   │   │   ├── orders.py
│   │   │   ├── shipments.py  # AWB creation via SMSA/Aramex
│   │   │   ├── handover.py
│   │   │   ├── returns.py
│   │   │   ├── salla.py      # OAuth + webhooks
│   │   │   ├── courier.py    # Tracking + SMSA webhooks
│   │   │   ├── users.py
│   │   │   └── analytics.py
│   │   ├── schemas/          # Pydantic request/response models
│   │   └── services/         # Business logic
│   │       ├── salla.py      # OAuth, order sync
│   │       ├── aramex.py     # Shipment creation + tracking
│   │       ├── smsa.py       # Shipment creation + tracking
│   │       └── auth.py       # JWT encode/decode
│   ├── prisma/
│   │   └── schema.prisma
│   ├── seed.py
│   └── .env
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Orders.tsx
│       │   ├── OrderDetail.tsx
│       │   ├── CreateShipment.tsx
│       │   ├── Handover.tsx
│       │   ├── HandoverScan.tsx
│       │   ├── HandoverDetail.tsx
│       │   ├── Returns.tsx
│       │   ├── CreateReturn.tsx
│       │   ├── ReturnDetail.tsx
│       │   ├── Analytics.tsx
│       │   └── CustomerLookup.tsx
│       ├── components/
│       │   ├── Layout.tsx
│       │   └── BarcodeScanner.tsx
│       ├── hooks/useAuth.ts
│       └── lib/
│           ├── api.ts         # Axios instance with auth interceptor
│           └── utils.ts
```

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- Supabase project

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Copy and fill in .env
cp .env.example .env

# Push schema to Supabase
prisma db push --schema=prisma/schema.prisma

# Seed default admin user (admin@wakkiez.com / admin123)
python3 seed.py

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Environment Variables

Create `backend/.env` from the example below:

```env
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET_KEY=change-me-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=480

# Salla
SALLA_CLIENT_ID=
SALLA_CLIENT_SECRET=
SALLA_REDIRECT_URI=
SALLA_WEBHOOK_SECRET=

# Aramex
ARAMEX_USERNAME=
ARAMEX_PASSWORD=
ARAMEX_ACCOUNT_NUMBER=
ARAMEX_ACCOUNT_PIN=
ARAMEX_ACCOUNT_ENTITY=
ARAMEX_ACCOUNT_COUNTRY_CODE=SA
ARAMEX_API_URL=https://ws.aramex.net/ShippingAPI.V2

# SMSA
SMSA_API_KEY=
SMSA_PASSKEY=
SMSA_API_URL=https://ecomapis.smsaexpress.com

# Shipper (your store)
SHIPPER_NAME=Wakkiez
SHIPPER_PHONE=
SHIPPER_CITY=Riyadh
SHIPPER_ADDRESS=
SHIPPER_COUNTRY=SA
```

## Salla OAuth

1. Hit `GET /salla/auth` to get the authorization URL
2. Complete OAuth in browser — Salla redirects to your `SALLA_REDIRECT_URI`
3. Tokens are stored automatically in the `salla_tokens` table
4. Trigger a manual sync: `POST /orders/sync` (admin only)

## Role Permissions

| Action | Admin | Operator |
|---|:---:|:---:|
| View all orders | ✅ | ✅ |
| Create shipments (AWB) | ✅ | ✅ |
| Scan & confirm handover | ✅ | ✅ |
| Log return | ✅ | ✅ |
| Approve refund | ✅ | ❌ |
| See refund amounts | ✅ | ❌ |
| Create/edit users | ✅ | ❌ |
| Manually sync Salla | ✅ | ❌ |
| Resolve disputed batches | ✅ | ❌ |

## Default Credentials

After running `seed.py`:

| Email | Password | Role |
|---|---|---|
| admin@wakkiez.com | admin123 | admin |

> Change the admin password after first login.
