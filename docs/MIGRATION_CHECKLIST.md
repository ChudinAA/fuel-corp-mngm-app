# Чек-лист миграции на сервер заказчика

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Подготовка (выполняется в Replit / на машине разработчика)

- [ ] Получить последнюю версию кода из Replit (Git push или ZIP-архив)
- [ ] Убедиться, что все изменения закоммичены
- [ ] Сделать дамп канонической Replit-БД: `bash scripts/export-database.sh`
- [ ] Проверить размер дампа: `ls -lh database_export_*.sql.gz`
- [ ] Для production использовать подключение из Replit Database Settings; shell `DATABASE_URL` обычно указывает на dev
- [ ] Задать `DATABASE_URL` self-hosted БД только в защищённом `.env`; не записывать строку подключения в Git
- [ ] Сохранить `SESSION_SECRET` безопасным способом, если он нужен для переноса пользовательских сессий

---

## Сервер заказчика — предварительная настройка

- [ ] ОС: Ubuntu 22.04 LTS или Debian 12
- [ ] Docker Engine ≥ 24.0 установлен
- [ ] Docker Compose plugin установлен
- [ ] openssl установлен
- [ ] Firewall настроен (порты 80, 443, 22 открыты)
- [ ] DNS запись указывает на IP сервера (если используется домен)

---

## Развёртывание приложения

- [ ] Код перенесён на сервер: `/opt/avfuel/`
- [ ] Переключён драйвер БД: `cp server/db.standalone.ts server/db.ts`
- [ ] Создан и настроен `.env`: `cp .env.example .env && chmod 600 .env`
- [ ] Секреты сгенерированы (POSTGRES_PASSWORD, SESSION_SECRET)
- [ ] Docker образы собраны: `docker compose build`
- [ ] PostgreSQL запущен: `docker compose up -d db`
- [ ] Схема применена: миграции из `migrations/*.sql`
- [ ] Данные из выбранной Replit-БД восстановлены (если нужен перенос данных)
- [ ] Приложение запущено: `docker compose up -d`
- [ ] Health check проходит: `curl http://localhost:5000/api/health`

---

## Проверка после запуска

- [ ] Авторизация работает (вход в систему)
- [ ] Загружаются списки данных (поставщики, базисы, клиенты)
- [ ] Создание новых записей работает (OPT, Заправки)
- [ ] Audit log записывается
- [ ] SSE (Server-Sent Events) работает — нет зависаний при изменении складских операций
- [ ] Экспорт в Excel работает

---

## Настройка Nginx (HTTPS)

- [ ] Nginx установлен
- [ ] Конфиг `docker/nginx/nginx.conf` скопирован и настроен (домен)
- [ ] SSL-сертификат получен: `certbot --nginx -d your-domain.com`
- [ ] HTTPS работает: `curl -I https://your-domain.com/api/health`
- [ ] HTTP перенаправляется на HTTPS

---

## Настройка бэкапов

- [ ] Директория `backups/` создана: `mkdir -p backups`
- [ ] Контейнер `avfuel_backup` запущен: `docker compose ps backup`
- [ ] Ручной бэкап прошёл успешно: `docker compose exec backup sh /backup.sh once`
- [ ] Файлы бэкапа созданы: `ls -lh backups/full/`
- [ ] Скрипт проверки бэкапов работает: `./scripts/check-backup.sh`
- [ ] Настроена синхронизация в холодное хранилище (rsync / S3)

---

## Финальная проверка

- [ ] `docker compose ps` — все сервисы `Up (healthy)`
- [ ] Логи чистые: `docker compose logs --tail=50 app` — нет критических ошибок
- [ ] Автозапуск проверен: `sudo systemctl is-enabled docker`
- [ ] Сохранены: IP сервера, URL, учётные данные, путь к .env файлу

---

## Полезные команды после запуска

```bash
# Статус сервисов
docker compose ps

# Логи приложения
docker compose logs -f app

# Принудительный бэкап
docker compose exec backup sh /backup.sh once

# Статус и размер БД
docker compose exec db psql -U avfuel -d avfuel \
  -c "SELECT pg_size_pretty(pg_database_size('avfuel'));"

# Перезапуск при проблемах
docker compose restart app

# Полная остановка
docker compose down

# Полная остановка с удалением данных (ОСТОРОЖНО!)
# docker compose down -v
```
