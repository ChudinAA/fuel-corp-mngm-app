-- Инициализация PostgreSQL для Aviation Fuel Management System
-- Этот файл выполняется автоматически при первом старте контейнера

-- Включаем расширение uuid-ossp для совместимости (Drizzle использует gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pg_trgm — ускоряет LIKE/ILIKE поиск по строкам
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pg_stat_statements — мониторинг медленных запросов (рекомендуется)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Настройки для работы с большими объёмами данных
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';
ALTER SYSTEM SET max_connections = '100';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET random_page_cost = '1.1';

SELECT pg_reload_conf();
