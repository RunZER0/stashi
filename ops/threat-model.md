# Stashi Multi-Tenant PostgreSQL Security & Threat Model

This document outlines the threat vectors, isolation guarantees, and cryptographic controls enforced across Stashi multi-tenant PostgreSQL clusters.

---

## 1. System Architecture & Boundaries

```
                       [ Public Internet / AI Agents / Applications ]
                                            │
                                            │ TLS 1.3 (Port 6432)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STASHI NODE (Ubuntu 24.04 Hardened VPS)                                                │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PgBouncer (Transaction Pooler - Port 6432 Public)                              │   │
│   │  • TLS Termination with Valid Let's Encrypt / Wildcard Certificate             │   │
│   │  • SCRAM-SHA-256 Authentication via Atomic userlist.txt / auth_query           │   │
│   │  • Per-tenant connection limits & transaction pooling                          │   │
│   └───────────────────────────────────┬────────────────────────────────────────────┘   │
│                                       │ Local Unix Socket / 127.0.0.1 (Port 5432)       │
│                                       ▼                                                │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ PostgreSQL 17 Engine (Localhost Only - Port 5432)                               │   │
│   │  • listen_addresses = '127.0.0.1, ::1' (Never bound to public IP)              │   │
│   │  • REVOKE ALL ON DATABASE template1 FROM PUBLIC                                │   │
│   │  • REVOKE CREATE ON SCHEMA public FROM PUBLIC                                  │   │
│   │  • Isolated per-tenant databases & non-superuser login roles                   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                       ▲                                                │
│                                       │ Scoped Local Unix Socket (sudo -u postgres)    │
│   ┌───────────────────────────────────┴────────────────────────────────────────────┐   │
│   │ Stashi Node Agent (Systemd Service: stashi-agent)                              │   │
│   │  • Outbound-only polling to Control Plane (No open inbound admin ports)        │   │
│   │  • HMAC-SHA256 Signed Job Dispatch with Idempotency Keys                       │   │
│   │  • Strict Identifier Quoting & Parameterized SQL Helpers                       │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Threat Analysis & Mitigations

### 2.1 Threat: Cross-Tenant Data Access
- **Attack Vector:** Tenant A connects to Tenant B's database or accesses records in Tenant B's schemas.
- **Mitigations:**
  1. **Strict Database Ownership:** Each database is created with `OWNER = <tenant_role>` or a dedicated scoped owner role.
  2. **Revocation of Public Access:**
     ```sql
     REVOKE ALL ON DATABASE <tenant_db> FROM PUBLIC;
     REVOKE ALL ON SCHEMA public FROM PUBLIC;
     GRANT ALL ON DATABASE <tenant_db> TO <tenant_role>;
     ```
  3. **No Cross-Database Queries:** PostgreSQL prevents cross-database queries across different database catalogs without `dblink` or `postgres_fdw` (both restricted to superusers).

### 2.2 Threat: Privilege Escalation to Superuser
- **Attack Vector:** An autonomous agent or developer runs `CREATE ROLE ... SUPERUSER` or accesses `pg_shadow` / `pg_authid`.
- **Mitigations:**
  1. Tenant roles are explicitly created with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`.
  2. The `public` schema in `template1` has default `CREATE` privileges revoked.
  3. PostgreSQL superuser credentials (`postgres` role) are exclusively accessed locally via `peer` authentication by the systemd agent or root operator.

### 2.3 Threat: SQL Injection in Node Provisioner
- **Attack Vector:** Customer passes malicious database or username strings containing SQL injection payloads (e.g. `test_db; DROP DATABASE ynai; --`).
- **Mitigations:**
  1. **Deterministic Identifier Generation:** Internal database names and role names are generated deterministically by the control plane using sanitized slugs and nanoid prefixes (e.g. `st_db_01jstashi...`).
  2. **Identifier Quoting:** All administrative DDL scripts use PostgreSQL `quote_ident()` or parameterized identifiers (`format('CREATE DATABASE %I WITH OWNER = %I', $1, $2)`).
  3. **Zero Shell Interpolation:** Never interpolate user input into `psql` command lines via `bash -c`.

### 2.4 Threat: Denial of Service / Resource Starvation
- **Attack Vector:** An autonomous agent reasoning loop executes runaway infinite queries or opens 10,000 idle connections.
- **Mitigations:**
  1. **PgBouncer Transaction Pooling:** Multiplexes client connections into a controlled small backend server pool.
  2. **Connection Caps:** PostgreSQL enforces `CONNECTION LIMIT <N>` on every tenant role.
  3. **Statement Timeout:** Default `statement_timeout = '30s'` configured on tenant databases.
  4. **Storage Ceilings:** Monitored size sampling flags runaway databases and sets `default_transaction_read_only = on` if the plan ceiling is exceeded.

### 2.5 Threat: Port Exposure & Network Attacks
- **Attack Vector:** Direct brute-force attacks against port 5432 or unencrypted plaintext eavesdropping.
- **Mitigations:**
  1. Port 5432 is strictly bound to `127.0.0.1` and blocked by UFW from any external interfaces.
  2. Port 6432 requires TLS (`client_tls_sslmode = require`).
  3. `fail2ban` monitors connection anomalies on SSH and PgBouncer log outputs.

---

## 3. Cryptographic Storage & Secrets

1. **Authentication:** All passwords hashed with `SCRAM-SHA-256` (16,384 rounds minimum). Plaintext passwords are never logged or stored on the database server.
2. **Secrets Location:** Node agent API tokens and encryption keys are stored in `/etc/stashi/agent.env` with POSIX permissions `0600` owned by `root:stashi-agent`.
3. **Control Plane Communication:** Outbound TLS 1.3 with HMAC-SHA256 request signatures and unique nonces/timestamps to prevent replay attacks.
