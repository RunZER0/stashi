# Stashi Production Node Operations Runbook

This runbook guides operators through initializing, securing, and maintaining Stashi PostgreSQL nodes without disrupting pre-existing production workloads (such as the `ynai` cluster).

## Status on `ynai-postgres-01` (162.35.118.235), as of 2026-09-02

Real work completed against the live node, verified (not simulated):

- **Phase 1 (inventory):** done. Node was 1 vCPU / 1.9 GiB / 40 GB; upgraded via InterServer panel to 1 vCPU / 3.8 GiB / 77 GB. Confirmed via `free -h`/`df -h` before and after.
- **Phase 2 (security baseline):** `stashi_admin` sudo user created with an ed25519 key; root password login and password auth disabled (`PermitRootLogin prohibit-password`, `PasswordAuthentication no`) — confirmed the old root+password path is rejected. UFW/fail2ban were already active from the base image; **port 80 is intentionally open** for the certbot HTTP-01 renewal that keeps the PgBouncer TLS cert valid (see correction below) — do not close it per the original Phase 2 spec.
- **Phase 3/4 (tenant model + PgBouncer):** the real TLS cert lives at `/etc/pgbouncer/tls/server.{crt,key}` (sourced from Let's Encrypt `/etc/letsencrypt/live/db.ynai.co.ke/`), **not** `/etc/ssl/stashi/` as originally assumed below — fix any doc/script referencing the old path. `pgbouncer.ini` now has a `* = host=127.0.0.1 port=5432` wildcard added after the explicit `ynai` line, so any tenant database created by the agent is automatically reachable through 6432 without editing pgbouncer.ini per tenant.
- **Phase 5 (node agent):** Node.js 18 + npm installed; `agent.js` deployed to `/opt/stashi-agent`, running as `stashi-agent.service` (enabled, active). `/etc/stashi/agent.env` holds a real generated `STASHI_AGENT_SHARED_SECRET` (0600, root-owned) — the **same secret** must be set as `STASHI_AGENT_SHARED_SECRET` in the control plane's environment, or HMAC verification on `/api/agent/*` will reject every request. `STASHI_CONTROL_PLANE_URL` is still a placeholder (`https://REPLACE_ME_AFTER_RENDER_DEPLOY.onrender.com`) — update it once the control plane has a real deployed URL, then `systemctl restart stashi-agent`.
- **Control-plane storage:** the web app's data (users, databases, activity, jobs, node telemetry) lives in a real Postgres database (`stashi_control`, owned by `stashi_control_owner`) on this same VPS — provisioned the exact same way any tenant would be, reachable only through PgBouncer on 6432 with TLS, never superuser. This replaced an earlier JSON-file store, which would not have survived a restart/redeploy on a host without a paid, separately-billed persistent disk (e.g. Render's free tier). Connection string lives in `CONTROL_PLANE_DATABASE_URL`.
- **Phase 7 (backups):** AWS CLI v2 installed on the node. `R2_ENDPOINT_URL` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in `/etc/stashi/agent.env` are still blank — backups will silently skip the off-node upload step (see `backup.sh`) until real R2 credentials are filled in.
- **Phase 10 (acceptance):** `verify-node.sh` now genuinely passes **15/15** against the live deployed control plane at `https://stashi.onrender.com`. Fixed three real bugs found while running it live: test 5 previously always passed regardless of outcome, cleanup used a nonexistent `droprole` command (correct is `dropuser`) in three places, and test 15 POSTed unsigned to the HMAC-protected `/api/agent/jobs` and mistook the correct 401 for "unreachable" (now checks the root path instead). `ynai` verified byte-identical (`pg_database_size`, table count) before and after every run.
- **Pooled Dev tier, SQL editor, checkpoints, plan upgrades, MCP server** — all built and verified live end-to-end: create pooled tenant → real schema+role → SQL editor CRUD → checkpoint → simulated bad migration (`DROP TABLE`) → rollback → verified data restored exactly; MCP server spawned as a real client and called all 5 tools against a live tenant, with its actions showing up distinctly as `agent` (vs `you`/`node-agent`) in the audit log; plan upgrade Starter→Production verified the role's real `CONNECTION LIMIT` changed on the box. Three more real bugs found and fixed along the way:
  - `statement_timeout` can't be a `pg.Client` startup-packet option under PgBouncer's transaction pooling — it rejects any startup parameter outside a fixed allowlist. Apply it as a `SET` query after connecting instead.
  - `create_checkpoint`'s `mkdir` ran as the `postgres` OS user, which doesn't own `/var/backups` (the parent dir) and can't create a subdirectory there. Create it as root (the agent's own privilege) and `chown` it to `postgres` so `pg_dump` can write into it.
  - `delete_pool_tenant`'s `DROP ROLE` failed because `create_pool_tenant`'s `GRANT CONNECT ON DATABASE` is a real dependency that has to be `REVOKE`d first — Postgres refuses to drop a role with outstanding privileges on a database.
