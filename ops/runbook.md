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
- **PITR / continuous WAL archiving (2026-09-03):** pgBackRest 2.59.1 installed and configured against the same B2 bucket used for off-node checkpoint uploads (`stashi-backups`, prefixed under `/pgbackrest`, separate from the `off-node checkpoint` dump objects). Config lives at `/etc/pgbackrest.conf` on the node (template: `ops/pgbackrest/pgbackrest.conf.example` — real file is not committed, has live B2 keys) and `/etc/postgresql/17/main/conf.d/zz-pgbackrest.conf` (committed template: `ops/pgbackrest/zz-pgbackrest.conf`). `archive_mode=on` requires a full restart (`PGC_POSTMASTER`); this was done live against the `ynai` production cluster with a fresh verified `pg_dump` safety-net taken first, `pg_reload_conf()` used to validate config syntax pre-restart, and `ynai` size/table-count verified unchanged immediately after. **Hit and fixed a real bug**: pgBackRest's `compress-type` option uses the short form `zst`, not `zstd` (the spelling `pg_dump --compress=zstd:3` uses) — the wrong value caused `archive-push` to fail with error `[032]` on 3 WAL segments before the fix; PostgreSQL's own archiver auto-retried and self-healed once corrected, no manual WAL recovery was needed. Verified end-to-end: `pgbackrest check` passes, `pg_stat_archiver` shows fresh `archived_count`/`last_archived_time` after a forced `pg_switch_wal()`, and the WAL objects are confirmed present in the B2 bucket by direct `aws s3 ls`. First full base backup (`pgbackrest --stanza=main --type=full backup`) ran immediately after: 5.2GB database, 3.4GB compressed, confirmed present in B2 (46 objects under the backup set incl. `backup.manifest`), verified via `pgbackrest info`. Daily/weekly systemd timers deployed and enabled (`pgbackrest-incr.timer` Mon-Sat 02:00, `pgbackrest-full.timer` Sun 02:00).
  - **Restore drill: attempted, blocked, not yet verified.** Restoring the 5.2GB backup to an isolated `restore_test` data directory consumed enough B2 download bandwidth to hit the account's **Caps & Alerts** limit on Class B (download) transactions — a spending guardrail on the Backblaze account, not a bug in the pgBackRest setup itself (`AccessDenied: ... download bandwidth or transaction (Class B) cap exceeded`). Raising it permanently requires adding a credit card to the B2 account, which was declined for now. B2's Class B cap resets daily, so this should clear on its own; the `restore_test` directory was cleaned up and `ynai` was verified untouched throughout. **Action needed before this restore path can be trusted:** re-run the restore drill (Phase 7, step 6 below / `ops/rollback-procedure.md` Section 5) after the daily reset and confirm it completes. Until that drill passes, treat physical PITR restore as unverified even though archiving/backup are confirmed working.

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

---

## Phase 7 — Continuous WAL Archiving & PITR (pgBackRest)

This is separate from the logical `.dump` checkpoint system (`ops/scripts/backup.sh`, `create_checkpoint` job) — that facility remains the per-tenant, on-demand "save point" mechanism surfaced in the console. pgBackRest provides physical, cluster-wide continuous archiving so any point in time can be recovered, not just discrete checkpoints.

1. **Install & configure (one-time):**
   ```bash
   sudo apt-get install -y pgbackrest
   sudo cp ops/pgbackrest/pgbackrest.conf.example /etc/pgbackrest.conf
   # edit /etc/pgbackrest.conf: fill in repo1-s3-key / repo1-s3-key-secret from the secret store
   sudo chown postgres:postgres /etc/pgbackrest.conf
   sudo chmod 640 /etc/pgbackrest.conf
   sudo mkdir -p /var/log/pgbackrest && sudo chown postgres:postgres /var/log/pgbackrest
   sudo cp ops/pgbackrest/zz-pgbackrest.conf /etc/postgresql/17/main/conf.d/zz-pgbackrest.conf
   sudo chown postgres:postgres /etc/postgresql/17/main/conf.d/zz-pgbackrest.conf
   sudo -u postgres pgbackrest --stanza=main stanza-create
   ```

   **`compress-type` must be `zst`, not `zstd`.** pgBackRest's allowed values are `none | bz2 | gz | lz4 | zst`. This is a different spelling convention from `pg_dump --compress=zstd:N` used elsewhere in this repo — do not unify them, they are genuinely different flags on different tools.

