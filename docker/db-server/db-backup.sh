#!/bin/sh
# =============================================================================
# DB Server Local Backup Script (runs on Server 2)
# =============================================================================
# Задачи:
#  1. Локальный pg_dump на сервере БД (ежедневно в 01:00)
#  2. Отправка бэкапов на Server 3 (сервер мониторинга/бэкапов) через rsync
#  3. Очистка старых локальных бэкапов (хранить 7 дней на DB-сервере)
# =============================================================================

BACKUP_DIR="/backups"
PG_HOST="${POSTGRES_HOST:-db}"
PG_USER="${POSTGRES_USER:-avfuel}"
PG_DB="${POSTGRES_DB:-avfuel}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

# Сервер бэкапов (Server 3) — настраивается через .env
REMOTE_HOST="${BACKUP_REMOTE_HOST:-}"
REMOTE_USER="${BACKUP_REMOTE_USER:-backup}"
REMOTE_PATH="${BACKUP_REMOTE_PATH:-/backups/avfuel}"

DATETIME=$(date +%Y-%m-%d_%H-%M-%S)
DATE=$(date +%Y-%m-%d)

mkdir -p "$BACKUP_DIR/full" "$BACKUP_DIR/wal"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DB-BACKUP] $1"; }

# =============================================================================
# 1. Полный дамп базы данных
# =============================================================================
do_pg_dump() {
  OUTFILE="$BACKUP_DIR/full/avfuel_${DATETIME}.sql.gz"
  log "Начало pg_dump → $OUTFILE"

  pg_dump \
    -h "$PG_HOST" \
    -U "$PG_USER" \
    -d "$PG_DB" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    -f "$OUTFILE"

  if [ $? -eq 0 ]; then
    SIZE=$(du -sh "$OUTFILE" | cut -f1)
    log "Дамп завершён: $SIZE"
    echo "$OUTFILE"
  else
    log "ОШИБКА: pg_dump завершился с ошибкой"
    rm -f "$OUTFILE"
    return 1
  fi
}

# =============================================================================
# 2. Отправка на сервер бэкапов (Server 3) через rsync + SSH
# =============================================================================
do_rsync_to_backup_server() {
  if [ -z "$REMOTE_HOST" ]; then
    log "BACKUP_REMOTE_HOST не задан — пропуск rsync"
    return 0
  fi

  log "Отправка бэкапов на $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH ..."

  rsync -avz \
    -e "ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no -o ConnectTimeout=30" \
    "$BACKUP_DIR/full/" \
    "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/full/" \
    --exclude="*.tmp"

  if [ $? -eq 0 ]; then
    log "rsync успешно: бэкапы переданы на $REMOTE_HOST"
  else
    log "ПРЕДУПРЕЖДЕНИЕ: rsync завершился с ошибкой (проверьте SSH-ключ и доступность $REMOTE_HOST)"
  fi
}

# =============================================================================
# 3. Архивирование audit_log (выгрузка старых записей)
# =============================================================================
do_archive_audit_log() {
  ARCHIVE_DIR="$BACKUP_DIR/archive/audit_log"
  mkdir -p "$ARCHIVE_DIR"
  OUTFILE="$ARCHIVE_DIR/audit_log_archive_${DATE}.dump.gz"

  log "Архивирование audit_log (записи старше 90 дней)..."

  pg_dump \
    -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" \
    --format=custom --compress=9 \
    --no-owner --no-acl \
    --table=audit_log \
    --where="created_at < NOW() - INTERVAL '90 days'" \
    -f "$OUTFILE" 2>/dev/null

  if [ -s "$OUTFILE" ]; then
    SIZE=$(du -sh "$OUTFILE" | cut -f1)
    log "Архив audit_log: $SIZE → $OUTFILE"
    # Отправляем архив на сервер бэкапов
    if [ -n "$REMOTE_HOST" ]; then
      rsync -az \
        -e "ssh -i /root/.ssh/id_rsa -o StrictHostKeyChecking=no" \
        "$ARCHIVE_DIR/" \
        "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/archive/audit_log/" 2>/dev/null
    fi
  else
    rm -f "$OUTFILE"
    log "Нет записей audit_log старше 90 дней для архивирования"
  fi
}

# =============================================================================
# 4. Очистка локальных старых бэкапов
# =============================================================================
do_cleanup() {
  log "Удаление бэкапов старше $RETENTION_DAYS дней с локального сервера..."
  find "$BACKUP_DIR/full" -name "*.sql.gz" -o -name "*.dump.gz" | \
    xargs -I{} find {} -mtime "+$RETENTION_DAYS" -delete 2>/dev/null || true
  find "$BACKUP_DIR/full" -mtime "+$RETENTION_DAYS" -name "*.gz" -delete 2>/dev/null || true
  log "Очистка завершена"
}

# =============================================================================
# Запуск
# =============================================================================
do_run() {
  log "=== Запуск цикла бэкапа ==="
  do_pg_dump && do_rsync_to_backup_server
  do_archive_audit_log
  do_cleanup
  log "=== Бэкап завершён ==="
}

case "${1:-once}" in
  schedule)
    log "Планировщик запущен (ежедневно в 01:00)"
    while true; do
      HOUR=$(date +%H); MIN=$(date +%M)
      if [ "$HOUR" = "01" ] && [ "$MIN" = "00" ]; then
        do_run
        sleep 70   # не запустится дважды за одну минуту
      fi
      sleep 30
    done
    ;;
  once|*)
    do_run
    ;;
esac
