#!/usr/bin/env bash
# ==============================================================================
# Stashi Production Backup Script
# Performs atomic custom-format pg_dump, generates SHA256 checksum, uploads to
# S3/Cloudflare R2, verifies remote object existence, and prunes old snapshots.
# ==============================================================================

set -euo pipefail

DB_NAME="${1:-}"
RETENTION_DAYS="${2:-7}"

if [[ -z "$DB_NAME" ]]; then
  echo "Usage: $0 <database_name> [retention_days]"
  exit 1
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
BACKUP_DIR="/var/backups/stashi"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
R2_BUCKET="${R2_BUCKET:-stashi-backups}"
R2_PREFIX="${DB_NAME}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "==> [1/5] Starting pg_dump for database: ${DB_NAME}..."
sudo -u postgres pg_dump -Fc -Z 6 -f "$BACKUP_FILE" "$DB_NAME"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file ${BACKUP_FILE} is empty or missing."
  exit 1
fi

echo "==> [2/5] Computing SHA256 checksum..."
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
CHECKSUM=$(awk '{print $1}' "$CHECKSUM_FILE")
FILE_SIZE=$(stat -c%s "$BACKUP_FILE")

echo "Backup created successfully: ${FILE_SIZE} bytes (SHA256: ${CHECKSUM})"

if [[ -n "${R2_ENDPOINT_URL:-}" ]] && command -v aws >/dev/null 2>&1; then
  echo "==> [3/5] Uploading to off-node S3/R2 storage (s3://${R2_BUCKET}/${R2_PREFIX}/)..."
  aws --endpoint-url "$R2_ENDPOINT_URL" s3 cp "$BACKUP_FILE" "s3://${R2_BUCKET}/${R2_PREFIX}/$(basename "$BACKUP_FILE")"
  aws --endpoint-url "$R2_ENDPOINT_URL" s3 cp "$CHECKSUM_FILE" "s3://${R2_BUCKET}/${R2_PREFIX}/$(basename "$CHECKSUM_FILE")"

  echo "==> [4/5] Verifying remote object existence and size..."
  REMOTE_SIZE=$(aws --endpoint-url "$R2_ENDPOINT_URL" s3 ls "s3://${R2_BUCKET}/${R2_PREFIX}/$(basename "$BACKUP_FILE")" | awk '{print $3}')
  
  if [[ "$REMOTE_SIZE" -ne "$FILE_SIZE" ]]; then
    echo "ERROR: Remote size mismatch! Local: ${FILE_SIZE}, Remote: ${REMOTE_SIZE}"
    exit 1
  fi
  echo "Remote verification passed: ${REMOTE_SIZE} bytes verified in R2."
else
  echo "==> [3/5] Skipping off-node upload (R2_ENDPOINT_URL not configured). Retaining local file."
fi

echo "==> [5/5] Pruning local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump.sha256" -type f -mtime +"$RETENTION_DAYS" -delete

echo "==> Backup complete for ${DB_NAME} at ${TIMESTAMP}."
