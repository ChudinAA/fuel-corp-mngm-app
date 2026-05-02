#!/bin/sh
# =============================================================================
# Aviation Fuel Management System — Restore Script
# =============================================================================
# Использование:
#   ./restore.sh <путь_к_файлу_бэкапа.sql.gz>
#
# Пример:
#   docker exec -it avfuel_db sh -c \
#     "PGPASSWORD=mypass pg_restore ..." 
#
# Или через этот скрипт на хосте:
#   PGPASSWORD=pass POSTGRES_HOST=localhost ./restore.sh ./backups/full/avfuel_full_2025-01-01_02-00-00.sql.gz
# =============================================================================

BACKUP_FILE="$1"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-avfuel}"
POSTGRES_DB="${POSTGRES_DB:-avfuel}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh /backups/full/*.sql.gz 2>/dev/null || ls -lh ./backups/full/*.sql.gz 2>/dev/null
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=== Starting restore from: $BACKUP_FILE ==="
log "Target: $POSTGRES_USER@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo ""
echo "WARNING: This will REPLACE all data in the database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read CONFIRM

log "Dropping and recreating schema..."
psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1

log "Restoring from backup..."
gunzip -c "$BACKUP_FILE" | psql \
  -h "$POSTGRES_HOST" \
  -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --single-transaction \
  -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  log "=== Restore completed successfully ==="
else
  log "ERROR: Restore FAILED. Check the output above."
  exit 1
fi
