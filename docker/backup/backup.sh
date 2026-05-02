#!/bin/sh
# =============================================================================
# Aviation Fuel Management System — Backup Script
# =============================================================================
# Переменные окружения (передаются из docker-compose):
#   POSTGRES_HOST    - хост БД (default: db)
#   POSTGRES_USER    - пользователь БД
#   POSTGRES_DB      - имя БД
#   PGPASSWORD       - пароль (используется pg_dump автоматически)
#   BACKUP_RETENTION_DAYS        - сколько дней хранить полные бэкапы (default: 30)
#   BACKUP_ARCHIVE_RETENTION_DAYS - сколько дней хранить архивные бэкапы (default: 365)
# =============================================================================

BACKUP_DIR="/backups"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_USER="${POSTGRES_USER:-avfuel}"
POSTGRES_DB="${POSTGRES_DB:-avfuel}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ARCHIVE_RETENTION_DAYS="${BACKUP_ARCHIVE_RETENTION_DAYS:-365}"

# Быстрорастущие таблицы — выгружаются отдельно для архивирования
ARCHIVE_TABLES="audit_log"

# Таблицы с операционными данными — выгружаются отдельно для архива
OPERATIONAL_TABLES="opt refueling aircraft_refueling_abroad movement warehouse_transactions equipment_movement transportation"

DATE=$(date +%Y-%m-%d)
DATETIME=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR/full"
mkdir -p "$BACKUP_DIR/archive/audit_log"
mkdir -p "$BACKUP_DIR/archive/operational"
mkdir -p "$BACKUP_DIR/schema"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# =============================================================================
# 1. Полный дамп базы данных (ежедневно)
# =============================================================================
do_full_backup() {
  FULL_FILE="$BACKUP_DIR/full/avfuel_full_${DATETIME}.sql.gz"
  log "Starting full backup → $FULL_FILE"

  pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=plain \
    --no-owner \
    --no-acl \
    --compress=9 \
    | gzip > "$FULL_FILE"

  if [ $? -eq 0 ]; then
    log "Full backup completed: $(du -sh "$FULL_FILE" | cut -f1)"
  else
    log "ERROR: Full backup FAILED"
    rm -f "$FULL_FILE"
    exit 1
  fi
}

# =============================================================================
# 2. Архивный дамп таблицы audit_log (только данные старше 90 дней)
#    Позволяет выгрузить старые аудит-записи в холодное хранилище и затем
#    удалить их из основной таблицы командой:
#      DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
# =============================================================================
do_archive_audit_log() {
  ARCHIVE_FILE="$BACKUP_DIR/archive/audit_log/audit_log_${DATE}.sql.gz"
  log "Archiving audit_log (>90 days old) → $ARCHIVE_FILE"

  pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --format=plain \
    --no-owner \
    --no-acl \
    --table=audit_log \
    --where="created_at < NOW() - INTERVAL '90 days'" \
    | gzip > "$ARCHIVE_FILE"

  if [ $? -eq 0 ]; then
    SIZE=$(du -sh "$ARCHIVE_FILE" | cut -f1)
    log "Audit log archive: $SIZE"
  else
    log "WARNING: Audit log archive failed (table may be empty)"
    rm -f "$ARCHIVE_FILE"
  fi
}

# =============================================================================
# 3. Архивный дамп операционных таблиц (данные старше 6 месяцев)
# =============================================================================
do_archive_operational() {
  for TABLE in $OPERATIONAL_TABLES; do
    ARCHIVE_FILE="$BACKUP_DIR/archive/operational/${TABLE}_${DATE}.sql.gz"

    # Пробуем сделать дамп (таблица может не существовать в данной инсталляции)
    pg_dump \
      -h "$POSTGRES_HOST" \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      --format=plain \
      --no-owner \
      --no-acl \
      --table="$TABLE" 2>/dev/null \
      | gzip > "$ARCHIVE_FILE"

    if [ -s "$ARCHIVE_FILE" ]; then
      log "Archived table $TABLE: $(du -sh "$ARCHIVE_FILE" | cut -f1)"
    else
      rm -f "$ARCHIVE_FILE"
    fi
  done
}

# =============================================================================
# 4. Дамп только схемы (структура таблиц без данных)
# =============================================================================
do_schema_backup() {
  SCHEMA_FILE="$BACKUP_DIR/schema/schema_${DATE}.sql"
  log "Backing up schema → $SCHEMA_FILE"

  pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    --schema-only \
    --no-owner \
    --no-acl \
    > "$SCHEMA_FILE"

  log "Schema backup done: $(wc -l < "$SCHEMA_FILE") lines"
}

# =============================================================================
# 5. Очистка старых бэкапов
# =============================================================================
do_cleanup() {
  log "Cleaning full backups older than ${RETENTION_DAYS} days..."
  find "$BACKUP_DIR/full" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

  log "Cleaning archive backups older than ${ARCHIVE_RETENTION_DAYS} days..."
  find "$BACKUP_DIR/archive" -name "*.sql.gz" -mtime "+${ARCHIVE_RETENTION_DAYS}" -delete

  log "Cleaning schema backups older than 90 days..."
  find "$BACKUP_DIR/schema" -name "*.sql" -mtime "+90" -delete
}

# =============================================================================
# 6. Точечная очистка audit_log в БД (только если архив прошёл успешно)
#    ВНИМАНИЕ: раскомментируйте только после проверки архивов!
# =============================================================================
# do_prune_audit_log() {
#   log "Pruning audit_log records older than 90 days from DB..."
#   psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
#     -c "DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';"
# }

# =============================================================================
# Запуск: schedule (cron) или once (одноразовый)
# =============================================================================
case "${1:-once}" in
  schedule)
    log "Backup scheduler started (schedule: ${BACKUP_SCHEDULE:-0 2 * * *})"
    # Простой cron через sleep-петлю; для production используйте supercrond
    while true; do
      HOUR=$(date +%H)
      MIN=$(date +%M)
      if [ "$HOUR" = "02" ] && [ "$MIN" = "00" ]; then
        do_full_backup
        do_archive_audit_log
        do_archive_operational
        do_schema_backup
        do_cleanup
        sleep 61
      fi
      sleep 30
    done
    ;;
  once | *)
    log "=== Starting manual backup ==="
    do_full_backup
    do_archive_audit_log
    do_archive_operational
    do_schema_backup
    do_cleanup
    log "=== Backup complete ==="
    ;;
esac
