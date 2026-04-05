**Wakkiez**

**Shipment Management System**

Full Project Plan & Technical Specification

| Project | Details |
| :---- | :---- |
| **Store** | wakkiez.com (Salla) |
| **Couriers** | Aramex \+ SMSA |
| **Platform** | Web PWA — Arabic UI |
| **Stack** | FastAPI \+ PostgreSQL (Supabase) \+ React PWA |
| **Users** | Owner \+ 1-2 staff with role-based access |
| **Build approach** | Self-build with Claude Code |

# **1\. Problem Statement**

Before building anything, it's worth being precise about the four pain points this system must eliminate:

| Problem 1 | Courier count mismatch — you hand over 5 shipments, the courier records 4\. No way to prove which AWB is missing. |
| :---- | :---- |
| **Problem 2** | Return identity confusion — a package comes back and you have to search WhatsApp to figure out who the customer was. |
| **Problem 3** | Manual Salla updates — Aramex shipments require you to manually update order statuses in Salla. SMSA is synced but Aramex is not. |
| **Problem 4** | No return workflow — processing a return (replacement item, different size, or refund) has no structured flow and isn't synced back to Salla. |

# **2\. Solution Overview**

A single web PWA — installable on your phone — that acts as the source of truth for every shipment. It pulls all orders from Salla automatically, lets you scan waybill barcodes to confirm handover, flags courier count mismatches, manages returns end-to-end, and pushes status updates back to Salla.

## **Core Modules**

* **Orders Dashboard — live view of all Salla orders with status, courier, and shipment state**

* Handover Scanner — use phone camera to scan waybills and build a verified handover batch

* Courier Reconciliation — compare your batch count vs courier-confirmed count and flag gaps

* Returns Manager — log returned items, select resolution (replace / different size / refund), generate new shipment, sync to Salla

* Customer Lookup — instant search by phone, name, or order number — no more WhatsApp

* Basic Analytics — daily shipment counts, return rate, courier performance

# **3\. Tech Stack**

| Layer | Technology |
| :---- | :---- |
| **Backend API** | FastAPI (Python) — you're already familiar with it |
| **Database** | PostgreSQL via Supabase — already in your stack |
| **ORM** | Prisma — already in your stack from WhatsApp bot project |
| **Frontend** | React \+ Vite — PWA with manifest \+ service worker |
| **UI Library** | shadcn/ui \+ Tailwind CSS — Arabic RTL support built in |
| **Barcode Scanning** | ZXing-js (browser-native, uses phone camera, no native app needed) |
| **Salla Integration** | Salla Partner API \+ Webhooks (OAuth 2.0) |
| **Aramex Integration** | Aramex SOAP/REST API (shipment creation \+ tracking) |
| **SMSA Integration** | SMSA API (already synced with Salla — extend for local tracking) |
| **Auth** | JWT — owner gets admin role, staff get operator role |
| **Hosting** | Railway or Render for FastAPI, Vercel for React PWA |
| **Local Dev** | ngrok (already using it) for webhook testing |

# **4\. Database Schema**

All tables below. Foreign keys connect everything so a return is always traceable back to the original Salla order.

### **📦 orders**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK | Internal order ID |
| **salla\_order\_id** | VARCHAR UNIQUE | Salla's order ID — used for sync |
| **customer\_name** | VARCHAR | Customer full name |
| **customer\_phone** | VARCHAR | For lookup — replaces WhatsApp search |
| **customer\_city** | VARCHAR | Delivery city |
| **total\_amount** | DECIMAL | Order value in SAR |
| **status** | ENUM | pending / shipped / delivered / returned / cancelled |
| **courier** | ENUM | aramex / smsa |
| **awb\_number** | VARCHAR | Waybill / tracking number |
| **salla\_status** | VARCHAR | Raw status string from Salla |
| **created\_at** | TIMESTAMP | Order creation time |
| **updated\_at** | TIMESTAMP | Last update time |

### **📦 order\_items**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK |  |
| **order\_id** | UUID FK → orders | Parent order |
| **product\_name** | VARCHAR | Product name from Salla |
| **sku** | VARCHAR | Product SKU |
| **size** | VARCHAR | Size variant (key for size exchanges) |
| **quantity** | INTEGER |  |
| **unit\_price** | DECIMAL |  |

### **📦 handover\_batches**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK |  |
| **courier** | ENUM | aramex / smsa |
| **handed\_by** | UUID FK → users | Which staff member handed over |
| **handover\_time** | TIMESTAMP | When you physically handed to courier |
| **your\_count** | INTEGER | Number of AWBs you scanned |
| **courier\_count** | INTEGER NULL | Number courier confirmed — NULL until entered |
| **status** | ENUM | pending / confirmed / disputed |
| **notes** | TEXT | Optional notes for disputed batches |

