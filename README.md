# Stashi

Low-cost managed PostgreSQL with fixed monthly pricing.

The MVP is a polished control-plane prototype plus the API boundary for a real provisioner. It demonstrates the complete customer journey: landing → sign in → create database → credentials → metrics → query activity → backups → lifecycle controls, plus an operator view for nodes, quotas and unit economics.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Any valid email can enter the MVP control plane.

## Build

```bash
npm run build
npm start
```

## Product model

- Dev — $1/mo
- Starter — $3/mo
- Production — $5/mo
- Dedicated — fixed higher tiers

The pricing model is deliberately predictable. Metrics enforce limits and recommend upgrades; they do not silently meter compute into the bill.

## Architecture

The customer-facing API is already shaped around asynchronous provisioning, while the current MVP provisioner is simulated so the full UX can be tested without touching a live PostgreSQL node. See [`docs/architecture.md`](docs/architecture.md) for the data plane, placement, backup and next-step design.

## Current API surface

- `POST /api/session` — MVP session boundary
- `POST /api/databases` — create/provision database
- `POST /api/databases/:id/rotate` — rotate credentials
- `POST /api/databases/:id/suspend` — suspend/resume
- `POST /api/databases/:id/restore` — queue restore

The live provisioner should implement these semantics against PostgreSQL 17 + PgBouncer + TLS on the VPS fleet.
