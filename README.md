# Alert Lifecycle Engine

A deterministic alert lifecycle engine built using NestJS and TypeScript.

The system processes unreliable device events while maintaining consistent alert state, deterministic escalation, and append-only activity logging.

---

# Features

* Deterministic alert lifecycle management
* Duplicate event handling
* Out-of-order event protection
* Deterministic escalation engine
* Alert acknowledgement flow
* Multi-tenant device isolation
* Crash recovery
* Persistent activity logging
* Swagger API documentation
* DTO validation
* Structured modular architecture

---

# Tech Stack

* NestJS
* TypeScript
* Node.js
* Swagger
* Jest
* JSON-based persistence

---

# Project Structure

```text
src/
├── common/
├── config/
├── modules/
│   └── alerts/
│       ├── controllers/
│       ├── dto/
│       ├── enums/
│       ├── interfaces/
│       ├── repositories/
│       ├── schedulers/
│       ├── services/
│       └── alerts.module.ts
├── app.module.ts
└── main.ts
```

---

# Installation

## Clone Repository

```bash
git clone <repository-url>
cd alert-lifecycle-engine
```

---

# Install Dependencies

```bash
npm install
```

---

# Environment Setup

Create `.env`

```env
APP_PORT=3000
ESCALATION_ATTENTION_SECONDS=30
ESCALATION_CRITICAL_SECONDS=60
```

---

# Run Application

## Development

```bash
npm run start:dev
```

## Production

```bash
npm run build
npm run start:prod
```

---

# Run Tests

```bash
npm run test
```

## Coverage

```bash
npm run test:cov
```

---

# Swagger Documentation

Swagger URL:

```text
http://localhost:3000/api
```

---

# API Endpoints

## Process Event

```http
POST /alerts/events
```

### Example Payload

```json
{
  "tenantId": "tenant-1",
  "deviceId": "router-101",
  "eventType": "DEVICE_DOWN",
  "timestamp": 1710000000,
  "eventId": "evt-001"
}
```

---

# Acknowledge Alert

```http
POST /alerts/:alertId/acknowledge
```

---

# Get Alerts

```http
GET /alerts
```

---

# Get Activity Logs

```http
GET /alerts/logs
```

---

# Health Check

```http
GET /health
```

---

# Alert Lifecycle

```text
DEVICE_DOWN → ACTIVE
ACTIVE → ACKNOWLEDGED
DEVICE_UP → RESOLVED
```

---

# Escalation Rules

```text
WARNING   → immediate
ATTENTION → after 30 seconds
CRITICAL  → after 60 seconds
```

Escalation is derived deterministically from elapsed time.

---

# Key Design Decisions

## Deterministic Escalation

Escalation is calculated using elapsed time rather than relying on unstable timers.

## Idempotent Event Processing

Duplicate eventIds are ignored safely.

## Out-of-Order Protection

Older events cannot override newer state.

## Multi-Tenant Isolation

Alerts are uniquely scoped by:

```text
tenantId + deviceId
```

---

# Assumptions

* Events arrive via HTTP API
* Persistence is file-based
* One ACTIVE alert per tenant-device pair


---

# Author

Prathamesh Patil
