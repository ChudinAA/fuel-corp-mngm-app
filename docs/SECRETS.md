# Управление секретами при переносе приложения

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Какие секреты использует приложение

| Переменная | Где используется | Уровень критичности |
|------------|-----------------|-------------------|
| `DATABASE_URL` | Подключение к PostgreSQL (backend) | 🔴 Критично |
| `SESSION_SECRET` | Подпись сессий пользователей | 🔴 Критично |
| `POSTGRES_PASSWORD` | Пароль PostgreSQL (docker-compose) | 🔴 Критично |

> **Нет внешних API-ключей.** Система не использует платёжные системы, внешние OAuth или облачные сервисы — все данные хранятся локально.

---

## Как секреты передаются в приложение

```
.env файл на хосте
       │
       ▼
Docker Compose (environment:)
       │
       ▼
Контейнер (переменные окружения)
       │
       ▼
Node.js (process.env.*)
```

Файл `.env` **никогда не коммитится в Git** (добавлен в `.gitignore`).

---

## Генерация безопасных секретов

```bash
# Пароль базы данных (256 бит энтропии)
openssl rand -base64 32

# Секрет сессии (384 бита энтропии)
openssl rand -base64 48

# Пример вывода:
# bK7mN2pQ8xR3vW9yZ1aB4cE6gH0iJ5kL==
# yT2wX8eC4nS6mA0pL3bQ9vR7dK1uF5hG2jN==
```

---

## Перенос секретов из Replit

В Replit секреты хранятся в **Secrets Manager** (не в файлах).

### Шаг 1: Просмотр секретов в Replit

В интерфейсе Replit: **Tools → Secrets**  
Скопируйте значения следующих переменных:
- `DATABASE_URL` — строка подключения к Neon PostgreSQL

> **Примечание:** `SESSION_SECRET` в Replit может не быть задан явно (используется дефолтное значение в коде). Для production **обязательно** задайте новый случайный секрет.

### Шаг 2: Заполнение .env на сервере заказчика

```bash
# На сервере заказчика:
cp .env.example .env
chmod 600 .env

# Отредактируйте файл
nano .env
```

Для самохостинга `DATABASE_URL` формируется **автоматически** через docker-compose из `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — отдельно задавать не нужно.

### Шаг 3: Проверка

```bash
# Проверить, что секреты загружены в контейнер
docker compose exec app sh -c 'echo "SESSION_SECRET length: ${#SESSION_SECRET}"'
# Ожидаемый вывод: SESSION_SECRET length: 64 (или больше)

# НИКОГДА не выводите сами значения секретов!
```

---

## Ротация секретов (смена паролей)

### Смена SESSION_SECRET

При смене сессионного секрета **все пользователи будут разлогинены** — это нормально.

```bash
# 1. Сгенерировать новый секрет
NEW_SECRET=$(openssl rand -base64 48)

# 2. Обновить в .env
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$NEW_SECRET/" .env

# 3. Перезапустить приложение
docker compose restart app
```

### Смена пароля PostgreSQL

```bash
# 1. Сгенерировать новый пароль
NEW_PASS=$(openssl rand -base64 32)

# 2. Сменить в PostgreSQL
docker compose exec db psql -U avfuel -d avfuel \
  -c "ALTER USER avfuel PASSWORD '$NEW_PASS';"

# 3. Обновить .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_PASS/" .env

# 4. Перезапустить все сервисы (чтобы подхватили новый .env)
docker compose down && docker compose up -d
```

---

## Безопасность файла .env

```bash
# Только владелец может читать .env
chmod 600 .env

# Проверить права
ls -la .env
# Ожидаемый вывод: -rw------- 1 user user ... .env

# .env исключён из Git
grep ".env" .gitignore
```

---

## Docker Secrets (продвинутый вариант)

Для высоконагруженных или SOC2/PCI-compliant сред вместо `.env` рекомендуется использовать Docker Secrets:

```bash
# Создать секрет
echo "mysecretpassword" | docker secret create postgres_password -

# Использовать в docker-compose.yml
# (требует Docker Swarm mode)
```

Для большинства корпоративных развёртываний достаточно защищённого `.env` файла с правами `600`.
