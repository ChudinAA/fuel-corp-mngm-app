# Стратегия резервного копирования баз данных

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Содержание

1. [Обзор стратегии](#1-обзор)
2. [Типы резервных копий](#2-типы)
3. [Быстрорастущие таблицы и архивирование](#3-архивирование)
4. [Автоматизация (Docker Compose)](#4-автоматизация)
5. [Ручной запуск бэкапа](#5-ручной-запуск)
6. [Восстановление из резервной копии](#6-восстановление)
7. [Холодное хранилище](#7-холодное-хранилище)
8. [Мониторинг бэкапов](#8-мониторинг)
9. [Тестирование восстановления](#9-тестирование)

---

## 1. Обзор

### Стратегия "3-2-1"

| Правило | Описание |
|---------|----------|
| **3 копии** | Оригинал + 2 резервных |
| **2 носителя** | Локально на сервере + удалённо (S3 / NAS / другой сервер) |
| **1 оффлайн** | Минимум одна копия в холодном хранилище |

### Расписание

| Тип бэкапа | Частота | Хранение |
|------------|---------|----------|
| Полный дамп БД | Ежедневно в 02:00 | 30 дней |
| Архив `audit_log` (старше 90 дней) | Ежедневно | 1 год |
| Архив операционных таблиц | Ежедневно | 1 год |
| Только схема (структура) | Ежедневно | 90 дней |

---

## 2. Типы резервных копий

### A. Полный дамп (Full Backup)

Содержит **все данные и схему** базы данных.

```
backups/
└── full/
    ├── avfuel_full_2025-01-01_02-00-00.sql.gz   (~15-100 МБ)
    ├── avfuel_full_2025-01-02_02-00-00.sql.gz
    └── ...
```

- Файл сжат (gzip -9)
- Восстанавливается одной командой
- Хранятся последние 30 дней

### B. Архивные бэкапы (Archive Backup)

Выгрузка **только старых данных** из быстрорастущих таблиц. Позволяет:
- Освободить место в основной БД
- Сохранить историю в холодном хранилище

```
backups/
└── archive/
    ├── audit_log/
    │   ├── audit_log_2025-01-01.sql.gz       (~5-50 МБ)
    │   └── audit_log_2025-01-02.sql.gz
    └── operational/
        ├── opt_2025-01-01.sql.gz
        ├── refueling_2025-01-01.sql.gz
        └── movement_2025-01-01.sql.gz
```

- Хранятся 1 год
- Можно восстановить в отдельную БД для анализа

### C. Схема (Schema Backup)

Только DDL-структура (без данных). Нужна для:
- Быстрого понимания текущей версии схемы
- Аварийного восстановления структуры без данных

```
backups/
└── schema/
    ├── schema_2025-01-01.sql     (~50-200 КБ)
    └── ...
```

---

## 3. Быстрорастущие таблицы и архивирование

### Проблема

Система активно записывает данные в несколько таблиц:

| Таблица | Рост | Описание |
|---------|------|----------|
| `audit_log` | Высокий | Каждое изменение любой сущности |
| `opt` | Средний | Оптовые сделки |
| `refueling` | Средний | Заправки ВС |
| `aircraft_refueling_abroad` | Средний | Заправки за рубежом |
| `movement` | Средний | Движения топлива |
| `warehouse_transactions` | Высокий | Складские операции |
| `equipment_movement` | Средний | Движения оборудования |
| `session` | Средний | Сессии пользователей (очищаются автоматически) |

### Решение: партиционирование или архивирование

**Рекомендуемый подход для `audit_log`:**

1. Ежедневно в 02:00 автоматически создаётся архивный дамп записей старше 90 дней
2. После проверки архива, запускается очистка в БД:

```sql
-- ВНИМАНИЕ: выполнять только после проверки архивного дампа!
-- Удаляет записи audit_log старше 90 дней
DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '90 days';

-- Освобождаем пространство (запускать в период низкой нагрузки)
VACUUM ANALYZE audit_log;
```

**Проверка размера `audit_log` перед очисткой:**

```sql
SELECT
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS archivable_records,
  pg_size_pretty(pg_relation_size('audit_log')) AS table_size,
  pg_size_pretty(pg_total_relation_size('audit_log')) AS total_with_indexes
FROM audit_log;
```

### Настройка партиционирования (для больших объёмов > 10M записей)

Если `audit_log` превысит 10 млн записей, рекомендуется перейти на партиционирование по месяцам.  
Это позволяет удалять целые партиции вместо построчного DELETE:

```sql
-- Создание партиционированной версии (выполнять в период обслуживания)
CREATE TABLE audit_log_partitioned (
    LIKE audit_log INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Создание партиций по месяцам
CREATE TABLE audit_log_2025_01 PARTITION OF audit_log_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- ... и т.д.

-- Удаление старой партиции (мгновенно, без блокировок):
DROP TABLE audit_log_2025_01;
```

---

## 4. Автоматизация (Docker Compose)

Контейнер `avfuel_backup` запускается вместе с остальными сервисами и выполняет бэкапы по расписанию.

```bash
# Проверить, что контейнер бэкапов работает
docker compose ps backup

# Просмотреть логи последнего бэкапа
docker compose logs backup

# Проверить размер папки с бэкапами
du -sh backups/
du -sh backups/full/
du -sh backups/archive/
```

Бэкапы сохраняются в директорию `./backups/` на хосте (монтируется как volume).

---

## 5. Ручной запуск бэкапа

### Полный бэкап прямо сейчас

```bash
# Вариант 1: Через контейнер backup
docker compose exec backup sh /backup.sh once

# Вариант 2: Через контейнер db напрямую
docker compose exec db sh -c \
  "PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
    -U avfuel -d avfuel \
    --format=plain --no-owner --no-acl \
    | gzip > /backups/full/manual_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Бэкап только одной таблицы

```bash
TABLE=audit_log
docker compose exec -T db sh -c \
  "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump \
    -U avfuel -d avfuel \
    --table=$TABLE \
    --format=plain --no-owner --no-acl" \
  | gzip > backups/archive/${TABLE}_manual_$(date +%Y%m%d).sql.gz

echo "Размер: $(du -sh backups/archive/${TABLE}_manual_*.sql.gz | tail -1)"
```

### Список всех бэкапов

```bash
echo "=== Полные бэкапы ==="
ls -lh backups/full/ 2>/dev/null || echo "(пусто)"

echo ""
echo "=== Архивы audit_log ==="
ls -lh backups/archive/audit_log/ 2>/dev/null || echo "(пусто)"

echo ""
echo "=== Итого занято ==="
du -sh backups/
```

---

## 6. Восстановление из резервной копии

### Восстановление полного бэкапа

```bash
# Шаг 1: Выбрать файл для восстановления
ls -lh backups/full/*.sql.gz | tail -10

# Шаг 2: Остановить приложение (БД оставить запущенной)
docker compose stop app

# Шаг 3: Сбросить и восстановить БД
BACKUP_FILE="backups/full/avfuel_full_2025-01-01_02-00-00.sql.gz"

docker compose exec -T db psql -U avfuel -d avfuel \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

gunzip -c "$BACKUP_FILE" | \
  docker compose exec -T db psql -U avfuel -d avfuel

# Шаг 4: Запустить приложение
docker compose up -d app
docker compose logs -f app
```

### Восстановление архивных данных в отдельную БД (для анализа)

```bash
# Создать временную БД для анализа архивных данных
docker compose exec db createdb -U avfuel avfuel_archive

# Восстановить архивный дамп
gunzip -c backups/archive/audit_log/audit_log_2025-01-01.sql.gz | \
  docker compose exec -T db psql -U avfuel -d avfuel_archive

# Выполнить аналитический запрос
docker compose exec db psql -U avfuel -d avfuel_archive \
  -c "SELECT operation, COUNT(*) FROM audit_log GROUP BY operation;"

# Удалить временную БД
docker compose exec db dropdb -U avfuel avfuel_archive
```

### Точечное восстановление одной таблицы (без потери других данных)

```bash
# Восстановить таблицу audit_log из архива в СУЩЕСТВУЮЩУЮ БД
# (добавит записи, не затронет другие таблицы)
gunzip -c backups/archive/audit_log/audit_log_2025-01-01.sql.gz | \
  docker compose exec -T db psql -U avfuel -d avfuel \
    --single-transaction \
    -v ON_ERROR_STOP=1
```

---

## 7. Холодное хранилище

Для долгосрочного хранения бэкапы нужно копировать на внешнее хранилище.

### Вариант A: rsync на удалённый сервер

```bash
# /opt/avfuel/scripts/sync-to-cold-storage.sh
#!/bin/bash
REMOTE_USER="backup"
REMOTE_HOST="backup-server.company.com"
REMOTE_PATH="/cold-storage/avfuel"

rsync -avz --delete \
  --password-file=/etc/rsyncd.secrets \
  backups/ \
  "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

echo "Sync completed: $(date)"
```

Добавить в crontab хоста (не Docker):
```
0 4 * * * /opt/avfuel/scripts/sync-to-cold-storage.sh >> /var/log/avfuel-backup-sync.log 2>&1
```

### Вариант B: AWS S3 / MinIO / Yandex Object Storage

```bash
# Установка AWS CLI (если нет MinIO)
# sudo apt install awscli
# или для MinIO: скачать mc (MinIO Client)

# Синхронизация с S3-совместимым хранилищем
aws s3 sync backups/ s3://your-bucket/avfuel-backups/ \
  --endpoint-url https://storage.yandexcloud.net \
  --exclude "*.tmp"
```

### Вариант C: Монтирование NAS (SMB/NFS)

```bash
# Смонтировать NAS в директорию cold-storage
sudo mount -t cifs //nas.company.local/backup /mnt/cold-storage \
  -o username=backup,password=xxx,uid=1000

# Скопировать архивные бэкапы
cp -r backups/archive/ /mnt/cold-storage/avfuel/
```

---

## 8. Мониторинг бэкапов

### Проверка последнего бэкапа

```bash
# Последний полный бэкап (дата и размер)
ls -lt backups/full/*.sql.gz | head -3

# Проверить, что бэкап не пустой
LAST=$(ls -t backups/full/*.sql.gz | head -1)
echo "Последний бэкап: $LAST"
echo "Размер: $(du -sh "$LAST")"
echo "Проверка целостности gzip:"
gunzip -t "$LAST" && echo "OK" || echo "ПОВРЕЖДЁН!"
```

### Алерт: бэкап не запустился за последние 25 часов

```bash
#!/bin/bash
# /opt/avfuel/scripts/check-backup.sh
LAST=$(ls -t backups/full/*.sql.gz 2>/dev/null | head -1)
if [ -z "$LAST" ]; then
  echo "ALERT: No backup files found!"
  exit 1
fi

AGE=$(( ($(date +%s) - $(stat -c %Y "$LAST")) / 3600 ))
if [ $AGE -gt 25 ]; then
  echo "ALERT: Last backup is ${AGE}h old: $LAST"
  exit 1
fi

echo "OK: Last backup ${AGE}h ago ($(du -sh "$LAST"))"
```

---

## 9. Тестирование восстановления

**Рекомендуется проводить ежемесячно.**

```bash
# 1. Создать тестовую БД
docker compose exec db createdb -U avfuel avfuel_test

# 2. Восстановить последний бэкап в тестовую БД
LAST=$(ls -t backups/full/*.sql.gz | head -1)
gunzip -c "$LAST" | \
  docker compose exec -T db psql -U avfuel -d avfuel_test

# 3. Проверить количество записей в ключевых таблицах
docker compose exec db psql -U avfuel -d avfuel_test -c "
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'opt', COUNT(*) FROM opt
UNION ALL SELECT 'refueling', COUNT(*) FROM refueling
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
ORDER BY t;
"

# 4. Сравнить с production БД
docker compose exec db psql -U avfuel -d avfuel -c "
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'opt', COUNT(*) FROM opt
UNION ALL SELECT 'refueling', COUNT(*) FROM refueling
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log
ORDER BY t;
"

# 5. Удалить тестовую БД
docker compose exec db dropdb -U avfuel avfuel_test

echo "Тест восстановления завершён"
```
