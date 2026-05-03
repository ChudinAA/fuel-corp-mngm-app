# Руководство по мониторингу

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Содержание

1. [Обзор стека мониторинга](#1-обзор)
2. [Uptime Kuma — настройка мониторов](#2-uptime-kuma)
3. [Grafana — дашборды](#3-grafana)
4. [Prometheus — метрики](#4-prometheus)
5. [Telegram-алерты](#5-telegram)
6. [Мониторинг бэкапов](#6-мониторинг-бэкапов)
7. [Что делать при алерте](#7-runbook)

---

## 1. Обзор

### Два уровня мониторинга

| Уровень | Инструмент | URL | Назначение |
|---------|-----------|-----|-----------|
| **Доступность** | Uptime Kuma | `:3001` | HTTP/TCP проверки, алерты в Telegram |
| **Метрики** | Prometheus + Grafana | `:9090` / `:3000` | CPU, RAM, диск, PostgreSQL, запросы |

### Почему два инструмента?

**Uptime Kuma** — простой и надёжный: проверяет "жив ли сайт" каждые 60 секунд. Отправляет Telegram-алерт мгновенно при недоступности. Не требует настройки.

**Prometheus + Grafana** — глубокая аналитика: медленные запросы к БД, рост таблиц, утечки памяти, тренды нагрузки. Нужен когда надо разобраться *почему* что-то работает медленно.

---

## 2. Uptime Kuma — настройка мониторов

**Доступ:** `http://MON_SERVER_IP:3001`

При первом входе: создайте аккаунт (логин/пароль задаёте сами).

### Добавить монитор: Приложение

1. **+ Add New Monitor**
2. Monitor Type: `HTTP(s)`
3. Friendly Name: `AvFuel App`
4. URL: `https://your-domain.com/api/health`
5. Heartbeat Interval: `60` секунд
6. Retries: `3`
7. Accepted Status Codes: `200`
8. **Save**

### Добавить монитор: PostgreSQL (TCP)

1. **+ Add New Monitor**
2. Monitor Type: `TCP Port`
3. Friendly Name: `AvFuel DB`
4. Hostname: `DB_SERVER_IP`
5. Port: `5432`
6. Heartbeat Interval: `60` секунд
7. **Save**

### Добавить монитор: Grafana

1. **+ Add New Monitor**
2. Monitor Type: `HTTP(s)`
3. Friendly Name: `Grafana`
4. URL: `http://MON_SERVER_IP:3000/api/health`
5. Interval: `120` секунд
6. **Save**

### Настройка Telegram-уведомлений

1. Перейдите в **Settings → Notifications**
2. **Add Notification**
3. Notification Provider: `Telegram`
4. Bot Token: `<токен вашего бота>`
5. Chat ID: `<ваш chat_id>`
6. **Test** → должно прийти тестовое сообщение
7. **Save**
8. При создании каждого монитора → отметьте этот канал в секции "Notifications"

---

## 3. Grafana — дашборды

**Доступ:** `http://MON_SERVER_IP:3000`  
Логин: `admin`, пароль из `.env` (`GRAFANA_PASSWORD`)

### Импорт готовых дашбордов (рекомендуется)

Grafana имеет библиотеку готовых дашбордов: [grafana.com/grafana/dashboards](https://grafana.com/grafana/dashboards)

**Импорт через Dashboard ID:**

1. Grafana → **Dashboards → Import**
2. Ввести ID → Load → выбрать Prometheus datasource → Import

| Дашборд | ID | Описание |
|---------|-----|---------|
| Node Exporter Full | `1860` | CPU, RAM, диск, сеть серверов |
| PostgreSQL Database | `9628` | Запросы, соединения, размер таблиц |
| PostgreSQL Statistics | `455` | Детальная статистика |
| Docker & System Monitoring | `893` | Docker контейнеры |

### Создание статус-дашборда AvFuel

1. **+ New Dashboard → Add Visualization**
2. Datasource: Prometheus
3. Создайте панели:

**Панель: Статус приложения**
```promql
up{job="avfuel_app"}
```
Тип: Stat, Threshold: 1=green, 0=red

**Панель: Соединения с PostgreSQL**
```promql
pg_stat_activity_count{job="postgres"}
```
Тип: Time Series

**Панель: Размер базы данных**
```promql
pg_database_size_bytes{datname="avfuel"}
```
Тип: Stat, Unit: bytes

**Панель: Медленные запросы (>1с)**
```promql
rate(pg_stat_activity_max_tx_duration{job="postgres"}[5m])
```

**Панель: Свободное место на дисках**
```promql
(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100
```

### Настройка алертов в Grafana

1. **Alerting → Contact points → Add**
2. Name: `Telegram`
3. Integration: `Telegram`
4. Bot Token + Chat ID
5. **Test + Save**

Привяжите к правилам алертов из Prometheus (они автоматически появятся в Grafana при настроенном Alertmanager).

---

## 4. Prometheus — метрики

**Доступ:** `http://MON_SERVER_IP:9090` (только с Admin IP)

### Проверка состояния targets

Откройте: `http://MON_SERVER_IP:9090/targets`

Все targets должны быть **UP** (зелёные).

| Target | Ожидаемый статус |
|--------|----------------|
| prometheus | UP |
| node_exporter_monitoring | UP |
| node_exporter_app | UP |
| node_exporter_db | UP |
| postgres | UP |
| avfuel_app | UP |

### Полезные запросы (PromQL)

```promql
# Доступность приложения
up{job="avfuel_app"}

# Использование CPU на всех серверах
100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Свободная память
node_memory_MemAvailable_bytes / 1024 / 1024

# Размер БД avfuel
pg_database_size_bytes{datname="avfuel"} / 1024 / 1024 / 1024

# Количество активных соединений к PostgreSQL
pg_stat_activity_count

# Топ медленных запросов (если включён pg_stat_statements)
topk(10, pg_stat_statements_mean_exec_time_seconds)

# Свободное место на диске бэкапов (Server 3)
node_filesystem_avail_bytes{mountpoint="/backups"} / 1024 / 1024 / 1024
```

---

## 5. Telegram-алерты

### Создание Telegram бота

```bash
# 1. Написать боту @BotFather: /newbot
# 2. Ввести имя: AvFuel Monitoring Bot
# 3. Ввести username: avfuel_mon_bot (должен заканчиваться на 'bot')
# 4. Получить TOKEN

# 5. Узнать CHAT_ID:
# Написать боту /start
# Выполнить:
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
# Найти в ответе: "chat":{"id":123456789}
```

### Тест алерта вручную

```bash
BOT_TOKEN="your_token"
CHAT_ID="your_chat_id"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=[AvFuel] Тестовый алерт — система мониторинга работает"
```

### Какие алерты приходят автоматически

| Событие | Задержка | Канал |
|---------|---------|-------|
| Приложение недоступно | 2 мин | Telegram (критично) |
| PostgreSQL недоступен | 1 мин | Telegram (критично) |
| CPU > 90% (5 мин) | 5 мин | Telegram (предупреждение) |
| Диск < 15% | 5 мин | Telegram (предупреждение) |
| Диск < 5% | 1 мин | Telegram (критично) |
| RAM > 90% | 5 мин | Telegram (предупреждение) |
| Последний бэкап > 25ч | При проверке | Telegram |

---

## 6. Мониторинг бэкапов

### Просмотр состояния бэкапов

```bash
# На Server 3:
# Последний полный бэкап
ls -lht /backups/avfuel/full/ | head -5

# Размер хранилища бэкапов
du -sh /backups/avfuel/
du -sh /backups/avfuel/full/
du -sh /backups/avfuel/archive/

# Логи backup manager
docker compose -f docker-compose.yml logs backup_manager --tail=50
```

### Проверка синхронизации в cold storage

```bash
# На Server 3:
docker compose exec backup_manager \
  rclone lsd s3-cold:avfuel-backups/

docker compose exec backup_manager \
  rclone ls s3-cold:avfuel-backups/full/ | head -10

# Общий размер в cold storage
docker compose exec backup_manager \
  rclone size s3-cold:avfuel-backups/
```

### Запуск ручной проверки бэкапа

```bash
# На Server 3:
docker compose exec backup_manager sh /verify-backup.sh

# Результат будет отправлен в Telegram и в лог
```

### Мониторинг через скрипт (можно добавить в crontab хоста)

```bash
# На Server 3 (crontab):
# Каждый час проверять состояние бэкапов
0 * * * * /opt/avfuel-monitoring/docker/backup-manager/check-backup.sh >> /var/log/avfuel-backup.log 2>&1
```

---

## 7. Runbook — что делать при алерте

### 🔴 "Приложение недоступно" (AppDown)

```bash
# На Server 1:
# 1. Проверить контейнер
docker compose -f docker-compose.prod-app.yml ps
docker compose -f docker-compose.prod-app.yml logs --tail=50 app

# 2. Попробовать перезапустить
docker compose -f docker-compose.prod-app.yml restart app

# 3. Проверить доступность БД с Server 1
psql "postgresql://avfuel:PASS@DB_SERVER_IP:5432/avfuel" -c "SELECT 1;"

# 4. Если не помогает — пересобрать
docker compose -f docker-compose.prod-app.yml build app
docker compose -f docker-compose.prod-app.yml up -d app
```

### 🔴 "PostgreSQL недоступен" (PostgresDown)

```bash
# На Server 2:
docker compose -f docker-compose.prod-db.yml ps
docker compose -f docker-compose.prod-db.yml logs --tail=50 db

# Перезапустить
docker compose -f docker-compose.prod-db.yml restart db

# Проверить место на диске (частая причина!)
df -h
du -sh /var/lib/docker/volumes/*/

# Проверить логи PostgreSQL
docker compose -f docker-compose.prod-db.yml exec db \
  tail -100 /var/log/postgresql/postgresql-*.log 2>/dev/null || \
  docker compose -f docker-compose.prod-db.yml logs db --tail=100
```

### ⚠️ "Мало места на диске" (LowDiskSpace)

```bash
# Определить, какой сервер
# Server 3 (бэкапы) — чаще всего:
df -h /backups

# Удалить старые бэкапы вручную
find /backups/avfuel/full/ -mtime +30 -name "*.gz" -delete
find /backups/avfuel/archive/ -mtime +90 -name "*.gz" -delete

# Принудительно синхронизировать в cold storage и удалить
docker compose exec backup_manager \
  rclone sync /backups/avfuel/ s3-cold:avfuel-backups/ --min-age 1d

# Server 2 (данные БД) — срочно!
# Запустить VACUUM
docker compose exec db psql -U avfuel -d avfuel \
  -c "VACUUM (VERBOSE, ANALYZE);"

# Посмотреть самые большие таблицы
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables WHERE schemaname='public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"
```

### ⚠️ "Много соединений к PostgreSQL" (PostgresTooManyConnections)

```bash
# На Server 2 — посмотреть активные соединения
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT usename, client_addr, state, COUNT(*)
FROM pg_stat_activity
GROUP BY usename, client_addr, state
ORDER BY COUNT(*) DESC;"

# Завершить зависшие соединения (>10 минут без активности)
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
  AND state_change < NOW() - INTERVAL '10 minutes'
  AND pid <> pg_backend_pid();"
```