- **Per-tenant storage/connection sampling is not wired yet** — only node-level CPU/mem/disk telemetry exists. Each database's `storageUsedMb`/`connections` fields are real columns, honestly starting at 0, but nothing updates them yet. Console downgrade protection and the storage bar are running on that placeholder until this is built.

---

## Phase 1 — Pre-Flight Inventory & Rollback Point

Before making any changes on the VPS:

1. **System & Resource Inspection:**
   ```bash
   hostnamectl
   lsb_release -a
   free -h
   df -h
   lsblk
   ```

2. **PostgreSQL & Service Status:**
   ```bash
   pg_lsclusters
   sudo -u postgres psql -Atc "select version();"
   sudo -u postgres psql -Atc "select datname, pg_size_pretty(pg_database_size(datname)) from pg_database where datistemplate = false order by 1;"
   sudo -u postgres psql -Atc "show listen_addresses;"
   sudo -u postgres psql -Atc "show shared_preload_libraries;"
   sudo -u postgres psql -Atc "show track_io_timing;"
   sudo -u postgres psql -Atc "show max_connections;"
   ss -ltnp
   ufw status numbered
   systemctl status postgresql@17-main --no-pager
   systemctl status pgbouncer --no-pager
   systemctl status fail2ban --no-pager
   ```

3. **Pre-Change Database Backup:**
   ```bash
   # Take a verified snapshot of the ynai database before any modifications
   /opt/stashi/scripts/backup.sh ynai 30
   ```

---

## Phase 2 — Security Baseline

1. **Localhost PostgreSQL Binding:**
   Verify `listen_addresses` in `/etc/postgresql/17/main/postgresql.conf`:
   ```ini
   listen_addresses = '127.0.0.1, ::1'
   ```

2. **PgBouncer Public TLS Endpoint:**
   Configure `/etc/pgbouncer/pgbouncer.ini`:
   ```ini
   [databases]
   * = host=127.0.0.1 port=5432 auth_user=postgres

   [pgbouncer]
   logfile = /var/log/postgresql/pgbouncer.log
   pidfile = /var/run/postgresql/pgbouncer.pid
   listen_addr = *
   listen_port = 6432
   auth_type = scram-sha-256
   auth_file = /etc/pgbouncer/userlist.txt
   pool_mode = transaction
   max_client_conn = 1000
   default_pool_size = 20
   min_pool_size = 5
   client_tls_sslmode = require
   client_tls_key_file = /etc/ssl/stashi/privkey.pem
   client_tls_cert_file = /etc/ssl/stashi/fullchain.pem
   ```

3. **UFW Firewall Rules:**
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow 22/tcp comment 'SSH'
   sudo ufw allow 6432/tcp comment 'PgBouncer TLS'
   sudo ufw enable
   ```

---

## Phase 3 — Tenant Provisioning Model

1. **Deterministic Naming:**
   - Internal DB name: `st_db_<nanoid>`
   - Internal Role name: `st_usr_<nanoid>`

2. **SQL Provisioning Template:**
   ```sql
   CREATE ROLE "st_usr_01j9x" WITH LOGIN PASSWORD 'strong_scram_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10;
   CREATE DATABASE "st_db_01j9x" WITH OWNER = "st_usr_01j9x";
   REVOKE ALL ON DATABASE "st_db_01j9x" FROM PUBLIC;
   GRANT ALL ON DATABASE "st_db_01j9x" TO "st_usr_01j9x";
   ```

3. **Atomic PgBouncer Reload:**
   ```bash
   # Retrieve SCRAM hash from catalog
   SCRAM_HASH=$(sudo -u postgres psql -Atc "SELECT rolpassword FROM pg_authid WHERE rolname = 'st_usr_01j9x';")
   echo '"st_usr_01j9x" "'"${SCRAM_HASH}"'"' | sudo tee -a /etc/pgbouncer/userlist.txt >/dev/null
   sudo systemctl reload pgbouncer
   ```

---

## Phase 4 — Node Agent Deployment

1. **Install Node Agent:**
   ```bash
   sudo mkdir -p /opt/stashi-agent /etc/stashi
   sudo cp ops/node-agent/agent.js /opt/stashi-agent/
   sudo cp ops/node-agent/.env.example /etc/stashi/agent.env
   sudo chmod 600 /etc/stashi/agent.env
   sudo cp ops/node-agent/stashi-agent.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now stashi-agent
   ```

2. **Inspect Agent Journal:**
   ```bash
   journalctl -u stashi-agent -f
   ```

---

## Phase 5 — Backup & Restore Drills

1. **Run Daily Backup:**
   ```bash
   /opt/stashi/scripts/backup.sh <database_name> 7
   ```

2. **Execute Restore Drill:**
   ```bash
   /opt/stashi/scripts/restore.sh /var/backups/stashi/<backup_file>.dump
   ```

---

## Phase 6 — Phase 10 Acceptance Test

Run the full automated certification script:
```bash
chmod +x ops/scripts/verify-node.sh
./ops/scripts/verify-node.sh
```
All 15 tests must pass before the node is certified for production traffic.
