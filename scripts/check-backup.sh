#!/bin/bash
# =============================================================================
# Проверка состояния бэкапов (можно запускать через cron или мониторинг)
# =============================================================================
# Использование:
#   ./scripts/check-backup.sh
#   Код возврата: 0 = OK, 1 = WARN, 2 = CRITICAL
# =============================================================================

BACKUP_DIR="${BACKUP_DIR:-./backups}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-25}"  # алерт если бэкап старше N часов
MIN_SIZE_KB="${MIN_SIZE_KB:-100}"     # алерт если файл меньше N КБ

STATUS=0

check_backup_age() {
  local DIR="$BACKUP_DIR/full"
  local LAST=$(ls -t "$DIR"/*.sql.gz 2>/dev/null | head -1)

  if [ -z "$LAST" ]; then
    echo "CRITICAL: Нет файлов бэкапа в $DIR"
    STATUS=2
    return
  fi

  local AGE=$(( ($(date +%s) - $(stat -c %Y "$LAST")) / 3600 ))
  local SIZE_KB=$(du -k "$LAST" | cut -f1)
  local SIZE_HR=$(du -sh "$LAST" | cut -f1)

  if [ $AGE -gt $MAX_AGE_HOURS ]; then
    echo "CRITICAL: Последний бэкап ${AGE}ч назад (> ${MAX_AGE_HOURS}ч): $LAST"
    STATUS=2
  elif [ $SIZE_KB -lt $MIN_SIZE_KB ]; then
    echo "WARN: Бэкап слишком маленький ($SIZE_HR): $LAST"
    STATUS=1
  else
    echo "OK: Последний бэкап ${AGE}ч назад, размер: $SIZE_HR"
    echo "    Файл: $(basename "$LAST")"
  fi
}

check_backup_integrity() {
  local LAST=$(ls -t "$BACKUP_DIR/full"/*.sql.gz 2>/dev/null | head -1)
  if [ -z "$LAST" ]; then return; fi

  if gunzip -t "$LAST" 2>/dev/null; then
    echo "OK: Целостность gzip проверена: $(basename "$LAST")"
  else
    echo "CRITICAL: Файл бэкапа ПОВРЕЖДЁН: $LAST"
    STATUS=2
  fi
}

check_disk_space() {
  local AVAILABLE=$(df -BG "$BACKUP_DIR" | tail -1 | awk '{print $4}' | sed 's/G//')
  if [ "$AVAILABLE" -lt 5 ]; then
    echo "CRITICAL: Свободного места < 5 ГБ на диске бэкапов: ${AVAILABLE}ГБ"
    STATUS=2
  elif [ "$AVAILABLE" -lt 20 ]; then
    echo "WARN: Мало свободного места: ${AVAILABLE}ГБ доступно"
    STATUS=1
  else
    echo "OK: Свободное место: ${AVAILABLE}ГБ"
  fi
}

check_backup_count() {
  local COUNT=$(ls "$BACKUP_DIR/full"/*.sql.gz 2>/dev/null | wc -l)
  echo "INFO: Полных бэкапов в хранилище: $COUNT"
  echo "INFO: Размер директории: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
}

echo "=== Проверка резервных копий: $(date) ==="
check_backup_age
check_backup_integrity
check_disk_space
check_backup_count
echo "========================================"

exit $STATUS
