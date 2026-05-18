# Alert Lifecycle Engine — Design Note

## Overview

This project implements a deterministic alert lifecycle engine using NestJS and TypeScript.

The system processes unreliable device events and maintains a consistent alert state while supporting:

* duplicate event handling
* out-of-order event protection
* deterministic escalation
* alert acknowledgement
* crash recovery
* append-only activity logging

The primary focus of the implementation is correctness, deterministic state transitions, and clean state management.

---

# Design Goals

The implementation was designed with the following priorities:

1. Deterministic behavior
2. Consistent state transitions
3. Idempotent event processing
4. Multi-device and multi-tenant isolation
5. Reliable escalation handling
6. Crash-safe recovery
7. Clean modular architecture

---

# Core Architecture

The application follows a modular NestJS structure.

## Main Components

### Controllers

Handle HTTP requests and input validation.

### Services

Contain business logic for:

* event processing
* lifecycle transitions
* escalation handling
* acknowledgement handling

### Repositories

Manage in-memory state and persistence.

### Scheduler

Responsible for deterministic escalation progression over time.

### Persistence Layer

Stores alerts, activity logs, and processed event IDs in JSON files for crash recovery.

---

# Alert Lifecycle

## States

### ACTIVE

Created when a DEVICE_DOWN event is received.

### ACKNOWLEDGED

Represents operator acknowledgement while the alert is still unresolved.

### RESOLVED

Represents recovery after receiving DEVICE_UP.

---

# Escalation Model

Escalation is derived deterministically using elapsed time:

```text
WARNING   → immediate
ATTENTION → after 30 seconds
CRITICAL  → after 60 seconds
```

The escalation state is always calculated from:

```text
currentTime - alert.createdAt
```

This ensures:

* deterministic escalation
* crash-safe recovery
* scheduler idempotency

---

# Event Processing Strategy

## Duplicate Event Handling

The system maintains processed event IDs.

If the same eventId is received again:

* event is ignored
* state is not mutated
* duplicate logs are not created

This guarantees idempotent processing.

---

# Out-of-Order Event Handling

Each alert tracks the latest processed timestamp.

Older events are ignored if:

```text
incoming.timestamp < latestProcessedTimestamp
```

This prevents stale events from overriding newer state.

---

# Multi-Tenant Device Isolation

Alerts are uniquely identified using:

```text
tenantId + deviceId
```

This ensures:

* independent device lifecycle handling
* tenant isolation
* no cross-tenant collisions

Example:

```text
tenant-1:router-101
tenant-2:router-101
```

These are treated as separate alerts.

---

# Deterministic Scheduling

The scheduler does not mutate escalation unpredictably.

Instead:

* escalation level is recalculated from elapsed time
* repeated scheduler execution remains safe
* restart recovery remains deterministic

This avoids timer drift and inconsistent escalation behavior.

---

# Crash Recovery

Application state is persisted into JSON files.

On startup:

* alerts are restored
* activity logs are restored
* processed event IDs are restored

This ensures:

* duplicate replay protection
* escalation continuity
* lifecycle consistency after restart

---

# Activity Logging

The system maintains append-only activity logs for:

* alert creation
* acknowledgement
* escalation changes
* resolution
* ignored duplicate events
* ignored out-of-order events

This provides traceability and auditability.

---

# Validation & Error Handling

DTO validation is implemented using:

* class-validator
* whitelist validation
* strict payload validation

Invalid payloads return:

* 400 Bad Request
* detailed validation errors

---

# Assumptions

1. Events are received through HTTP APIs.
2. Persistence is JSON-file based for simplicity.
3. One ACTIVE alert exists per tenant-device pair.
4. Escalation timing is deterministic and time-derived.
5. Scheduler execution frequency does not affect correctness.

---

# Future Improvements

Possible production improvements include:

* PostgreSQL persistence
* Redis-based distributed locking
* Kafka event ingestion
* Prometheus metrics
* Distributed scheduling
* Horizontal scaling
* WebSocket live alert streaming
* RBAC and authentication

---

# Conclusion

The implementation prioritizes:

* deterministic state handling
* correctness
* idempotency
* clean architecture
* recoverability

over unnecessary complexity or over-engineering.
