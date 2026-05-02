#!/bin/bash
# =============================================================================
# Экспорт данных из Neon PostgreSQL (Replit) в SQL-дамп
# =============================================================================
# Использование:
#   NEON_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
#   ./scripts/export-from-neon.sh
# =============================================================================

set -e

NEON_URL="${NEON_DATABASE_URL:-$DATABASE_URL}"
OUTPUT_FILE="${OUTPUT_FILE:-neon_export_$(date +%Y%m%d_%H%M%S).sql.gz}"

if [ -z "$NEON_URL" ]; then
  echo "ERROR: Укажите NEON_DATABASE_URL или DATABASE_URL"
  echo "Пример:"
  echo "  NEON_DATABASE_URL='postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require' \\"
  echo "  ./scripts/export-from-neon.sh"
  exit 1
fi

echo "Подключение к Neon PostgreSQL..."
echo "Выходной файл: $OUTPUT_FILE"

# Полный дамп с сжатием
pg_dump \
  "$NEON_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --exclude-table=session \
  | gzip -9 > "$OUTPUT_FILE"

SIZE=$(du -sh "$OUTPUT_FILE" | cut -f1)
echo "Экспорт завершён: $OUTPUT_FILE ($SIZE)"
echo ""
echo "Следующий шаг: скопируйте файл на сервер заказчика и выполните:"
echo "  scp $OUTPUT_FILE user@your-server:/opt/avfuel/"
echo "  ssh user@your-server"
echo "  cd /opt/avfuel"
echo "  gunzip -c $OUTPUT_FILE | docker compose exec -T db psql -U avfuel -d avfuel"
