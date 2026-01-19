
-- Добавляем определения виджетов
INSERT INTO widget_definitions (widget_key, name, description, category, default_width, default_height, min_width, min_height, required_permissions, is_active) VALUES
('opt_stats', 'Оптовые сделки сегодня', 'Количество оптовых сделок за текущий день', 'statistics', 3, 2, 2, 2, ARRAY['opt.view'], true),
('refueling_stats', 'Заправки ВС сегодня', 'Количество заправок воздушных судов за день', 'statistics', 3, 2, 2, 2, ARRAY['refueling.view'], true),
('profit_month', 'Прибыль за месяц', 'Общая прибыль за текущий месяц', 'finance', 3, 2, 2, 2, ARRAY['opt.view', 'refueling.view'], true),
('warehouse_alerts', 'Оповещения складов', 'Количество складов с критическим остатком', 'warehouses', 3, 2, 2, 2, ARRAY['warehouses.view'], true),
('recent_operations', 'Последние операции', 'Недавние сделки и перемещения', 'operations', 6, 4, 4, 3, ARRAY['opt.view', 'refueling.view', 'movement.view'], true),
('warehouse_balances', 'Балансы складов', 'Текущее состояние складов', 'warehouses', 6, 4, 4, 3, ARRAY['warehouses.view'], true),
('week_stats', 'Статистика за неделю', 'Показатели за последние 7 дней', 'analytics', 6, 3, 4, 2, ARRAY['opt.view', 'refueling.view'], true)
ON CONFLICT (widget_key) DO NOTHING;
