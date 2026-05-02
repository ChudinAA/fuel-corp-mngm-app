#!/bin/bash
# =============================================================================
# Aviation Fuel Management System — Quick Start Script
# =============================================================================
# Использование на сервере заказчика:
#   chmod +x scripts/quickstart.sh
#   ./scripts/quickstart.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
log_step() { echo -e "\n${YELLOW}>>> $1${NC}"; }

echo "============================================================"
echo "  Aviation Fuel Management System — Quick Start"
echo "============================================================"
echo ""

# ─── Проверка зависимостей ─────────────────────────────────────
log_step "Проверка зависимостей..."

command -v docker >/dev/null 2>&1 || log_err "Docker не найден. Установите: curl -fsSL https://get.docker.com | sudo sh"
command -v docker compose >/dev/null 2>&1 2>&1 || log_err "Docker Compose не найден. Обновите Docker до версии 24+"
command -v openssl >/dev/null 2>&1 || log_err "openssl не найден. Установите: sudo apt install openssl"

DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
log_ok "Docker: $DOCKER_VERSION"
log_ok "Docker Compose: $(docker compose version --short)"

# ─── Переключение драйвера БД ───────────────────────────────────
log_step "Переключение на стандартный PostgreSQL-драйвер..."

if [ -f "server/db.neon.ts" ]; then
  log_ok "Драйвер уже переключён (server/db.neon.ts существует)"
elif [ -f "server/db.standalone.ts" ]; then
  cp server/db.ts server/db.neon.ts
  cp server/db.standalone.ts server/db.ts
  log_ok "Драйвер переключён: server/db.ts → standalone режим"
else
  log_warn "server/db.standalone.ts не найден — используется текущий db.ts"
fi

# ─── Настройка .env ────────────────────────────────────────────
log_step "Настройка переменных окружения..."

if [ -f ".env" ]; then
  log_warn ".env уже существует. Пропускаю генерацию секретов."
else
  cp .env.example .env

  POSTGRES_PASSWORD=$(openssl rand -base64 32)
  SESSION_SECRET=$(openssl rand -base64 48)

  # Обновляем .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/CHANGE_ME_STRONG_PASSWORD_HERE/$POSTGRES_PASSWORD/" .env
    sed -i '' "s/CHANGE_ME_STRONG_SESSION_SECRET_HERE/$SESSION_SECRET/" .env
  else
    sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$POSTGRES_PASSWORD/" .env
    sed -i "s/CHANGE_ME_STRONG_SESSION_SECRET_HERE/$SESSION_SECRET/" .env
  fi

  chmod 600 .env
  log_ok ".env создан с безопасными секретами"
fi

# ─── Создание директорий ───────────────────────────────────────
log_step "Создание директорий для бэкапов..."
mkdir -p backups/full backups/archive/audit_log backups/archive/operational backups/schema
log_ok "Директории созданы: backups/"

# ─── Сборка образов ────────────────────────────────────────────
log_step "Сборка Docker образов (может занять 3-7 минут)..."
docker compose build
log_ok "Образы собраны"

# ─── Запуск БД ─────────────────────────────────────────────────
log_step "Запуск PostgreSQL..."
docker compose up -d db
echo "Ожидание готовности базы данных..."

RETRIES=30
until docker compose exec -T db pg_isready -U avfuel >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    log_err "PostgreSQL не запустился за 60 секунд. Проверьте: docker compose logs db"
  fi
  sleep 2
done
log_ok "PostgreSQL готов"

# ─── Применение схемы БД ──────────────────────────────────────
log_step "Применение схемы базы данных..."

# Проверяем, есть ли уже таблицы
TABLE_COUNT=$(docker compose exec -T db psql -U avfuel -d avfuel -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt "5" ]; then
  log_warn "В БД уже есть $TABLE_COUNT таблиц. Пропускаю применение схемы."
  log_warn "Для принудительного применения: docker compose exec app npx drizzle-kit push"
else
  log_ok "Применяем миграции из папки migrations/..."
  for SQL_FILE in migrations/[0-9]*.sql; do
    if [ -f "$SQL_FILE" ]; then
      docker compose exec -T db psql -U avfuel -d avfuel < "$SQL_FILE" >/dev/null 2>&1 || true
    fi
  done
  log_ok "Миграции применены"
fi

# ─── Запуск приложения ─────────────────────────────────────────
log_step "Запуск приложения..."
docker compose up -d
sleep 5

# ─── Проверка ─────────────────────────────────────────────────
log_step "Проверка работоспособности..."
RETRIES=15
until curl -sf http://localhost:5000/api/health >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -eq 0 ]; then
    log_err "Приложение не отвечает. Проверьте: docker compose logs app"
  fi
  sleep 3
done

HEALTH=$(curl -s http://localhost:5000/api/health)
log_ok "Приложение запущено: $HEALTH"

# ─── Итог ─────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo -e "  ${GREEN}✓ Система успешно запущена!${NC}"
echo "============================================================"
echo ""
echo "  URL:      http://$(hostname -I | awk '{print $1}'):5000"
echo "  Статус:   docker compose ps"
echo "  Логи:     docker compose logs -f app"
echo "  Бэкап:    docker compose exec backup sh /backup.sh once"
echo ""
echo "  ВАЖНО: Сохраните содержимое файла .env в безопасном месте!"
echo ""
