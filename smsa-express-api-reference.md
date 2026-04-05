# SMSA Express API Reference

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://ecomapis.smsaexpress.com` |
| Sandbox | `https://ecomapis-sandbox.azurewebsites.net` |

---

## Authentication

All requests require an `ApiKey` header:

| Environment | API Key |
|-------------|---------|
| Test | `e3ad8afa5ccb4998a99e865b66223c6e` |
| Production | `be4ef075bdc34ed89cc4d5fa45e5ee0e` |

---

## API Endpoints

### 1. Create New B2C Shipment

`POST /api/shipment/b2c/new`

Creates a new e-commerce shipment (Business to Consumer).

**Headers:**
```
apikey: {API_KEY}
Content-Type: application/json
```

**Key Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `CODAmount` | Float | Yes | Cash on delivery amount (in destination currency) |
| `ConsigneeAddress` | Object | Yes | Recipient address details |
| `ShipperAddress` | Object | Yes | Sender address details |
| `OrderNumber` | String | Yes | Unique order reference |
| `DeclaredValue` | Float | Yes | Shipment declared value |
| `Parcels` | Integer | Yes | Number of boxes |
| `Weight` | Float | Yes | Shipment weight |
| `WeightUnit` | String | Yes | `KG` or `LB` |
| `ShipDate` | DateTime | Yes | Format: `2021-01-01T08:00:00` |
| `ShipmentCurrency` | String | Yes | ISO currency code (e.g., `SAR`) |
| `ServiceCode` | String | No | Shipping service type (e.g., `EDDL`) |
| `WaybillType` | String | No | `PDF` or `ZPL` |
| `SMSARetailID` | String | No | SMSA office code |

---

### 2. Query B2C Shipment By AWB

`GET /api/shipment/b2c/query/{AWB}`

Retrieves shipment details by Air Waybill number.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 3. Create C2B (Pickup Return) Shipment

`POST /api/c2b/new`

Creates a new Customer to Business pickup/return shipment.

**Headers:**
```
apikey: {API_KEY}
Content-Type: application/json
```

**Key Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `PickupAddress` | Object | Yes | Pickup location address |
| `ReturnToAddress` | Object | Yes | Return destination address |
| `OrderNumber` | String | Yes | Unique order reference |
| `DeclaredValue` | Float | Yes | Minimum `0.1` |
| `Parcels` | Integer | Yes | Number of boxes |
| `Weight` | Float | Yes | Shipment weight |
| `WeightUnit` | String | Yes | `KG` or `LB` |
| `ShipDate` | DateTime | Yes | Format: `2021-01-01T08:00:00` |
| `ShipmentCurrency` | String | Yes | ISO currency code |
| `ServiceCode` | String | No | e.g., `EDCR` |
| `WaybillType` | String | No | `PDF` or `ZPL` |
| `SMSARetailID` | String | No | SMSA office code |

---

### 4. Query C2B (Pickup Return) Shipment

`GET /api/c2b/query/{AWB}`

Retrieves pickup/return shipment details by AWB.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 5. Cancel Reverse Pickup Shipment

`POST /api/c2b/cancel/{AWB}`

Cancels a C2B pickup/return shipment.

**Headers:**
```
ApiKey: {API_KEY}
```

**Response:** `Shipment Cancelled Successfully!`

---

### 6. Track Bulk Shipments

`POST /api/track/bulk/`

Tracks multiple shipments by AWB numbers.

**Headers:**
```
ApiKey: {API_KEY}
Content-Type: application/json
```

**Request Body:**
```json
[
    "231200021000",
    "231200022222"
]
```

---

### 7. Track Single Shipment

`GET /api/track/{AWB}`

Tracks a single shipment by AWB number.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 8. Track Single Shipment By Reference

`GET /api/track/reference/{reference}`

Tracks shipment using merchant reference number.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 9. Get Status Lookup

`GET /api/track/statuslookup`

Returns list of all tracking status codes with descriptions.

**Headers:**
```
apikey: {API_KEY}
Content-Type: application/json
```

