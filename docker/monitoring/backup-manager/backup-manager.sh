#!/bin/sh
# =============================================================================
# Backup Manager (runs on Server 3: Monitoring + Backup Server)
# =============================================================================
# Задачи:
#  1. Ежедневно в 03:00: синхронизировать архивные бэкапы в cold storage (rclone)
#  2. Каждое воскресенье: автоматическая проверка целостности бэкапов
#  3. Управление retention: удалять локальные архивы старше ARCHIVE_RETENTION_DAYS
# =============================================================================

BACKUP_DIR="/backups"
RCLONE_REMOTE="${RCLONE_REMOTE:-s3-cold}"
RCLONE_BUCKET="${RCLONE_BUCKET:-avfuel-backups}"
COLD_SYNC_HOUR="${COLD_STORAGE_SYNC_HOUR:-3}"
VERIFY_DAY="${BACKUP_VERIFY_DAY:-0}"      # 0=воскресенье
ARCHIVE_RETENTION="${ARCHIVE_OLDER_THAN_DAYS:-30}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-MGR] $1"; }

# =============================================================================
# 1. Синхронизация в холодное хранилище через rclone
# =============================================================================
do_cold_sync() {
  if ! command -v rclone >/dev/null 2>&1; then
    log "ПРЕДУПРЕЖДЕНИЕ: rclone не найден. Установите его или смонтируйте образ с rclone."
    return 1
  fi

  log "Синхронизация в холодное хранилище: $RCLONE_REMOTE:$RCLONE_BUCKET"

  # Синхронизируем архивные бэкапы (archive/) в холодное хранилище
  # --min-age 1d — не трогаем файлы моложе 1 дня
  rclone sync \
    "$BACKUP_DIR/" \
    "$RCLONE_REMOTE:$RCLONE_BUCKET/" \
    --min-age 1d \
    --exclude "*.tmp" \
    --log-level INFO \
    --stats 1m \
    --transfers 4

  if [ $? -eq 0 ]; then
    log "Синхронизация в cold storage завершена успешно"
  else
    log "ОШИБКА: Синхронизация в cold storage завершилась с ошибкой"
    return 1
  fi

  # Удаление локальных архивных бэкапов (оставляем только полные за последние N дней)
  log "Удаление локальных архивов старше $ARCHIVE_RETENTION дней..."
  find "$BACKUP_DIR/archive" -mtime "+$ARCHIVE_RETENTION" -name "*.gz" -delete 2>/dev/null
  find "$BACKUP_DIR/archive" -mtime "+$ARCHIVE_RETENTION" -name "*.dump.gz" -delete 2>/dev/null
  log "Очистка локальных архивов завершена"
}

# =============================================================================
# 2. Проверка целостности последнего бэкапа
# =============================================================================
do_verify_quick() {
  LAST=$(ls -t "$BACKUP_DIR/full/"*.gz 2>/dev/null | head -1)
  if [ -z "$LAST" ]; then
    log "КРИТИЧНО: Нет файлов полного бэкапа!"
    send_alert "КРИТИЧНО" "Нет файлов полного бэкапа в $BACKUP_DIR/full/"
    return 1
  fi

  AGE_H=$(( ($(date +%s) - $(stat -c %Y "$LAST")) / 3600 ))
  SIZE_KB=$(du -k "$LAST" | cut -f1)

  if [ $AGE_H -gt 25 ]; then
    log "КРИТИЧНО: Последний бэкап слишком старый — $AGE_H часов"
    send_alert "КРИТИЧНО" "Последний бэкап $AGE_H часов назад: $(basename $LAST)"
    return 1
  fi

  if [ $SIZE_KB -lt 100 ]; then
    log "КРИТИЧНО: Файл бэкапа слишком маленький — ${SIZE_KB}KB"
    send_alert "КРИТИЧНО" "Бэкап слишком маленький: $(basename $LAST) (${SIZE_KB}KB)"
    return 1
  fi

  log "Быстрая проверка: OK — возраст ${AGE_H}ч, размер $(du -sh $LAST | cut -f1)"
}

# =============================================================================
# 3. Глубокая проверка бэкапа (еженедельно, в воскресенье)
# =============================================================================
do_verify_deep() {
  log "=== Начало еженедельной проверки бэкапа ==="
  sh /verify-backup.sh
}

# =============================================================================
# 4. Отправка алерта (webhook / email через curl)
# =============================================================================
send_alert() {
  LEVEL="$1"
  MSG="$2"

  # Telegram алерт (если настроен)
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=[AvFuel] [$LEVEL] $MSG" \
      -d "parse_mode=HTML" >/dev/null 2>&1
    log "Telegram алерт отправлен: [$LEVEL] $MSG"
  fi

  # Grafana Webhook (через Alertmanager) — настраивается в Grafana UI
}

# =============================================================================
# Основной цикл планировщика
# =============================================================================
log "=== Backup Manager запущен ==="
log "  Синхронизация в cold storage: ежедневно в ${COLD_SYNC_HOUR}:00"
log "  Глубокая проверка: еженедельно в воскресенье"
log "  rclone remote: $RCLONE_REMOTE → $RCLONE_BUCKET"

while true; do
  HOUR=$(date +%H)
  WDAY=$(date +%w)   # 0=воскресенье

  # Быстрая проверка — каждые 6 часов
  MIN=$(date +%M)
  if [ "$MIN" = "00" ] && [ $((10#$HOUR % 6)) -eq 0 ]; then
    do_verify_quick
  fi

  # Синхронизация в cold storage — ежедневно
  if [ "$HOUR" = "$(printf '%02d' $COLD_SYNC_HOUR)" ] && [ "$MIN" = "00" ]; then
    do_cold_sync
    sleep 70
  fi

  # Глубокая проверка — еженедельно в воскресенье в 04:00
  if [ "$WDAY" = "$VERIFY_DAY" ] && [ "$HOUR" = "04" ] && [ "$MIN" = "00" ]; then
    do_verify_deep
    sleep 70
  fi

  sleep 30
done
