# Руководство по развёртыванию: Production (3 сервера)

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Содержание

1. [Архитектура production-среды](#1-архитектура)
2. [Сравнение: тестовое vs production-развёртывание](#2-сравнение)
3. [Подготовка: что нужно до начала](#3-подготовка)
4. [Server 2 — База данных](#4-server-2--база-данных)
5. [Server 1 — Приложение](#5-server-1--приложение)
6. [Server 3 — Мониторинг и бэкапы](#6-server-3--мониторинг-и-бэкапы)
7. [SSH-ключи между серверами](#7-ssh-ключи)
8. [Настройка холодного хранилища (rclone)](#8-холодное-хранилище)
9. [Проверка всей системы](#9-проверка)
10. [Обновление приложения](#10-обновление)

---

## 1. Архитектура

```
╔══════════════════════╗     ╔══════════════════════╗     ╔══════════════════════╗
║   SERVER 1 (App)     ║     ║   SERVER 2 (DB)      ║     ║  SERVER 3 (Mon+Bkp)  ║
║                      ║     ║                      ║     ║                      ║
║  ┌────────────────┐  ║     ║  ┌────────────────┐  ║     ║  ┌────────────────┐  ║
║  │  Nginx (HTTPS) │  ║     ║  │  PostgreSQL 16 │  ║     ║  │  Uptime Kuma   │  ║
║  └───────┬────────┘  ║     ║  └───────▲────────┘  ║     ║  │  :3001         │  ║
║  ┌───────▼────────┐  ║     ║  ┌───────┴────────┐  ║     ║  ├────────────────┤  ║
║  │  avfuel_app    │──╫─────╫─▶│  DB :5432      │  ║     ║  │  Prometheus    │  ║
║  │  :5000         │  ║     ║  ├────────────────┤  ║     ║  │  :9090         │  ║
║  └────────────────┘  ║     ║  │ pg_exporter    │──╫─────╫─▶│  (scrape)      │  ║
║  ┌────────────────┐  ║     ║  │ :9187          │  ║     ║  ├────────────────┤  ║
║  │ node_exporter  │──╫─────╫──╫───────────────▶│  ║     ║  │  Grafana       │  ║
║  │ :9100          │  ║     ║  │ node_exporter  │──╫─────╫─▶│  :3000         │  ║
║  └────────────────┘  ║     ║  │ :9100          │  ║     ║  ├────────────────┤  ║
╚══════════════════════╝     ║  ├────────────────┤  ║     ║  │ Alertmanager   │  ║
         │                   ║  │ db_backup cron │──╫─────╫─▶│ Telegram/Email │  ║
    Пользователи             ║  │ pg_dump @ 01:00│  ║     ║  ├────────────────┤  ║
  (браузер, HTTPS)           ║  └────────────────┘  ║     ║  │ backup_manager │  ║
                             ╚══════════════════════╝     ║  │ rclone → S3    │  ║
                                       │                   ║  └────────────────┘  ║
                                  rsync (SSH)              ║  /backups/avfuel/    ║
                                       └──────────────────▶║                      ║
                                                           ╚══════════════╤═══════╝
                                                                          │ rclone
                                                                          ▼
                                                              ┌───────────────────┐
                                                              │  Cold Storage      │
                                                              │  (S3/B2/MinIO/YC)  │
                                                              │  Lifecycle: авто   │
                                                              └───────────────────┘
```

### Потоки данных

| Поток | Откуда | Куда | Протокол |
|-------|--------|------|----------|
| Запросы пользователей | Интернет | Server 1:443 | HTTPS |
| SQL-запросы | Server 1 | Server 2:5432 | TCP (PostgreSQL) |
| Метрики хоста | Server 1:9100, Server 2:9100 | Server 3 | HTTP (Prometheus scrape) |
| Метрики PostgreSQL | Server 2:9187 | Server 3 | HTTP (Prometheus scrape) |
| Ежедневный бэкап | Server 2 | Server 3:22 | rsync/SSH |
| Архивирование | Server 3 | Cold Storage | HTTPS (rclone) |
| Алерты | Server 3 | Telegram/Email | HTTPS |

---

## 2. Сравнение: тестовое vs production-развёртывание

| Параметр | Тестовое (1 сервер) | Production (3 сервера) |
|----------|---------------------|----------------------|
| Файл | `docker-compose.yml` | `docker-compose.prod-*.yml` |
| Где БД | Тот же сервер | Отдельный Server 2 |
| Отказоустойчивость | Нет | Частичная (БД независима) |
| Бэкапы | На том же диске | Server 3 + cold storage |
| Мониторинг | Только Docker healthcheck | Uptime Kuma + Prometheus + Grafana |
| Алерты | Нет | Telegram + email |
| Сложность настройки | Низкая (~30 мин) | Средняя (~3-4 часа) |
| Рекомендуется для | Тест, демо | Рабочая эксплуатация |

---

## 3. Подготовка

### Что нужно до начала работы

- [ ] 3 VPS/сервера (см. требования в `docs/REQUIREMENTS.md`)
- [ ] IP-адреса всех трёх серверов
- [ ] SSH-доступ к каждому серверу
- [ ] Домен (для HTTPS) или IP для прямого доступа
- [ ] Аккаунт у провайдера холодного хранилища (AWS S3, Yandex Cloud, Backblaze B2 или MinIO)
- [ ] Telegram-бот (создать у @BotFather) для алертов

### Переменные, которые понадобятся

Запишите сразу:

```
APP_SERVER_IP   = ___.___.___.___ (Server 1)
DB_SERVER_IP    = ___.___.___.___ (Server 2)
MON_SERVER_IP   = ___.___.___.___ (Server 3)
YOUR_DOMAIN     = app.company.com

POSTGRES_PASSWORD = (сгенерировать: openssl rand -base64 32)
SESSION_SECRET    = (сгенерировать: openssl rand -base64 48)
GRAFANA_PASSWORD  = (сгенерировать: openssl rand -base64 24)
TELEGRAM_BOT_TOKEN = ...
TELEGRAM_CHAT_ID   = ...
```

### Установка Docker на каждом сервере

Выполните на каждом из 3 серверов:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version   # проверка
```

---

## 4. Server 2 — База данных

> Начинаем с БД, т.к. приложение зависит от неё.

### 4.1 Подготовка сервера

```bash
# Зайти на Server 2
ssh user@DB_SERVER_IP

# Создать рабочую директорию
sudo mkdir -p /opt/avfuel-db
sudo chown $USER:$USER /opt/avfuel-db
cd /opt/avfuel-db
```

### 4.2 Скопировать файлы на Server 2

На вашей машине (или из Replit):

```bash
# Скопировать нужные файлы
scp docker-compose.prod-db.yml         user@DB_SERVER_IP:/opt/avfuel-db/
scp .env.prod-db.example               user@DB_SERVER_IP:/opt/avfuel-db/
scp -r docker/postgres/                user@DB_SERVER_IP:/opt/avfuel-db/docker/
scp -r docker/db-server/               user@DB_SERVER_IP:/opt/avfuel-db/docker/
scp -r migrations/                     user@DB_SERVER_IP:/opt/avfuel-db/
```

### 4.3 Настроить переменные окружения

```bash
# На Server 2:
cd /opt/avfuel-db
cp .env.prod-db.example .env
chmod 600 .env
nano .env
```

Заполнить в .env:
```
POSTGRES_PASSWORD=<ваш случайный пароль>
BACKUP_REMOTE_HOST=MON_SERVER_IP     # IP Server 3
BACKUP_REMOTE_USER=backup
BACKUP_REMOTE_PATH=/backups/avfuel
SSH_KEY_PATH=./docker/db-server/id_rsa
```

### 4.4 Сгенерировать SSH-ключ для rsync → Server 3

```bash
# На Server 2:
mkdir -p /opt/avfuel-db/docker/db-server
ssh-keygen -t ed25519 \
  -f /opt/avfuel-db/docker/db-server/id_rsa \
  -N "" \
  -C "avfuel-db-backup@$(hostname)"

echo "Публичный ключ (добавить на Server 3 в authorized_keys):"
cat /opt/avfuel-db/docker/db-server/id_rsa.pub
# СОХРАНИТЕ этот ключ — он понадобится на шаге настройки Server 3
```

### 4.5 Создать директории

```bash
mkdir -p /opt/avfuel-db/backups/full /opt/avfuel-db/backups/archive/audit_log
```

### 4.6 Запустить PostgreSQL

```bash
cd /opt/avfuel-db

# Запустить только БД и экспортёр метрик (без backup — SSH-ключ ещё не прописан на Server 3)
docker compose -f docker-compose.prod-db.yml up -d db postgres_exporter

# Проверить
docker compose -f docker-compose.prod-db.yml ps
docker compose -f docker-compose.prod-db.yml exec db pg_isready -U avfuel
```

### 4.7 Применить схему базы данных

```bash
# Применить все миграции по порядку
for f in /opt/avfuel-db/migrations/[0-9]*.sql; do
  echo "Applying: $(basename $f)"
  docker compose -f docker-compose.prod-db.yml exec -T db \
    psql -U avfuel -d avfuel < "$f"
done

# Проверить количество таблиц
docker compose -f docker-compose.prod-db.yml exec db \
  psql -U avfuel -d avfuel \
  -c "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='public';"
# Ожидаемый результат: 40+ таблиц
```

### 4.8 (Опционально) Перенести данные из Neon (Replit)

```bash
# Экспорт из Neon (выполнять на машине с доступом к Neon):
# NEON_DATABASE_URL="postgresql://..." ./scripts/export-from-neon.sh

# Скопировать дамп на Server 2
scp neon_export_*.sql.gz user@DB_SERVER_IP:/opt/avfuel-db/

# Восстановить на Server 2:
cd /opt/avfuel-db
gunzip -c neon_export_*.sql.gz | \
  docker compose -f docker-compose.prod-db.yml exec -T db \
    psql -U avfuel -d avfuel
```

### 4.9 Настроить firewall на Server 2

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                                    # SSH (администратор)
sudo ufw allow from APP_SERVER_IP to any port 5432       # PostgreSQL только с App Server
sudo ufw allow from MON_SERVER_IP to any port 9187       # pg_exporter только с Monitoring
sudo ufw allow from MON_SERVER_IP to any port 9100       # node_exporter только с Monitoring
sudo ufw enable
sudo ufw status
```

### 4.10 Установить Node Exporter на Server 2

```bash
# На Server 2:
MON_SERVER_IP=<IP Server 3> ./scripts/setup-node-exporter.sh
```

---

## 5. Server 1 — Приложение

### 5.1 Подготовка и переключение драйвера БД

```bash
# Зайти на Server 1
ssh user@APP_SERVER_IP

# Клонировать или скопировать репозиторий
git clone https://github.com/your-org/avfuel.git /opt/avfuel
cd /opt/avfuel

# ОБЯЗАТЕЛЬНО: переключить на стандартный PostgreSQL-драйвер
cp server/db.ts server/db.neon.ts
cp server/db.standalone.ts server/db.ts
```

### 5.2 Настроить переменные окружения

```bash
cp .env.prod-app.example .env
chmod 600 .env
nano .env
```

Заполнить в .env:
```
DATABASE_URL=postgresql://avfuel:POSTGRES_PASSWORD@DB_SERVER_IP:5432/avfuel
SESSION_SECRET=<ваш случайный секрет>
```

### 5.3 Проверить подключение к БД

```bash
# Проверить, что Server 1 видит PostgreSQL на Server 2
docker run --rm postgres:16-alpine \
  pg_isready -h DB_SERVER_IP -U avfuel -d avfuel
# Ожидаемый ответ: "DB_SERVER_IP:5432 - accepting connections"
```

### 5.4 Собрать и запустить приложение

```bash
cd /opt/avfuel

# Сборка образа
docker compose -f docker-compose.prod-app.yml build

# Запуск
docker compose -f docker-compose.prod-app.yml up -d

# Проверка
curl http://localhost:5000/api/health
# Ожидаемый ответ: {"status":"ok","timestamp":"..."}

# Логи
docker compose -f docker-compose.prod-app.yml logs --tail=50 app
```

### 5.5 Настроить Nginx + HTTPS

```bash
# Установить Nginx и certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Скопировать конфигурацию
sudo cp docker/nginx/nginx.conf /etc/nginx/sites-available/avfuel

# Заменить YOUR_DOMAIN_HERE на реальный домен
sudo sed -i 's/YOUR_DOMAIN_HERE/your-domain.com/g' /etc/nginx/sites-available/avfuel

# Активировать конфиг
sudo ln -sf /etc/nginx/sites-available/avfuel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t   # проверка синтаксиса

# Для первого запуска certbot нужен HTTP (без SSL)
# Временно уберите SSL-секцию или используйте --standalone
sudo certbot --nginx -d your-domain.com --email admin@company.com --agree-tos

# Перезагрузить Nginx
sudo systemctl reload nginx

# Проверить
curl -I https://your-domain.com/api/health
```

### 5.6 Настроить firewall на Server 1

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                                    # SSH
sudo ufw allow 80/tcp                                    # HTTP → HTTPS редирект
sudo ufw allow 443/tcp                                   # HTTPS
sudo ufw allow from MON_SERVER_IP to any port 9100       # node_exporter
# НЕ открывайте порт 5000 — только localhost через Nginx
sudo ufw enable
```

### 5.7 Установить Node Exporter на Server 1

```bash
MON_SERVER_IP=<IP Server 3> ./scripts/setup-node-exporter.sh
```

---

## 6. Server 3 — Мониторинг и бэкапы

### 6.1 Подготовка

```bash
ssh user@MON_SERVER_IP

# Создать пользователя для приёма бэкапов (rsync)
sudo useradd -m -s /bin/bash backup
sudo mkdir -p /home/backup/.ssh
sudo chmod 700 /home/backup/.ssh

# Создать директорию для бэкапов
sudo mkdir -p /backups/avfuel/full /backups/avfuel/archive/audit_log /backups/avfuel/archive/operational
sudo chown -R backup:backup /backups

# Рабочая директория мониторинга
sudo mkdir -p /opt/avfuel-monitoring
sudo chown $USER:$USER /opt/avfuel-monitoring
cd /opt/avfuel-monitoring
```

### 6.2 Скопировать файлы на Server 3

```bash
# С вашей машины:
scp docker-compose.prod-monitoring.yml       user@MON_SERVER_IP:/opt/avfuel-monitoring/
scp .env.prod-monitoring.example             user@MON_SERVER_IP:/opt/avfuel-monitoring/
scp -r docker/monitoring/                    user@MON_SERVER_IP:/opt/avfuel-monitoring/docker/
```

### 6.3 Прописать SSH-ключ Server 2 в authorized_keys

```bash
# На Server 3 — добавить публичный ключ, сгенерированный на Server 2 (шаг 4.4)
PUBLIC_KEY="ssh-ed25519 AAAA... avfuel-db-backup@server2"
echo "$PUBLIC_KEY" | sudo tee -a /home/backup/.ssh/authorized_keys
sudo chmod 600 /home/backup/.ssh/authorized_keys
sudo chown backup:backup /home/backup/.ssh/authorized_keys

# Проверить SSH с Server 2 (выполнить на Server 2):
ssh -i /opt/avfuel-db/docker/db-server/id_rsa backup@MON_SERVER_IP "echo OK"
# Ожидаемый ответ: OK
```

### 6.4 Настроить переменные окружения

```bash
cd /opt/avfuel-monitoring
cp .env.prod-monitoring.example .env
chmod 600 .env
nano .env
```

Заполнить:
```
APP_SERVER_IP=<IP Server 1>
DB_SERVER_IP=<IP Server 2>
GRAFANA_PASSWORD=<случайный>
TELEGRAM_BOT_TOKEN=<токен бота>
TELEGRAM_CHAT_ID=<chat_id>
RCLONE_REMOTE=s3-cold
RCLONE_BUCKET=avfuel-backups
```

### 6.5 Настроить Prometheus targets

```bash
# Заменить IP-адреса серверов в prometheus.yml
nano /opt/avfuel-monitoring/docker/monitoring/prometheus/prometheus.yml

# Заменить:
#   ${APP_SERVER_IP} → реальный IP Server 1
#   ${DB_SERVER_IP}  → реальный IP Server 2
```

### 6.6 Настроить Alertmanager (Telegram)

```bash
nano /opt/avfuel-monitoring/docker/monitoring/alertmanager/alertmanager.yml

# Заменить:
#   ${TELEGRAM_BOT_TOKEN} → токен вашего бота
#   ${TELEGRAM_CHAT_ID}   → chat_id
```

### 6.7 Настроить rclone (холодное хранилище)

```bash
cd /opt/avfuel-monitoring

# Создать конфиг из шаблона
cp docker/monitoring/rclone/rclone.conf.example \
   docker/monitoring/rclone/rclone.conf

# Заполнить данные вашего провайдера
nano docker/monitoring/rclone/rclone.conf
```

**Тест rclone** (после запуска контейнеров):

```bash
docker compose exec backup_manager \
  rclone lsd s3-cold:avfuel-backups/
# Ожидаемый результат: список директорий (пустой при первом запуске)
```

### 6.8 Запустить все сервисы мониторинга

```bash
cd /opt/avfuel-monitoring

docker compose -f docker-compose.prod-monitoring.yml up -d

# Проверить статус
docker compose -f docker-compose.prod-monitoring.yml ps

# Логи
docker compose -f docker-compose.prod-monitoring.yml logs --tail=50
```

### 6.9 Настройка Uptime Kuma

1. Открыть: `http://MON_SERVER_IP:3001`
2. Создать аккаунт (при первом входе)
3. **Settings → Notifications → Add**:
   - Telegram: ввести Bot Token и Chat ID → Test → Save
4. **+ Add Monitor** (App):
   - Type: `HTTP(s)` | URL: `https://your-domain.com/api/health`
   - Interval: 60s | Notification: выбрать Telegram → Save
5. **+ Add Monitor** (DB):
   - Type: `TCP Port` | Host: `DB_SERVER_IP` | Port: `5432`
   - Interval: 60s → Save

### 6.10 Запустить db_backup на Server 2

После успешной настройки Server 3:

```bash
# На Server 2: запустить контейнер бэкапов
cd /opt/avfuel-db
docker compose -f docker-compose.prod-db.yml up -d db_backup

# Тест: ручной запуск бэкапа
docker compose -f docker-compose.prod-db.yml exec db_backup sh /db-backup.sh once

# Проверить на Server 3: файл должен появиться
ls -lh /backups/avfuel/full/
```

### 6.11 Настроить firewall на Server 3

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                                    # SSH (DB Server rsync + Admin)
sudo ufw allow from ADMIN_IP to any port 3000            # Grafana (только Admin)
sudo ufw allow from ADMIN_IP to any port 3001            # Uptime Kuma (только Admin)
# Порты Prometheus (9090), Alertmanager (9093) — только localhost
sudo ufw enable
```

---

## 7. SSH-ключи между серверами

### Схема SSH-авторизации

```
Server 2 (DB)  ──rsync/SSH──▶  Server 3 (Monitoring)
               Ключ: /opt/avfuel-db/docker/db-server/id_rsa
               Авт.: /home/backup/.ssh/authorized_keys на Server 3
```

### Генерация ключей (если ещё не сделано)

```bash
# На Server 2:
ssh-keygen -t ed25519 \
  -f /opt/avfuel-db/docker/db-server/id_rsa \
  -N "" \
  -C "avfuel-db@$(hostname)"

# Показать публичный ключ
cat /opt/avfuel-db/docker/db-server/id_rsa.pub
```

### Добавить ключ на Server 3

```bash
# На Server 3:
echo "<содержимое id_rsa.pub>" >> /home/backup/.ssh/authorized_keys
chmod 600 /home/backup/.ssh/authorized_keys
chown backup:backup /home/backup/.ssh/authorized_keys
```

### Проверить SSH-соединение

```bash
# На Server 2:
ssh -i /opt/avfuel-db/docker/db-server/id_rsa \
  -o StrictHostKeyChecking=no \
  backup@MON_SERVER_IP \
  "echo SSH OK && ls /backups/avfuel/"
```

---

## 8. Холодное хранилище

### Жизненный цикл данных

```
Server 2 (БД)
  ↓ pg_dump @ 01:00 (ежедневно)
  ↓ rsync → Server 3 (локально 7 дней)
  
Server 3 (Мониторинг)
  ↓ rclone sync @ 03:00 (ежедневно)
  ↓ → Cold Storage (S3/B2/MinIO)
  
Cold Storage (Lifecycle Policy)
  Полные бэкапы (/full/)     → автоудаление через 90 дней
  Архивы audit_log (/archive/) → автоудаление через 365 дней
  
Server 3 (локально)
  Полные бэкапы → удалять после 30 дней (уже в cold storage)
  Архивы → удалять после 30 дней (уже в cold storage)
```

### Lifecycle Policy в AWS S3 (пример)

В AWS Console → S3 → ваш bucket → Management → Lifecycle rules:

**Правило 1: "archive-old-backups"**
- Prefix: `full/`
- Action: Expire current versions → After 90 days

**Правило 2: "expire-audit-archives"**  
- Prefix: `archive/`
- Action: Expire current versions → After 365 days

**Для Backblaze B2:**  
B2 Console → Buckets → Lifecycle Settings → Days: 90 (для full/)

**Для Yandex Cloud:**  
Object Storage Console → Bucket → Lifecycle → Add rule → Expiration: 90 days

### Проверка cold storage

```bash
# На Server 3:
docker compose -f docker-compose.prod-monitoring.yml exec backup_manager \
  rclone ls s3-cold:avfuel-backups/full/ | head -10

# Сколько занято
docker compose -f docker-compose.prod-monitoring.yml exec backup_manager \
  rclone size s3-cold:avfuel-backups/
```

### Восстановление из cold storage

```bash
# Скачать бэкап с cold storage на Server 3
docker compose -f docker-compose.prod-monitoring.yml exec backup_manager \
  rclone copy \
    s3-cold:avfuel-backups/full/avfuel_2025-01-01_02-00-00.sql.gz \
    /backups/avfuel/restore/

# Восстановить (см. docs/BACKUP.md раздел 6)
```

---

## 9. Проверка всей системы

После завершения настройки всех трёх серверов:

```bash
# ─── Server 2: БД ────────────────────────────────────────────
docker compose -f docker-compose.prod-db.yml ps
# Ожидание: db=Up(healthy), postgres_exporter=Up, db_backup=Up

# ─── Server 1: Приложение ────────────────────────────────────
docker compose -f docker-compose.prod-app.yml ps
# Ожидание: app=Up(healthy)
curl -I https://your-domain.com/api/health
# Ожидание: HTTP/2 200

# ─── Server 3: Мониторинг ────────────────────────────────────
docker compose -f docker-compose.prod-monitoring.yml ps
# Ожидание: все Up

# Prometheus targets
curl -s http://MON_SERVER_IP:9090/api/v1/targets | \
  python3 -c "import sys,json; [print(t['labels']['job'], t['health']) for t in json.load(sys.stdin)['data']['activeTargets']]"
# Ожидание: все "up"

# Ручной бэкап
docker compose -f docker-compose.prod-db.yml exec db_backup sh /db-backup.sh once
ls -lh /backups/avfuel/full/  # на Server 3 — новый файл

# Ручная проверка бэкапа
docker compose -f docker-compose.prod-monitoring.yml exec backup_manager sh /verify-backup.sh
# Ожидание: "OK" и сообщение в Telegram
```

---

## 10. Обновление приложения

```bash
# На Server 1:
cd /opt/avfuel

# 1. Получить новый код
git pull origin main

# 2. Остановить приложение
docker compose -f docker-compose.prod-app.yml stop app

# 3. Пересобрать образ
docker compose -f docker-compose.prod-app.yml build app

# 4. Применить новые миграции (если есть)
# Проверить: git diff HEAD~1 HEAD -- migrations/
# На Server 2:
# docker compose exec db psql -U avfuel -d avfuel < migrations/НОВАЯ_МИГРАЦИЯ.sql

# 5. Запустить обновлённое приложение
docker compose -f docker-compose.prod-app.yml up -d app

# 6. Проверить
docker compose -f docker-compose.prod-app.yml logs -f app
curl https://your-domain.com/api/health
```

### Rollback при проблемах

```bash
# На Server 1:
docker compose -f docker-compose.prod-app.yml stop app
git checkout HEAD~1     # вернуться на предыдущий коммит
docker compose -f docker-compose.prod-app.yml build app
docker compose -f docker-compose.prod-app.yml up -d app
```
