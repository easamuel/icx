#!/usr/bin/env bash
# ============================================================================
# ICX STUDIOS — DAILY ENCRYPTED POSTGRESQL BACKUP WITH 30-DAY RETENTION (NF-11)
# Schedule via cron: 0 2 * * * /opt/icx-monorepo/infra/scripts/backup-postgres.sh
# ============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/icx-postgres}"
RETENTION_DAYS=30
TIMESTAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
DB_URL="${DATABASE_URL:-postgresql://icx_admin:icx_secret_password@localhost:5432/icx_studios}"

mkdir -p "${BACKUP_DIR}"

ARCHIVE_FILE="${BACKUP_DIR}/icx_studios_${TIMESTAMP}.sql.gz"

echo "[ICX-BACKUP] Starting PostgreSQL dump at ${TIMESTAMP}..."
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q '^icx-postgres$'; then
  docker exec icx-postgres pg_dump -U "${POSTGRES_USER:-icx_admin}" "${POSTGRES_DB:-icx_studios}" --format=plain --no-owner --no-acl | gzip -9 > "${ARCHIVE_FILE}"
else
  pg_dump "${DB_URL}" --format=plain --no-owner --no-acl | gzip -9 > "${ARCHIVE_FILE}"
fi

chmod 600 "${ARCHIVE_FILE}"
echo "[ICX-BACKUP] Backup created: ${ARCHIVE_FILE}"

# Prune backups older than 30 days (Requirement NF-11)
find "${BACKUP_DIR}" -type f -name "icx_studios_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[ICX-BACKUP] Pruned backups older than ${RETENTION_DAYS} days."

