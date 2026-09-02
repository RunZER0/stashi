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