2. **Apply `archive_mode=on` (restart required):**
   `archive_mode` is `PGC_POSTMASTER` — a reload is not enough. Before restarting:
   ```bash
   # validate config syntax without restarting (archive_mode won't take effect yet)
   sudo -u postgres psql -Atc "select pg_reload_conf();"
   sudo -u postgres psql -Atc "select name, setting, pending_restart from pg_settings where name in ('archive_mode','archive_command');"
   # take a fresh verified safety-net dump before the restart
   # then:
   sudo systemctl restart postgresql@17-main
   sudo -u postgres psql -Atc "show archive_mode;"
   ```
   Verify the production database(s) are unchanged immediately after (size, table count) and that PgBouncer/app connections re-establish.

3. **Verify archiving is actually working — do not trust exit code alone:**
   ```bash
   sudo -u postgres pgbackrest --stanza=main check
   sudo -u postgres psql -Atc "select pg_switch_wal();"
   sudo -u postgres psql -Atc "select archived_count, failed_count, last_archived_wal, last_archived_time, last_failed_wal from pg_stat_archiver;"
   # confirm the object actually landed in B2:
   aws s3 ls s3://stashi-backups/pgbackrest/archive/main/17-1/<timeline-segment-prefix>/ --endpoint-url https://s3.us-east-005.backblazeb2.com
   ```
   `last_archived_time` should be recent and `archived_count` should have incremented since the forced switch. `failed_count`/`last_failed_wal` are cumulative and won't reset on their own — a fix is confirmed by new successes accumulating, not by the failure counter clearing.

4. **First full base backup:**
   ```bash
   sudo -u postgres pgbackrest --stanza=main --type=full backup
   sudo -u postgres pgbackrest --stanza=main info
   ```

5. **Backup schedule:** full backup weekly (Sunday 02:00) plus daily incrementals (Mon-Sat 02:00), via systemd timers (preferred over cron for logging/journalctl integration):
   ```bash
   sudo cp ops/pgbackrest/pgbackrest-full.service ops/pgbackrest/pgbackrest-full.timer \
          ops/pgbackrest/pgbackrest-incr.service ops/pgbackrest/pgbackrest-incr.timer \
          /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now pgbackrest-full.timer pgbackrest-incr.timer
   systemctl list-timers | grep pgbackrest
   ```

6. **Restore drills:** always restore to an isolated location (a scratch directory / spare stanza), never in place on the live cluster:
   ```bash
   sudo -u postgres pgbackrest --stanza=main --type=time --target="<timestamp>" --pg1-path=/var/lib/postgresql/17/restore_test restore
   ```
   Confirm the restored cluster starts and the expected data is present before considering a restore path trustworthy.

   **Known constraint (2026-09-03):** a full restore of this node's ~5.2GB database consumes enough B2 download bandwidth to trip the account's Caps & Alerts Class B (download) limit, which aborts the restore mid-recovery (fails to fetch `archive.info`/WAL). This is a Backblaze account spending guardrail, not a pgBackRest defect — raising the cap permanently needs a credit card on the B2 account (declined for now). The cap resets daily. Before trusting this restore path (and before any real disaster recovery), re-run a restore drill after the daily reset and confirm it completes and the throwaway instance starts and serves correct data (see `ops/rollback-procedure.md` Section 5 for the full drill + verification steps). If restores remain a recurring need, either add the card to raise the cap, or budget for the (small, non-recurring) per-restore download cost.

7. **Retention:** `repo1-retention-full=7` currently applies bucket-wide (7 full backups retained). The product spec calls for plan-aware retention (Dev ~1 day, Starter ~3 days, Production ~7 days, larger tiers 14-30+ days) — a single shared stanza/retention policy does not yet support per-tenant retention tiers. This node currently hosts one physical cluster (`ynai` + Stashi tenants sharing it), so today's retention setting is a node-wide policy, not yet a per-plan one. Revisit if/when tenants get dedicated clusters.