### **📦 handover\_items**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK |  |
| **batch\_id** | UUID FK → handover\_batches |  |
| **order\_id** | UUID FK → orders |  |
| **awb\_number** | VARCHAR | Scanned from label |
| **scanned\_at** | TIMESTAMP | When this AWB was scanned |

### **📦 returns**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK |  |
| **original\_order\_id** | UUID FK → orders | The original Salla order |
| **returned\_by** | UUID FK → users | Staff who logged the return |
| **return\_type** | ENUM | replacement\_same / replacement\_different\_size / refund |
| **return\_reason** | VARCHAR | Customer reason |
| **returned\_items** | JSONB | Array of {sku, size, qty} returned |
| **replacement\_items** | JSONB NULL | Array of {sku, new\_size, qty} if replacement |
| **refund\_amount** | DECIMAL NULL | Amount if refund |
| **new\_order\_id** | UUID FK → orders NULL | New Salla order created for replacement |
| **status** | ENUM | pending / replacement\_shipped / refunded / completed |
| **salla\_synced** | BOOLEAN | Whether status was pushed to Salla |
| **created\_at** | TIMESTAMP |  |

### **📦 users**

| Column | Type | Description |
| :---- | :---- | :---- |
| **id** | UUID PK |  |
| **name** | VARCHAR |  |
| **email** | VARCHAR UNIQUE |  |
| **password\_hash** | VARCHAR |  |
| **role** | ENUM | admin / operator |
| **is\_active** | BOOLEAN |  |

# **5\. API Endpoints**

## **5.1 Orders**

| Endpoint | Description |
| :---- | :---- |
| **GET /orders** | List all orders — filterable by status, courier, date range |
| **GET /orders/{id}** | Full order detail with items |
| **POST /orders/sync** | Manually trigger Salla sync (also runs on webhook) |
| **PATCH /orders/{id}/status** | Update status \+ push to Salla (admin only) |

## **5.2 Handover & Scanning**

| Endpoint | Description |
| :---- | :---- |
| **POST /handover/batch** | Start a new handover batch (specify courier) |
| **POST /handover/batch/{id}/scan** | Add scanned AWB to batch — validates against orders table |
| **POST /handover/batch/{id}/confirm** | Lock batch — enter courier count — flags mismatch if ≠ your count |
| **GET /handover/batches** | List all batches with mismatch flags |
| **GET /handover/batch/{id}** | Full batch detail with all scanned AWBs |

## **5.3 Returns**

| Endpoint | Description |
| :---- | :---- |
| **POST /returns** | Create a return — accepts return\_type, items, refund\_amount |
| **GET /returns** | List all returns with original order info |
| **GET /returns/{id}** | Full return detail |
| **POST /returns/{id}/ship-replacement** | Create new Salla order for replacement \+ create Aramex/SMSA shipment |
| **POST /returns/{id}/sync-salla** | Push return/refund status to Salla |

## **5.4 Webhooks**

| Endpoint | Description |
| :---- | :---- |
| **POST /webhooks/salla** | Receives order.created, order.status.updated from Salla — auto-syncs |
| **POST /webhooks/smsa** | Receives SMSA delivery events — auto-updates order status |

## **5.5 Auth & Users**

| Endpoint | Description |
| :---- | :---- |
| **POST /auth/login** | Returns JWT token |
| **GET /users/me** | Current user profile \+ role |
| **POST /users** | Create staff user (admin only) |
| **PATCH /users/{id}** | Update user role/status (admin only) |

# **6\. Salla Integration**

## **6.1 Webhooks to receive (Salla → your system)**

* order.created → create order record in your DB

* order.status.updated → sync status changes from Salla

* order.refunded → mark return as refunded

## **6.2 API calls to make (your system → Salla)**

* Update order status when Aramex shipment is created (fix for your current manual process)

* Update order status when return is processed

* Create a new replacement order in Salla when you ship a return replacement

## **6.3 Aramex gap fix**

SMSA is already auto-synced. For Aramex: when you scan and confirm an Aramex AWB in the handover scanner, the system will immediately call Salla's API to update the order status to 'shipped' \+ attach the AWB number. This eliminates your current manual step entirely.

# **7\. Screens & UX Flow**

## **7.1 Orders Dashboard (الرئيسية)**

* Full list of Salla orders with status badges

* Filter by: courier, status, date, return flag

* Tap any order → full detail: customer info, items, AWB, history

* Quick search bar — by name, phone, order number

## **7.2 Handover Scanner (تسليم الشحنات)**

1. Tap 'New Handover' → select courier (Aramex / SMSA)

2. Phone camera opens — scan each waybill barcode one by one

3. Each scan shows: customer name, city, order total — green tick if valid, red if not found

4. Running count shown at top: '4 shipments scanned'

5. Tap 'Confirm Handover' → enter courier's stated count

6. System compares → if match: batch confirmed. If mismatch: batch flagged with list of unconfirmed AWBs

