# Руководство по развёртыванию на серверах заказчика

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Содержание

1. [Требования к оборудованию и ПО](#1-требования)
2. [Архитектура развёртывания](#2-архитектура)
3. [Переключение драйвера базы данных](#3-драйвер-бд)
4. [Экспорт приложения из Replit](#4-экспорт-из-replit)
5. [Установка Docker на сервере заказчика](#5-установка-docker)
6. [Настройка секретов и переменных окружения](#6-секреты)
7. [Сборка и запуск через Docker Compose](#7-запуск)
8. [Применение схемы базы данных](#8-схема-бд)
9. [Открытые порты и сетевые настройки](#9-порты)
10. [Перенос данных из Neon (Replit) → самохостинг](#10-перенос-данных)
11. [Reverse Proxy (Nginx)](#11-nginx)
12. [Мониторинг](#12-мониторинг)
13. [Обновление приложения](#13-обновление)
14. [Откат версии](#14-откат)

---

## 1. Требования

### Минимальные требования (до 10 активных пользователей)

| Компонент | Минимум |
|-----------|---------|
| CPU | 2 vCPU / 2 физических ядра |
| RAM | 4 ГБ |
| Диск (SSD) | 50 ГБ |
| ОС | Ubuntu 22.04 LTS / Debian 12 / CentOS Stream 9 |
| Docker | 24.x или новее |
| Docker Compose | v2.20 или новее |
| Открытый порт | 80, 443 (HTTPS) или кастомный |

### Рекомендуемые требования (10–50 пользователей)

| Компонент | Рекомендация |
|-----------|-------------|
| CPU | 4 vCPU |
| RAM | 8 ГБ |
| Диск (SSD NVMe) | 100 ГБ |
| Сеть | 100 Мбит/с |
| Резервирование | RAID-1 или репликация |

### Требования к ПО

| ПО | Версия | Обязательно |
|----|--------|-------------|
| Docker Engine | ≥ 24.0 | ✅ |
| Docker Compose plugin | ≥ 2.20 | ✅ |
| Git | любая | рекомендуется |
| openssl | любая | для генерации секретов |
| Nginx / Caddy | любая | рекомендуется (reverse proxy) |
| certbot | любая | для HTTPS (Let's Encrypt) |

---

## 2. Архитектура развёртывания

```
                    Интернет / ЛВС заказчика
                            │
                     [80/443 TCP]
                            │
                    ┌───────▼───────┐
                    │   Nginx / Caddy│  ← Reverse proxy + TLS
                    │   (хост)       │
                    └───────┬───────┘
                            │ http://localhost:5000
                    ┌───────▼───────┐
                    │  avfuel_app   │  ← Node.js (Express + React)
                    │  port 5000    │     Docker контейнер
                    └───────┬───────┘
                            │ TCP 5432 (внутренняя сеть Docker)
                    ┌───────▼───────┐
                    │   avfuel_db   │  ← PostgreSQL 16
                    │  (внутренний) │     Docker контейнер
                    └───────────────┘
                            │
                    ┌───────▼───────┐
                    │  avfuel_backup│  ← Cron бэкапы
                    │  (cron)       │     Docker контейнер
                    └───────────────┘
```

**Важно:** PostgreSQL НЕ открывается на внешние порты — доступен только внутри Docker-сети `backend`.

---

## 3. Переключение драйвера базы данных

> **Это обязательный шаг.** В Replit используется Neon Serverless PostgreSQL через WebSocket.  
> На серверах заказчика нужен стандартный PostgreSQL-драйвер (TCP).

В репозитории уже подготовлен альтернативный файл `server/db.standalone.ts`.

Выполните на своей машине (или в CI/CD перед сборкой Docker образа):

```bash
# Сохраняем оригинальный Neon-драйвер
cp server/db.ts server/db.neon.ts

# Активируем стандартный PostgreSQL-драйвер
cp server/db.standalone.ts server/db.ts
```

Убедитесь, что пакет `pg` установлен (он уже есть в зависимостях как транзитивная зависимость):

```bash
# Проверка
node -e "require('pg')" 2>/dev/null && echo "pg OK" || echo "pg not found"
```

---

## 4. Экспорт приложения из Replit

### Вариант A — через Git (рекомендуется)

1. В Replit: **Git → Connect to GitHub** → создайте/привяжите репозиторий
2. Сделайте `git push` из Replit (или используйте автоматический коммит агента)
3. На сервере заказчика:

```bash
git clone https://github.com/your-org/your-repo.git avfuel
cd avfuel
```

### Вариант B — через ZIP-архив

1. В Replit: **⋮ → Download as ZIP**
2. Перенесите архив на сервер:

```bash
scp avfuel.zip user@server:/opt/
ssh user@server
cd /opt && unzip avfuel.zip && mv repl-name avfuel && cd avfuel
```

---

## 5. Установка Docker на сервере заказчика

### Ubuntu / Debian

```bash
# Удалить старые версии (если есть)
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# Установить официальный Docker
curl -fsSL https://get.docker.com | sudo sh

# Добавить текущего пользователя в группу docker
sudo usermod -aG docker $USER
newgrp docker

# Проверить
docker --version
docker compose version
```

### CentOS / RHEL 8+

```bash
sudo dnf install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

---

## 6. Настройка секретов и переменных окружения

**Никогда не храните секреты в Git-репозитории!**

```bash
# 1. Перейти в директорию проекта
cd /opt/avfuel

# 2. Скопировать шаблон
cp .env.example .env

# 3. Сгенерировать безопасные секреты
POSTGRES_PASSWORD=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 48)

# 4. Записать в .env
sed -i "s/CHANGE_ME_STRONG_PASSWORD_HERE/$POSTGRES_PASSWORD/" .env
sed -i "s/CHANGE_ME_STRONG_SESSION_SECRET_HERE/$SESSION_SECRET/" .env

# 5. Защитить файл (только владелец может читать)
chmod 600 .env

# 6. Проверить
cat .env
```

### Что содержит .env

| Переменная | Описание | Обязательно |
|------------|----------|-------------|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | ✅ |
| `POSTGRES_USER` | Пользователь БД (default: avfuel) | ✅ |
| `POSTGRES_DB` | Имя базы данных (default: avfuel) | ✅ |
| `SESSION_SECRET` | Секрет для подписи сессий | ✅ |
| `APP_PORT` | Внешний порт приложения (default: 5000) | нет |
| `DEBUG_NETWORK` | Логировать все HTTP запросы (default: false) | нет |
| `BACKUP_RETENTION_DAYS` | Хранить полные бэкапы N дней (default: 30) | нет |

---

## 7. Сборка и запуск через Docker Compose

```bash
cd /opt/avfuel

# Переключить драйвер БД (выполнить один раз)
cp server/db.standalone.ts server/db.ts

# Собрать образы (займёт 3–7 минут при первом запуске)
docker compose build

# Запустить все сервисы в фоновом режиме
docker compose up -d

# Проверить статус
docker compose ps

# Следить за логами
docker compose logs -f app

# Проверить health check
curl http://localhost:5000/api/health
```

### Ожидаемый вывод `docker compose ps`

```
NAME              IMAGE         STATUS
avfuel_db         postgres:16   Up (healthy)
avfuel_app        avfuel_app    Up (healthy)
avfuel_backup     postgres:16   Up
```

---

## 8. Применение схемы базы данных

После первого запуска или при обновлении схемы:

### Вариант A — через Drizzle Push (рекомендуется при первом развёртывании)

```bash
# Подключаемся к контейнеру приложения и применяем схему
docker compose exec app sh -c \
  "DATABASE_URL=postgresql://\$POSTGRES_USER:\$POSTGRES_PASSWORD@db:5432/\$POSTGRES_DB \
   npx drizzle-kit push"
```

### Вариант B — применение конкретной миграции

```bash
# Список миграций в папке migrations/
ls migrations/*.sql | sort

# Применить конкретный SQL файл
docker compose exec -T db psql \
  -U avfuel -d avfuel \
  < migrations/0066_decimal_precision_storage_cost_and_cost_per_kg.sql
```

### Вариант C — применить все миграции по порядку

```bash
# Скрипт для последовательного применения всех SQL миграций
for f in migrations/[0-9]*.sql; do
  echo "Applying: $f"
  docker compose exec -T db psql -U avfuel -d avfuel < "$f"
done
```

---

## 9. Открытые порты и сетевые настройки

### Порты Docker

| Сервис | Внутренний порт | Внешний порт | Доступен снаружи |
|--------|----------------|-------------|-----------------|
| `app` (Node.js) | 5000 | `APP_PORT` (default 5000) | ✅ |
| `db` (PostgreSQL) | 5432 | 127.0.0.1:5432 | ❌ только localhost |

### Firewall (UFW / iptables)

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
# sudo ufw allow 5000/tcp  # только если нет nginx
sudo ufw enable
sudo ufw status
```

---

## 10. Перенос данных из Neon (Replit) → самохостинг

### Шаг 1: Дамп из Neon

В Replit получите `DATABASE_URL` из секретов и выполните локально:

```bash
# Установите pg_dump (если нет): sudo apt install postgresql-client
pg_dump \
  "postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require" \
  --no-owner \
  --no-acl \
  --format=plain \
  -f neon_export.sql

# Проверить размер дампа
wc -l neon_export.sql
```

### Шаг 2: Перенос дампа на сервер

```bash
scp neon_export.sql user@your-server:/opt/avfuel/
```

### Шаг 3: Восстановление в Docker PostgreSQL

```bash
cd /opt/avfuel

# Убедитесь, что контейнеры запущены (кроме app — он может не стартовать до применения схемы)
docker compose up -d db

# Ждём готовности PostgreSQL
docker compose exec db pg_isready -U avfuel

# Применяем дамп
docker compose exec -T db psql -U avfuel -d avfuel < neon_export.sql

echo "Проверка количества таблиц:"
docker compose exec db psql -U avfuel -d avfuel \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

### Шаг 4: Запускаем приложение

```bash
docker compose up -d
docker compose logs -f app
```

---

## 11. Reverse Proxy (Nginx)

### Установка Nginx

```bash
sudo apt install -y nginx
```

### Конфигурация `/etc/nginx/sites-available/avfuel`

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Редирект на HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Увеличенный таймаут для SSE (Server-Sent Events)
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    location / {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # SSE: отключить буферизацию
        proxy_buffering    off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/avfuel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS через Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Автообновление сертификата уже настраивается certbot автоматически
```

---

## 12. Мониторинг

### Встроенный health check

```bash
# Статус всех контейнеров
docker compose ps

# Проверка health endpoint
curl -s http://localhost:5000/api/health | python3 -m json.tool

# Логи приложения (последние 100 строк)
docker compose logs --tail=100 app

# Следить за логами в реальном времени
docker compose logs -f app

# Использование ресурсов
docker stats avfuel_app avfuel_db
```

### Мониторинг размера БД

```bash
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS data_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
"
```

### Топ медленных запросов (если включён pg_stat_statements)

```bash
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
"
```

---

## 13. Обновление приложения

```bash
cd /opt/avfuel

# 1. Получить свежий код
git pull origin main

# 2. Остановить приложение (БД остаётся запущенной)
docker compose stop app

# 3. Пересобрать образ
docker compose build app

# 4. Применить новые миграции (если есть)
# Проверьте последнюю миграцию в migrations/
ls -1 migrations/*.sql | tail -5

# 5. Запустить обновлённое приложение
docker compose up -d app

# 6. Проверить логи
docker compose logs -f app
```

---

## 14. Откат версии

```bash
cd /opt/avfuel

# Остановить приложение
docker compose stop app

# Вернуть предыдущую версию кода
git log --oneline -10
git checkout <commit-hash>

# Пересобрать
docker compose build app
docker compose up -d app
```

---

## Автозапуск при перезагрузке сервера

Docker Compose с `restart: unless-stopped` автоматически перезапускает контейнеры.  
Для автозапуска при старте системы убедитесь, что Docker-демон настроен:

```bash
sudo systemctl enable docker
sudo systemctl status docker
```
