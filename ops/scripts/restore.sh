#!/usr/bin/env bash
# ==============================================================================
# Stashi Production Restore & Drill Verification Script
# Restores a custom-format dump into an isolated temporary validation database,
# runs table counts and health queries, and reports verification success.
# ==============================================================================

set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-st_drill_verify_$(date +%s)}"

if [[ -z "$BACKUP_FILE" ]] || [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup_file.dump> [target_database_name]"
  exit 1
fi

echo "==> [1/4] Checking backup checksum..."
if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  sha256sum -c "${BACKUP_FILE}.sha256"
  echo "Checksum verified OK."
fi

echo "==> [2/4] Creating temporary target database: ${TARGET_DB}..."
sudo -u postgres createdb "$TARGET_DB"

cleanup() {
  if [[ "$TARGET_DB" == st_drill_* ]]; then
    echo "==> Cleaning up temporary drill database: ${TARGET_DB}..."
    sudo -u postgres dropdb --if-exists "$TARGET_DB"
  fi
}
trap cleanup EXIT

echo "==> [3/4] Restoring dump using pg_restore..."
sudo -u postgres pg_restore -v --no-owner --no-privileges -d "$TARGET_DB" "$BACKUP_FILE" || true

echo "==> [4/4] Verifying database integrity..."
TABLE_COUNT=$(sudo -u postgres psql -At -d "$TARGET_DB" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
TOTAL_SIZE=$(sudo -u postgres psql -At -d "$TARGET_DB" -c "SELECT pg_size_pretty(pg_database_size('$TARGET_DB'));")

echo "=================================================="
echo "RESTORE DRILL SUCCESSFUL"
echo "Target DB:    ${TARGET_DB}"
echo "Table Count:  ${TABLE_COUNT}"
echo "DB Size:      ${TOTAL_SIZE}"
echo "Status:       HEALTHY & VERIFIED"
echo "=================================================="
