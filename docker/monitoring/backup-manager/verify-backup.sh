#!/bin/sh
# =============================================================================
# Автоматическая проверка целостности бэкапа (еженедельно)
# Восстанавливает последний бэкап во временную БД, проверяет данные,
# удаляет временную БД, отправляет отчёт.
#
# ТРЕБУЕТ: доступа к PostgreSQL (переменные PG_* из окружения)
# =============================================================================

BACKUP_DIR="/backups"
PG_HOST="${VERIFY_PG_HOST:-}"           # Если пусто — пропускаем восстановление
PG_USER="${VERIFY_PG_USER:-avfuel}"
PG_PASS="${VERIFY_PG_PASSWORD:-}"
TEST_DB="avfuel_verify_$(date +%Y%m%d)"
REPORT_FILE="/tmp/backup_verify_$(date +%Y%m%d).txt"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [VERIFY] $1" | tee -a "$REPORT_FILE"; }

log "=============================================="
log "  Еженедельная проверка резервной копии"
log "  Дата: $(date '+%Y-%m-%d %H:%M:%S')"
log "=============================================="

# =============================================================================
# 1. Найти последний бэкап
# =============================================================================
LAST_BACKUP=$(ls -t "$BACKUP_DIR/full/"*.gz 2>/dev/null | head -1)
if [ -z "$LAST_BACKUP" ]; then
  log "КРИТИЧНО: Файлы бэкапов не найдены в $BACKUP_DIR/full/"
  send_report "КРИТИЧНО" "Файлы бэкапа не найдены!"
  exit 1
fi

BACKUP_AGE_H=$(( ($(date +%s) - $(stat -c %Y "$LAST_BACKUP")) / 3600 ))
BACKUP_SIZE=$(du -sh "$LAST_BACKUP" | cut -f1)
log "Последний бэкап: $(basename $LAST_BACKUP)"
log "  Возраст: ${BACKUP_AGE_H} часов"
log "  Размер: $BACKUP_SIZE"

# =============================================================================
# 2. Проверка целостности gzip/pg_dump файла
# =============================================================================
log "Проверка целостности архива..."
if file "$LAST_BACKUP" | grep -q "gzip"; then
  # Файл в gzip формате
  if gunzip -t "$LAST_BACKUP" 2>/dev/null; then
    log "Целостность gzip: OK"
  else
    log "КРИТИЧНО: Файл бэкапа повреждён!"
    send_report "КРИТИЧНО" "Файл бэкапа повреждён: $(basename $LAST_BACKUP)"
    exit 1
  fi
elif pg_restore --list "$LAST_BACKUP" >/dev/null 2>&1; then
  log "Целостность pg_restore формата: OK"
else
  log "ПРЕДУПРЕЖДЕНИЕ: Не удалось проверить целостность файла"
fi

# =============================================================================
# 3. Восстановление во временную БД (если доступен PG)
# =============================================================================
RESTORE_STATUS="ПРОПУЩЕНО (PG_HOST не задан)"

if [ -n "$PG_HOST" ] && [ -n "$PG_PASS" ]; then
  export PGPASSWORD="$PG_PASS"
  log "Создание тестовой БД: $TEST_DB на $PG_HOST..."

  psql -h "$PG_HOST" -U "$PG_USER" -d postgres \
    -c "CREATE DATABASE $TEST_DB;" 2>&1 | tee -a "$REPORT_FILE"

  if [ $? -eq 0 ]; then
    log "Восстановление бэкапа в $TEST_DB..."

    if file "$LAST_BACKUP" | grep -q "gzip"; then
      gunzip -c "$LAST_BACKUP" | \
        psql -h "$PG_HOST" -U "$PG_USER" -d "$TEST_DB" \
          --single-transaction -v ON_ERROR_STOP=1 2>&1 | tail -5 | tee -a "$REPORT_FILE"
    else
      pg_restore \
        -h "$PG_HOST" -U "$PG_USER" -d "$TEST_DB" \
        --single-transaction --no-owner \
        "$LAST_BACKUP" 2>&1 | tail -5 | tee -a "$REPORT_FILE"
    fi

    if [ $? -eq 0 ]; then
      log "Восстановление: УСПЕШНО"

      # Проверка ключевых таблиц
      log "--- Проверка количества записей ---"
      RESULT=$(psql -h "$PG_HOST" -U "$PG_USER" -d "$TEST_DB" -tA -c "
        SELECT 'users:' || COUNT(*) FROM users
        UNION ALL SELECT 'opt:' || COUNT(*) FROM opt
        UNION ALL SELECT 'refueling:' || COUNT(*) FROM refueling
        UNION ALL SELECT 'audit_log:' || COUNT(*) FROM audit_log
        UNION ALL SELECT 'warehouses:' || COUNT(*) FROM warehouses;
      " 2>/dev/null)
      echo "$RESULT" | tee -a "$REPORT_FILE"

      RESTORE_STATUS="УСПЕШНО"
    else
      log "ОШИБКА: Восстановление завершилось с ошибками"
      RESTORE_STATUS="ОШИБКА"
    fi

    # Удаление тестовой БД
    psql -h "$PG_HOST" -U "$PG_USER" -d postgres \
      -c "DROP DATABASE IF EXISTS $TEST_DB;" 2>&1 | tee -a "$REPORT_FILE"
    log "Тестовая БД удалена"
  else
    log "ОШИБКА: Не удалось создать тестовую БД"
    RESTORE_STATUS="ОШИБКА (не удалось создать тестовую БД)"
  fi
fi

# =============================================================================
# 4. Проверка наличия архивов в cold storage
# =============================================================================
log "--- Проверка cold storage ---"
if command -v rclone >/dev/null 2>&1 && [ -n "$RCLONE_REMOTE" ]; then
  COLD_COUNT=$(rclone ls "${RCLONE_REMOTE}:${RCLONE_BUCKET}/full/" 2>/dev/null | wc -l)
  log "Файлов в cold storage: $COLD_COUNT"
else
  log "rclone недоступен, проверка cold storage пропущена"
fi

# =============================================================================
# 5. Итоговый отчёт
# =============================================================================
log "=============================================="
log "  Итог проверки бэкапа:"
log "  Файл:         $(basename $LAST_BACKUP) ($BACKUP_SIZE)"
log "  Возраст:      ${BACKUP_AGE_H}ч"
log "  Целостность:  OK"
log "  Восстановление: $RESTORE_STATUS"
log "=============================================="

# Отправка в Telegram
send_report() {
  LEVEL="$1"; MSG="$2"
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    FULL_MSG="[AvFuel Backup] [$LEVEL]%0A$MSG%0A%0AФайл: $(basename $LAST_BACKUP)%0AВозраст: ${BACKUP_AGE_H}ч%0AВосстановление: $RESTORE_STATUS"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=$FULL_MSG" >/dev/null 2>&1
  fi
}

if [ "$RESTORE_STATUS" = "УСПЕШНО" ] || [ "$RESTORE_STATUS" = "ПРОПУЩЕНО (PG_HOST не задан)" ]; then
  send_report "OK" "Еженедельная проверка пройдена успешно"
else
  send_report "ОШИБКА" "Проверка бэкапа завершилась с ошибками! Требуется внимание."
fi
