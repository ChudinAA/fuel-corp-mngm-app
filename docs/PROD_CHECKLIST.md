# Чек-лист production-развёртывания (3 сервера)

**Aviation Fuel Management System**  
Версия документа: 1.0 | Май 2026

---

## Server 2: База данных

### Подготовка
- [ ] Docker установлен и работает
- [ ] Директория `/opt/avfuel-db/` создана
- [ ] Файлы скопированы: `docker-compose.prod-db.yml`, `docker/postgres/`, `docker/db-server/`
- [ ] `.env` создан из `.env.prod-db.example`, права `chmod 600 .env`
- [ ] `POSTGRES_PASSWORD` задан (случайный, минимум 32 символа)
- [ ] `BACKUP_REMOTE_HOST` = IP Server 3
- [ ] SSH-ключ сгенерирован: `docker/db-server/id_rsa` + `id_rsa.pub`

### Развёртывание
- [ ] `docker compose -f docker-compose.prod-db.yml up -d db postgres_exporter`
- [ ] `docker compose exec db pg_isready -U avfuel` → OK
- [ ] Схема применена (все миграции из `migrations/*.sql`)
- [ ] Количество таблиц ≥ 40: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';`
- [ ] (опционально) Данные из Neon восстановлены

### Firewall
- [ ] Порт 5432 открыт только для IP Server 1
- [ ] Порт 9187 открыт только для IP Server 3
- [ ] Порт 22 открыт для администратора
- [ ] `ufw enable && ufw status`

---

## Server 1: Приложение

### Подготовка
- [ ] Docker + Nginx + certbot установлены
- [ ] Репозиторий клонирован в `/opt/avfuel/`
- [ ] `server/db.ts` = standalone версия (не Neon)
- [ ] `.env` создан из `.env.prod-app.example`, права `chmod 600 .env`
- [ ] `DATABASE_URL` указывает на `DB_SERVER_IP:5432` с правильным паролем
- [ ] `SESSION_SECRET` задан (случайный, минимум 48 символов)

### Развёртывание
- [ ] `docker compose -f docker-compose.prod-app.yml build`
- [ ] `docker compose -f docker-compose.prod-app.yml up -d`
- [ ] `curl http://localhost:5000/api/health` → `{"status":"ok"}`
- [ ] Node Exporter запущен (порт 9100, только для Server 3)

### Nginx + HTTPS
- [ ] Конфиг `/etc/nginx/sites-available/avfuel` настроен (домен)
- [ ] `sudo nginx -t` → синтаксис OK
- [ ] `certbot --nginx -d your-domain.com` → сертификат получен
- [ ] `curl -I https://your-domain.com/api/health` → 200 OK
- [ ] HTTP перенаправляется на HTTPS

### Firewall
- [ ] Порт 80 открыт (HTTP → HTTPS редирект)
- [ ] Порт 443 открыт (HTTPS)
- [ ] Порт 5000 НЕ открыт (только localhost)
- [ ] Порт 9100 открыт только для IP Server 3

---

## Server 3: Мониторинг и бэкапы

### Подготовка
- [ ] Docker установлен
- [ ] Пользователь `backup` создан
- [ ] Директория `/backups/avfuel/` создана, владелец `backup`
- [ ] SSH-ключ Server 2 добавлен в `/home/backup/.ssh/authorized_keys`
- [ ] Директория `/opt/avfuel-monitoring/` создана
- [ ] Файлы скопированы: `docker-compose.prod-monitoring.yml`, `docker/monitoring/`
- [ ] `.env` создан из `.env.prod-monitoring.example`
- [ ] `GRAFANA_PASSWORD` задан
- [ ] `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` заданы
- [ ] `APP_SERVER_IP`, `DB_SERVER_IP` заданы в `.env`
- [ ] IP-адреса заменены в `prometheus.yml` (APP и DB серверы)
- [ ] Токены заменены в `alertmanager.yml`

### rclone
- [ ] `docker/monitoring/rclone/rclone.conf` создан (из шаблона)
- [ ] Данные провайдера заполнены
- [ ] `docker compose exec backup_manager rclone lsd s3-cold:avfuel-backups/` → OK
- [ ] Lifecycle policy настроена в веб-консоли провайдера (автоудаление)

### Развёртывание
- [ ] `docker compose up -d` → все сервисы запущены
- [ ] `http://MON_SERVER_IP:3001` → Uptime Kuma доступен
- [ ] `http://MON_SERVER_IP:3000` → Grafana доступна
- [ ] Prometheus targets все UP: `http://MON_SERVER_IP:9090/targets`

### Uptime Kuma
- [ ] Монитор "AvFuel App" создан (HTTPS → /api/health)
- [ ] Монитор "AvFuel DB" создан (TCP → DB_SERVER_IP:5432)
- [ ] Telegram-уведомления настроены и протестированы

### Бэкапы
- [ ] SSH-соединение с Server 2 работает (rsync test)
- [ ] `docker compose exec db_backup sh /db-backup.sh once` → бэкап создан
- [ ] Файл появился в `/backups/avfuel/full/` на Server 3
- [ ] `docker compose exec backup_manager sh /verify-backup.sh` → OK
- [ ] Отчёт пришёл в Telegram

### Firewall
- [ ] Порт 22 открыт для Server 2 IP (rsync) + Admin IP
- [ ] Порт 3000 открыт только для Admin IP
- [ ] Порт 3001 открыт только для Admin IP
- [ ] Остальные порты закрыты

---

## Финальная проверка всей системы

- [ ] Авторизация в приложении работает (`https://your-domain.com`)
- [ ] Данные загружаются (списки, таблицы)
- [ ] Создание записи работает (новый OPT или заправка)
- [ ] Audit log пишется
- [ ] Grafana: все дашборды показывают данные
- [ ] Uptime Kuma: все мониторы зелёные
- [ ] Telegram: тестовый алерт получен
- [ ] Ручная проверка бэкапа прошла успешно

---

## Аварийное восстановление (контакты и данные)

```
Server 1 (App):   IP: ___.___.___.___ | SSH: user@ | /opt/avfuel/
Server 2 (DB):    IP: ___.___.___.___ | SSH: user@ | /opt/avfuel-db/
Server 3 (Mon):   IP: ___.___.___.___ | SSH: user@ | /opt/avfuel-monitoring/

Grafana:          http://Server3:3000 | admin / (см. .env)
Uptime Kuma:      http://Server3:3001
Prometheus:       http://Server3:9090

Cold Storage:     Провайдер: ___ | Bucket: avfuel-backups
Telegram Bot:     @___

Последний бэкап:  /backups/avfuel/full/avfuel_<ДАТА>.gz
Восстановление:   docker/restore/restore.sh <файл>
```
