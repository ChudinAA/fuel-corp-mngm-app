
-- Таблица определений виджетов (системная)
CREATE TABLE widget_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  default_width integer NOT NULL DEFAULT 2,
  default_height integer NOT NULL DEFAULT 2,
  min_width integer NOT NULL DEFAULT 1,
  min_height integer NOT NULL DEFAULT 1,
  required_permissions text[] DEFAULT '{}',
  config_schema jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

-- Таблица конфигураций дашбордов пользователей
CREATE TABLE dashboard_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false,
  layout jsonb NOT NULL DEFAULT '[]',
  widgets jsonb NOT NULL DEFAULT '[]',
  created_at timestamp DEFAULT now(),
  updated_at timestamp
);

-- Индексы
CREATE INDEX idx_dashboard_config_user ON dashboard_configurations(user_id);
CREATE INDEX idx_widget_definitions_key ON widget_definitions(widget_key);
CREATE INDEX idx_widget_definitions_category ON widget_definitions(category);

-- Вставка базовых виджетов
INSERT INTO widget_definitions (widget_key, name, description, category, default_width, default_height, min_width, min_height, required_permissions) VALUES
  ('opt_stats', 'Оптовые сделки сегодня', 'Количество оптовых сделок за текущий день', 'operations', 1, 1, 1, 1, '{"opt.view"}'),
  ('refueling_stats', 'Заправки ВС сегодня', 'Количество заправок воздушных судов за день', 'operations', 1, 1, 1, 1, '{"refueling.view"}'),
  ('profit_month', 'Прибыль за месяц', 'Общая прибыль за текущий месяц', 'finance', 1, 1, 1, 1, '{"opt.view", "refueling.view"}'),
  ('warehouse_alerts', 'Оповещения складов', 'Склады с низким остатком топлива', 'operations', 1, 1, 1, 1, '{"warehouses.view"}'),
  ('recent_operations', 'Последние операции', 'Недавние сделки и перемещения', 'operations', 2, 2, 2, 2, '{"opt.view", "refueling.view", "movement.view"}'),
  ('warehouse_balances', 'Остатки на складах', 'Текущие объемы топлива по складам', 'operations', 2, 2, 2, 2, '{"warehouses.view"}'),
  ('week_stats', 'Статистика за неделю', 'Сводная статистика операций за неделю', 'analytics', 4, 1, 2, 1, '{"opt.view", "refueling.view"}');
