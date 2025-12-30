
import { pgTable, uuid, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "../../users/entities/users";

// Таблица для хранения пользовательских настроек экспорта
export const exportConfigurations = pgTable("export_configurations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  moduleName: text("module_name").notNull(), // 'opt', 'refueling', etc.
  configName: text("config_name").notNull(),
  selectedColumns: jsonb("selected_columns").$type<string[]>().notNull(),
  filters: jsonb("filters"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

// Конфигурация колонок для каждого модуля
export interface ColumnConfig {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  exportable: boolean;
  requiredPermission?: string; // Необходимое разрешение для экспорта
  sensitive?: boolean; // Чувствительные данные
  format?: (value: any) => string; // Функция форматирования
}

export interface ModuleExportConfig {
  moduleName: string;
  tableName: string;
  displayName: string;
  columns: ColumnConfig[];
  defaultColumns: string[]; // Колонки по умолчанию
  relations?: string[]; // Связанные таблицы для join
}
