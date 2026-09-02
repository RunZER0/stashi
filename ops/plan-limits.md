# Stashi Plan-to-Limit Enforcement Specification

This document defines the single source of truth for commercial plans and their concrete infrastructure constraints enforced on Stashi PostgreSQL nodes.

---

## 1. Plan Matrix

| Plan Tier | Price / Month | Storage Limit | PgBouncer Max Conn | PostgreSQL Conn Limit | Backup Retention | Placement Class | Max CPU Priority (cgroups) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dev** | $1.00 (Flat) | 1 GB (1,024 MB) | 10 client connections | 5 backend conns | 2 days (daily snapshot) | Shared Multi-tenant | Low / Nice 10 |
| **Starter** | $3.00 (Flat) | 5 GB (5,120 MB) | 25 client connections | 10 backend conns | 7 days (daily snapshot) | Shared Multi-tenant | Normal / Nice 0 |
| **Production** | $5.00 (Flat) | 15 GB (15,360 MB) | 60 client connections | 20 backend conns | 14 days (daily snapshot) | Shared Multi-tenant | High / Nice -5 |
| **Dedicated** | $9.00+ (Fixed) | 40 GB+ (Custom) | 200+ client connections | 50+ backend conns | 30 days (Point-in-Time) | Dedicated Node | Dedicated CPU/RAM |

---

## 2. Hard Financial Guardrails (Loop-Safe Billing)

1. **Zero Compute Metering Surcharges:**
   - Under no circumstances does an autonomous agent reasoning loop incur variable per-second or per-query compute overages.
   - Plans are 100% hard-capped at their stated monthly fee ($1, $3, $5, $9+).

2. **Storage Limit Enforcement Policy:**
   - PostgreSQL does not natively provide POSIX filesystem quotas per database in a shared cluster.
   - The Stashi Node Agent samples `pg_database_size(datname)` on a 60-second polling cadence.
   - **85% Quota Warning:** Emits a warning event to the customer console & control plane webhook.
   - **100% Quota Ceiling:** Database state is updated to `READ_ONLY` by executing `ALTER DATABASE <tenant_db> SET default_transaction_read_only = on;` to prevent disk starvation of adjacent tenants.
   - **Recovery:** Customer can upgrade plan or execute `DELETE`/`TRUNCATE`/`VACUUM` commands to restore read-write capability.

3. **Connection Limit Enforcement:**
   - Enforced at both **PgBouncer** (`max_db_connections` in `pgbouncer.ini`) and **PostgreSQL** (`ALTER ROLE <tenant_role> WITH CONNECTION LIMIT <N>;`).
   - Prevents connection exhaustion attacks against the PostgreSQL 17 server engine.

---

## 3. Allowed PostgreSQL Extensions

Stashi provides a strictly curated allowlist of vetted PostgreSQL extensions. Arbitrary untrusted extensions (`c`-language shared objects) cannot be created by tenant roles:

- `pgcrypto` (Cryptographic functions)
- `uuid-ossp` / `pg_trgm` (UUID generation and trigram text search)
- `vector` / `pgvector` (Dense vector embeddings for agent RAG memory)
- `citext` (Case-insensitive text)
- `btree_gist` / `btree_gin` (Indexing support)
- `hstore` (Key-value storage)
- `pg_stat_statements` (Managed globally by node operator, queries isolated per role)

---

## 4. Tenant Placement Thresholds

The Stashi Scheduler assigns newly provisioned tenant databases only to nodes meeting all safety thresholds:

- **CPU Pressure:** 5-minute load average < 65% of node cores.
- **Memory Saturation:** Available memory > 25% (Swap usage < 10%).
- **Disk Utilization:** Filesystem usage < 70% of partition capacity.
- **PgBouncer Saturation:** Active pool client wait queue < 5ms.

If a node exceeds any threshold, it transitions to `draining` state and rejects new placement requests until rebalanced.
