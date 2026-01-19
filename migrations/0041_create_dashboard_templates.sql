
-- Dashboard Templates
CREATE TABLE IF NOT EXISTS "dashboard_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL, -- 'system', 'user', 'role'
  "role_id" uuid REFERENCES "roles"("id") ON DELETE CASCADE,
  "layout" jsonb NOT NULL,
  "widgets" jsonb NOT NULL,
  "is_system" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "created_by" uuid REFERENCES "users"("id")
);

CREATE INDEX "dashboard_templates_category_idx" ON "dashboard_templates" ("category");
CREATE INDEX "dashboard_templates_role_id_idx" ON "dashboard_templates" ("role_id");
CREATE INDEX "dashboard_templates_is_system_idx" ON "dashboard_templates" ("is_system");

-- Seed system templates
INSERT INTO "dashboard_templates" ("name", "description", "category", "layout", "widgets", "is_system", "is_active")
VALUES 
(
  'Основной дашборд',
  'Базовая конфигурация с ключевыми показателями',
  'system',
  '[
    {"i": "opt_stats-1", "x": 0, "y": 0, "w": 3, "h": 2},
    {"i": "refueling_stats-1", "x": 3, "y": 0, "w": 3, "h": 2},
    {"i": "profit_month-1", "x": 6, "y": 0, "w": 3, "h": 2},
    {"i": "warehouse_alerts-1", "x": 9, "y": 0, "w": 3, "h": 2},
    {"i": "recent_operations-1", "x": 0, "y": 2, "w": 6, "h": 3},
    {"i": "warehouse_balances-1", "x": 6, "y": 2, "w": 6, "h": 3}
  ]'::jsonb,
  '[
    {"id": "opt_stats-1", "widgetKey": "opt_stats", "x": 0, "y": 0, "w": 3, "h": 2},
    {"id": "refueling_stats-1", "widgetKey": "refueling_stats", "x": 3, "y": 0, "w": 3, "h": 2},
    {"id": "profit_month-1", "widgetKey": "profit_month", "x": 6, "y": 0, "w": 3, "h": 2},
    {"id": "warehouse_alerts-1", "widgetKey": "warehouse_alerts", "x": 9, "y": 0, "w": 3, "h": 2},
    {"id": "recent_operations-1", "widgetKey": "recent_operations", "x": 0, "y": 2, "w": 6, "h": 3},
    {"id": "warehouse_balances-1", "widgetKey": "warehouse_balances", "x": 6, "y": 2, "w": 6, "h": 3}
  ]'::jsonb,
  true,
  true
),
(
  'Финансовая аналитика',
  'Фокус на финансовых показателях и прибыли',
  'system',
  '[
    {"i": "profit_month-1", "x": 0, "y": 0, "w": 4, "h": 2},
    {"i": "week_stats-1", "x": 4, "y": 0, "w": 8, "h": 2},
    {"i": "opt_stats-1", "x": 0, "y": 2, "w": 6, "h": 2},
    {"i": "refueling_stats-1", "x": 6, "y": 2, "w": 6, "h": 2}
  ]'::jsonb,
  '[
    {"id": "profit_month-1", "widgetKey": "profit_month", "x": 0, "y": 0, "w": 4, "h": 2},
    {"id": "week_stats-1", "widgetKey": "week_stats", "x": 4, "y": 0, "w": 8, "h": 2},
    {"id": "opt_stats-1", "widgetKey": "opt_stats", "x": 0, "y": 2, "w": 6, "h": 2},
    {"id": "refueling_stats-1", "widgetKey": "refueling_stats", "x": 6, "y": 2, "w": 6, "h": 2}
  ]'::jsonb,
  true,
  true
),
(
  'Склады и логистика',
  'Мониторинг складов и операций',
  'system',
  '[
    {"i": "warehouse_balances-1", "x": 0, "y": 0, "w": 6, "h": 3},
    {"i": "warehouse_alerts-1", "x": 6, "y": 0, "w": 6, "h": 3},
    {"i": "recent_operations-1", "x": 0, "y": 3, "w": 12, "h": 3}
  ]'::jsonb,
  '[
    {"id": "warehouse_balances-1", "widgetKey": "warehouse_balances", "x": 0, "y": 0, "w": 6, "h": 3},
    {"id": "warehouse_alerts-1", "widgetKey": "warehouse_alerts", "x": 6, "y": 0, "w": 6, "h": 3},
    {"id": "recent_operations-1", "widgetKey": "recent_operations", "x": 0, "y": 3, "w": 12, "h": 3}
  ]'::jsonb,
  true,
  true
);