## **7.3 Returns (المرتجعات)**

7. Search for order by customer name / phone / order number

8. Select which items were returned \+ quantities

9. Choose resolution: (a) Same item replacement, (b) Different size, (c) Refund

10. For replacements: select new size from product variants → system creates new Salla order

11. For refunds: enter amount → system marks order as refunded in Salla

12. System pushes status back to Salla automatically

## **7.4 Courier Reconciliation (مطابقة الشحنات)**

* List of all handover batches — color coded: green (confirmed), red (disputed), yellow (pending courier count)

* Tap disputed batch → see exactly which AWBs are in your scan but not confirmed

* Add notes / evidence for disputes

## **7.5 Customer Lookup (البحث عن عميل)**

* Search by phone, name, or order number

* Shows full order history for that customer — all orders, returns, replacements

* Replaces WhatsApp search entirely

## **7.6 Analytics (الإحصائيات) — basic**

* Today / this week / this month: total shipments, total returns, return rate %

* Breakdown by courier: Aramex vs SMSA shipment counts

* Disputed batches count — open vs resolved

# **8\. Role Permissions**

| Action | Admin (You) | Operator (Staff) |
| :---- | ----- | ----- |
| View all orders | ✅ | ✅ |
| Scan & confirm handover | ✅ | ✅ |
| Log return | ✅ | ✅ |
| Process replacement | ✅ | ✅ |
| Approve refund | ✅ | ❌ |
| See refund amounts | ✅ | ❌ |
| View analytics | ✅ | ✅ |
| Create/edit users | ✅ | ❌ |
| Manually sync Salla | ✅ | ❌ |
| Resolve disputed batches | ✅ | ❌ |

# **9\. Build Phases (Claude Code Order)**

This is the recommended order to build with Claude Code — each phase is a working, testable milestone.

| Phase | Duration | Deliverables | Goal |
| :---- | :---- | :---- | :---- |
| Phase 1 | 2-3 days | FastAPI skeleton, Supabase DB \+ Prisma schema, auth (JWT), user roles | Working API with auth |
| Phase 2 | 2-3 days | Salla OAuth, webhook receiver, order sync, orders list endpoint | Orders flowing from Salla into your DB |
| Phase 3 | 2-3 days | React PWA scaffold, Arabic RTL, orders dashboard, customer lookup | Working orders UI on your phone |
| Phase 4 | 2-3 days | Handover batch API \+ barcode scanner UI (ZXing), courier count reconciliation | You can scan waybills and catch mismatches |
| Phase 5 | 2-3 days | Returns API \+ returns UI flow (select items, pick resolution, replacement sizing) | Full return workflow running |
| Phase 6 | 2 days | Aramex API integration (auto-update Salla on handover confirm), SMSA extend | Aramex manual update eliminated |
| Phase 7 | 1-2 days | Analytics page, PWA manifest \+ service worker, polish Arabic UI | Installable on phone, production-ready |

# **10\. Claude Code — Build Tips**

## **CLAUDE.md to set up**

Put this in your project root CLAUDE.md so every session has context:

Stack: FastAPI \+ Prisma \+ Supabase PostgreSQL \+ React PWA. Arabic RTL UI. Couriers: Aramex \+ SMSA. Salla store: wakkiez.com. Never break existing Prisma migrations. Always validate against OpenAPI schema.

## **Recommended Phase 1 prompt**

"Set up a FastAPI project with Prisma ORM connecting to Supabase. Create the full schema from the plan: orders, order\_items, handover\_batches, handover\_items, returns, users. Add JWT auth with admin and operator roles. Include /auth/login, /users/me endpoints."

* Use plan mode (shift+tab) before any complex feature — especially the Salla webhook and scanner

* Build and test each phase before moving to the next — don't skip to the UI before the API is solid

* Use ngrok for webhook testing exactly as you did for the WhatsApp bot

* Keep a .env.example committed — Supabase URL, Salla client ID/secret, Aramex credentials, SMSA key

# **11\. Decisions to Make Before Building**

* Aramex account type — do you have an Aramex business account with API access? You'll need client ID \+ secret from the Aramex developer portal.

* Salla app registration — you need to create a private app in the Salla Partner Portal to get OAuth credentials and register your webhook URL.

* Product variants in Salla — for size exchanges, the system reads product variants from Salla. Confirm your products have sizes set up as variants in Salla.

* Refund method — for refunds, does your business refund via bank transfer, Salla wallet credit, or another method? This affects how the return form is designed.

* Domain — you'll want a subdomain like ship.wakkiez.com or ops.wakkiez.com for the PWA. Vercel makes this easy to set up.

**Ready to build. Start with Phase 1 in Claude Code.**

Each phase above is scoped to be completable in a few focused Claude Code sessions. The hardest integrations are Salla webhooks (Phase 2\) and the barcode scanner (Phase 4\) — use plan mode for both.