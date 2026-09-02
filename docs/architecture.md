# Stashi MVP architecture

Stashi is intentionally a thin managed-PostgreSQL control plane, not a new database engine.

## Data plane

Each node runs PostgreSQL 17 and PgBouncer. PostgreSQL listens privately; PgBouncer is the client-facing endpoint and requires TLS. Small plans share nodes using separate databases, roles, quotas, and monitored connection pools. Dedicated plans move onto isolated nodes without changing the customer workflow.

## Control plane

The web application owns customer identity, plan selection, database metadata, quotas, audit events, billing state, job state, node inventory, and backup metadata. Provisioning is asynchronous in production:

1. Validate account and plan quota.
2. Select an eligible node from telemetry and declared limits.
3. Create a random database role and database.
4. Apply scoped grants and extensions allowed by the plan.
5. Register PgBouncer routing/auth and enforce TLS.
6. Create backup + monitoring targets.
7. Probe the returned connection string.
8. Mark the database healthy and reveal credentials.

The current MVP exposes the same API/UX boundary with a simulated provisioner so the product can be exercised before the node agent is introduced.

## Placement

A simple scheduler is enough initially. Keep nodes eligible while sustained CPU is below 60%, memory below 75%, disk below 70%, and database/customer quotas remain available. Prefer the lowest-pressure compatible node. Do not upgrade a node merely because a larger plan exists; upgrade only when telemetry proves pressure.

## Backups

Production backups should be custom-format `pg_dump` snapshots or physical/WAL backups depending on plan maturity, copied off-node to S3-compatible storage such as R2, verified after upload, and rotated by retention policy. The restore job must create a new database/restore target before destructive replacement whenever possible.

## Billing model

Plans are fixed-price objects. Usage metrics exist to enforce limits and recommend plan changes, not to calculate surprise compute bills. A plan change is an explicit customer action.

## Next infrastructure milestone

Build a small node agent/provisioner with a signed control-plane API. It should support create database, rotate credentials, suspend/resume, delete, health probe, backup, restore, metrics snapshot, and capacity report. No Kubernetes dependency is required for the first multi-node version.