**Sample Response:**
```json
[
    {
        "Code": "DL",
        "ScanDescEN": "Delivered",
        "ScanDescAR": "تم التسليم"
    },
    {
        "Code": "OD",
        "ScanDescEN": "Out for Delivery",
        "ScanDescAR": "في الطريق للتسليم"
    }
]
```

---

### 10. Get Country/Currency Lookup

`GET /api/lookup/currency`

Returns list of supported countries and their currencies.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 11. Get SMSA Offices Lookup

`GET /api/lookup/smsaoffices`

Returns list of all SMSA office locations with details.

**Headers:**
```
ApiKey: {API_KEY}
```

---

### 12. Get Service Types Lookup

`GET /api/lookUp/ServiceTypes`

Returns available shipping services.

**Headers:**
```
apikey: {API_KEY}
Content-Type: application/json
```

**Sample Response:**
```json
[
    {
        "serviceDescription": "ECOM Delivery Lite",
        "serviceCode": "EDDL",
        "serviceType": "B2C",
        "destination": "Domestic"
    },
    {
        "serviceDescription": "ECOM Delivery Heavy",
        "serviceCode": "EDDH",
        "serviceType": "B2C",
        "destination": "Domestic"
    },
    {
        "serviceDescription": "ECOM International Delivery Lite",
        "serviceCode": "EIDL",
        "serviceType": "B2C",
        "destination": "International"
    }
]
```

---

### 13. Cities Lookup

`GET /api/lookup/cities/{countrycode}`

Returns cities for a specific country.

**Headers:**
```
apikey: {API_KEY}
Content-Type: application/json
```

**Example:** `GET /api/lookup/cities/SA`

---

### 14. Send Shipment Invoice

*(Endpoint documented but details not provided)*

---

## Common Object Structures

### ShipmentAddress Object (B2C)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `AddressLine1` | String | Yes | 10–100 characters |
| `AddressLine2` | String | No | 0–100 characters |
| `City` | String | Yes | 3–50 characters |
| `ContactName` | String | Yes | 5–150 characters |
| `ContactPhoneNumber` | String | Yes | Phone number |
| `Country` | String | Yes | ISO country code |
| `District` | String | No | District name |
| `PostalCode` | String | No | Postal code |
| `Coordinates` | String | No | `Lat,Long` format |
| `ConsigneeID` | String | No | Saudi ID/Iqama (Consignee only) |
| `ShortCode` | String | No | National Address Short Code (Consignee only) |

### ShipmentAddress Object (C2B — Pickup/Return)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `AddressLine1` | String | Yes | 10–100 characters |
| `AddressLine2` | String | No | 0–100 characters |
| `City` | String | Yes | 3–50 characters |
| `ContactName` | String | Yes | 5–150 characters |
| `ContactPhoneNumber` | String | Yes | Phone number |
| `Country` | String | Yes | ISO country code |
| `District` | String | No | District name |
| `PostalCode` | String | No | Postal code |
| `Coordinates` | String | No | `Lat,Long` format |

---

## Quick Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| Create B2C Shipment | `POST` | `/api/shipment/b2c/new` |
| Query B2C Shipment | `GET` | `/api/shipment/b2c/query/{AWB}` |
| Create C2B Shipment | `POST` | `/api/c2b/new` |
| Query C2B Shipment | `GET` | `/api/c2b/query/{AWB}` |
| Cancel C2B Shipment | `POST` | `/api/c2b/cancel/{AWB}` |
| Track Bulk | `POST` | `/api/track/bulk/` |
| Track Single | `GET` | `/api/track/{AWB}` |
| Track by Reference | `GET` | `/api/track/reference/{reference}` |
| Status Lookup | `GET` | `/api/track/statuslookup` |
| Country/Currency | `GET` | `/api/lookup/currency` |
| SMSA Offices | `GET` | `/api/lookup/smsaoffices` |
| Service Types | `GET` | `/api/lookUp/ServiceTypes` |
| Cities | `GET` | `/api/lookup/cities/{countrycode}` |

---

> **Note:** All timestamps should be in ISO 8601 format. Keep API keys secure — never expose them in client-side code.
