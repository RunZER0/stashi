# Stashi Node Rollback & Emergency Recovery Procedure

This document specifies the exact steps required to roll back any Stashi configuration changes or recover the node state without impacting the pre-existing production `ynai` database.

---

## 1. Safety Invariants

1. **The `ynai` database is sacred:** Under no circumstances should `DROP DATABASE ynai`, `ALTER DATABASE ynai`, or any DDL on `ynai` roles be performed.
2. **PostgreSQL port 5432 must never be publicly exposed.**
3. **Always verify existing service health before and after any modification:**
   ```bash
   sudo -u postgres psql -d ynai -c "SELECT current_database(), current_user, count(*) FROM pg_tables WHERE schemaname = 'public';"
   ```

---

## 2. Emergency Rollback: Reverting Stashi Agent & PgBouncer

If a deployment or configuration update causes anomalies:

### Step 1: Stop the Stashi Node Agent
```bash
sudo systemctl stop stashi-agent
sudo systemctl disable stashi-agent
```

### Step 2: Restore PgBouncer Configuration
If `pgbouncer.ini` or `userlist.txt` became corrupted:
```bash
# Copy backup configurations
sudo cp /etc/pgbouncer/pgbouncer.ini.bak /etc/pgbouncer/pgbouncer.ini
sudo cp /etc/pgbouncer/userlist.txt.bak /etc/pgbouncer/userlist.txt

# Reload or restart PgBouncer
sudo systemctl reload pgbouncer || sudo systemctl restart pgbouncer

# Test local & external connectivity to ynai
psql -h 127.0.0.1 -p 6432 -U ynai_user -d ynai -c "SELECT 1;"
```

### Step 3: Revert PostgreSQL Cluster Changes
If `postgresql.conf` or `pg_hba.conf` were modified:
```bash
sudo cp /etc/postgresql/17/main/postgresql.conf.bak /etc/postgresql/17/main/postgresql.conf
sudo cp /etc/postgresql/17/main/pg_hba.conf.bak /etc/postgresql/17/main/pg_hba.conf

sudo systemctl reload postgresql@17-main
```

---

## 3. Removing a Failed Tenant Database

If a test tenant creation failed halfway through:
```bash
# 1. Terminate all active backend connections for the tenant
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'st_db_failed';"

# 2. Drop the database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS \"st_db_failed\";"

# 3. Drop the tenant role
sudo -u postgres psql -c "DROP ROLE IF EXISTS \"st_user_failed\";"

# 4. Remove tenant entry from PgBouncer userlist.txt and reload
sudo sed -i '/"st_user_failed"/d' /etc/pgbouncer/userlist.txt
sudo systemctl reload pgbouncer
```

---

## 4. Restoring YNAI Database from Off-Node Backup

In the catastrophic event of hardware or cluster failure:

```bash
# 1. Download latest verified YNAI backup from Cloudflare R2 / S3
export AWS_ACCESS_KEY_ID="<R2_ACCESS_KEY>"
export AWS_SECRET_ACCESS_KEY="<R2_SECRET_KEY>"
export AWS_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"

aws s3 cp s3://stashi-backups/ynai/latest_verified.dump /tmp/ynai_restore.dump

# 2. Verify SHA256 checksum
sha256sum -c /tmp/ynai_restore.dump.sha256

# 3. Create fresh database container
sudo -u postgres createdb -O ynai_owner ynai_restored

# 4. Restore using pg_restore with parallelism
sudo -u postgres pg_restore -v -d ynai_restored -j 2 /tmp/ynai_restore.dump

# 5. Verify row count and table integrity
sudo -u postgres psql -d ynai_restored -c "ANALYZE; SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

This path restores from a discrete logical `.dump` checkpoint and is best for restoring a single tenant/database to a known save point. It cannot recover to an arbitrary point in time between backups — for that, use Section 5.

---

## 5. Point-in-Time Recovery (pgBackRest)

Use this when the need is "restore to 3:47pm yesterday" rather than "restore to the last checkpoint." See `ops/runbook.md` Phase 7 for setup. **Never restore in place on the live cluster** — always restore to an isolated path first, verify, then only promote if this is an actual disaster-recovery event (not a drill).

```bash
# 1. Confirm backup history and available recovery window
sudo -u postgres pgbackrest --stanza=main info

# 2. Restore to an isolated directory, targeting a specific time
sudo -u postgres pgbackrest --stanza=main --type=time \
  --target="2026-09-03 14:00:00+00" \
  --pg1-path=/var/lib/postgresql/17/restore_test \
  restore

# 3. Start a throwaway PostgreSQL instance against the restored data directory
#    on a different port to inspect it before trusting/promoting it
sudo -u postgres /usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/restore_test \
  -o "-p 5433" -l /tmp/restore_test.log start

# 4. Verify expected data is present
psql -h 127.0.0.1 -p 5433 -U postgres -d ynai -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"

# 5. Tear down the drill instance — do not leave it running
sudo -u postgres /usr/lib/postgresql/17/bin/pg_ctl -D /var/lib/postgresql/17/restore_test stop
sudo rm -rf /var/lib/postgresql/17/restore_test
```

Only after a restore is verified against an isolated instance should promotion to the live path (stopping the real cluster, swapping data directories) even be considered, and only for an actual incident — not a routine drill.

**Status (2026-09-03): this drill has not yet passed.** A first attempt hit the B2 account's Caps & Alerts Class B (download) limit partway through recovery — restoring ~5.2GB used up the daily download allowance, and the subsequent `archive.info` fetch was rejected with `AccessDenied ... cap exceeded`. The cap resets daily; permanently raising it needs a credit card on the B2 account, which was declined for now. `ynai` and the live cluster were unaffected (this only touches the isolated `restore_test` path). **Do not treat PITR restore as trustworthy until this drill is re-run after the reset and passes.**
