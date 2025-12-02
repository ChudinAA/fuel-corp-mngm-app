import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, boolean, timestamp, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ ROLES & PERMISSIONS ============

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array(), // массив разрешений в формате "module.action"
  isDefault: boolean("is_default").default(false),
  isSystem: boolean("is_system").default(false),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(), // opt, refueling, exchange, movement, warehouses, prices, delivery_cost, directories, admin
  action: text("action").notNull(), // view, create, edit, delete
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
});

// ============ USERS ============

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  patronymic: text("patronymic"),
  roleId: integer("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============ DIRECTORIES (Справочники) ============

// Directory: Wholesale Trade (Оптовая торговля)
export const directoryWholesale = pgTable("directory_wholesale", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // supplier (поставщик), buyer (покупатель), basis (базис)
  name: text("name").notNull(),
  description: text("description"),
  basis: text("basis"), // базис - место отгрузки для поставщиков
  inn: text("inn"),
  contractNumber: text("contract_number"),
  isActive: boolean("is_active").default(true),
});

// Directory: Aircraft Refueling (Заправки воздушных судов)
export const directoryRefueling = pgTable("directory_refueling", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // airport (аэропорт/поставщик), buyer (покупатель), service (услуга)
  name: text("name").notNull(),
  description: text("description"),
  basis: text("basis"), // базис заправки
  refuelingServicePrice: decimal("refueling_service_price", { precision: 12, scale: 2 }),
  pvkjPrice: decimal("pvkj_price", { precision: 12, scale: 2 }),
  agentFee: decimal("agent_fee", { precision: 12, scale: 2 }),
  storagePrice: decimal("storage_price", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
});

// Directory: Logistics (Логистика)
export const directoryLogistics = pgTable("directory_logistics", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // delivery_location (место доставки), carrier (перевозчик), vehicle (госномер), trailer (госномер ПП), driver (ФИО водителя), warehouse (склад/базис)
  name: text("name").notNull(),
  description: text("description"),
  carrierId: integer("carrier_id"), // для связи машин и водителей с перевозчиком
  storageCost: decimal("storage_cost", { precision: 12, scale: 2 }), // стоимость хранения для складов
  isActive: boolean("is_active").default(true),
});

// ============ PRICES (Цены) ============

export const prices = pgTable("prices", {
  id: serial("id").primaryKey(),
  priceType: text("price_type").notNull(), // purchase (закупка), sale (продажа)
  productType: text("product_type").notNull(), // kerosine, service, pvkj, agent, storage
  counterpartyId: integer("counterparty_id").notNull(),
  counterpartyType: text("counterparty_type").notNull(), // wholesale, refueling
  counterpartyRole: text("counterparty_role").notNull(), // supplier, buyer
  basis: text("basis").notNull(), // обязательное поле
  priceValues: text("price_values").array(), // JSON array для хранения нескольких цен [{"price":32.50},{"price":30.50}]
  volume: decimal("volume", { precision: 15, scale: 2 }), // объем по договору
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(), // обязательное поле
  contractNumber: text("contract_number"),
  contractAppendix: text("contract_appendix"),
  soldVolume: decimal("sold_volume", { precision: 15, scale: 2 }).default("0"), // выборка - автоматический расчет
  dateCheckWarning: text("date_check_warning"), // индикатор проверки дат (null, warning, error)
  isActive: boolean("is_active").default(true),
});

// ============ DELIVERY COST (Стоимость доставки) ============

export const deliveryCost = pgTable("delivery_cost", {
  id: serial("id").primaryKey(),
  carrierId: integer("carrier_id").notNull(), // перевозчик из directoryLogistics
  basis: text("basis").notNull(), // базис отправления
  deliveryLocationId: integer("delivery_location_id").notNull(), // место доставки из directoryLogistics
  tariff: decimal("tariff", { precision: 12, scale: 4 }).notNull(), // тариф за кг
  isActive: boolean("is_active").default(true),
});

// ============ WAREHOUSES (Склады) ============

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // service (служба), airport (аэропорт), tk_tvk (ТК ТВК), gpn (ГПН), gpna (ГПНА)
  basis: text("basis"),
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default("0"),
  averageCost: decimal("average_cost", { precision: 12, scale: 4 }).default("0"),
  monthlyAllocation: decimal("monthly_allocation", { precision: 15, scale: 2 }), // для ГПН и ГПНА
  isActive: boolean("is_active").default(true),
});

// Warehouse transactions for tracking daily receipts and expenses
export const warehouseTransactions = pgTable("warehouse_transactions", {
  id: serial("id").primaryKey(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id),
  transactionDate: date("transaction_date").notNull(),
  transactionType: text("transaction_type").notNull(), // receipt (поступление), expense (расход)
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  price: decimal("price", { precision: 12, scale: 4 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  sourceType: text("source_type"), // opt, refueling, movement, exchange
  sourceId: integer("source_id"),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  averageCostAfter: decimal("average_cost_after", { precision: 12, scale: 4 }),
});

// ============ EXCHANGE (Биржа) ============

export const exchange = pgTable("exchange", {
  id: serial("id").primaryKey(),
  dealDate: date("deal_date").notNull(),
  dealNumber: text("deal_number"),
  counterparty: text("counterparty").notNull(),
  productType: text("product_type").notNull(), // kerosene, pvkj
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 12, scale: 4 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  warehouseId: integer("warehouse_id").references(() => warehouses.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
});

// ============ MOVEMENT (Перемещение) ============

export const movement = pgTable("movement", {
  id: serial("id").primaryKey(),
  movementDate: date("movement_date").notNull(),
  movementType: text("movement_type").notNull(), // supply (поставка), internal (внутреннее перемещение)
  productType: text("product_type").notNull(), // kerosene, pvkj
  supplierId: integer("supplier_id"), // для поставок - поставщик из directoryWholesale
  fromWarehouseId: integer("from_warehouse_id").references(() => warehouses.id), // для внутренних перемещений
  toWarehouseId: integer("to_warehouse_id").notNull().references(() => warehouses.id),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }), // цена закупки или себестоимость
  deliveryPrice: decimal("delivery_price", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }),
  costPerKg: decimal("cost_per_kg", { precision: 12, scale: 4 }), // себестоимость на месте
  carrierId: integer("carrier_id"), // перевозчик
  vehicleNumber: text("vehicle_number"),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
});

// ============ OPT (Оптовые продажи) ============

export const opt = pgTable("opt", {
  id: serial("id").primaryKey(),
  dealDate: date("deal_date").notNull(),
  supplierId: integer("supplier_id").notNull(), // поставщик из directoryWholesale
  buyerId: integer("buyer_id").notNull(), // покупатель из directoryWholesale
  basis: text("basis"), // автоматически по поставщику
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  purchasePriceId: integer("purchase_price_id"), // ссылка на выбранную цену
  salePrice: decimal("sale_price", { precision: 12, scale: 4 }),
  salePriceId: integer("sale_price_id"), // ссылка на выбранную цену
  purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
  carrierId: integer("carrier_id"),
  deliveryLocationId: integer("delivery_location_id"),
  deliveryTariff: decimal("delivery_tariff", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  cumulativeProfit: decimal("cumulative_profit", { precision: 15, scale: 2 }),
  vehicleNumber: text("vehicle_number"),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false), // примерный объем
  warehouseStatus: text("warehouse_status"), // OK / "нет объема!"
  priceStatus: text("price_status"), // OK / "нет цены!"
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
});

// ============ AIRCRAFT REFUELING (Заправка ВС) ============

export const aircraftRefueling = pgTable("aircraft_refueling", {
  id: serial("id").primaryKey(),
  refuelingDate: date("refueling_date").notNull(),
  productType: text("product_type").notNull(), // kerosene, pvkj, service (услуга), storage (хранение), agent (агентские)
  aircraftNumber: text("aircraft_number"), // бортовой номер
  orderNumber: text("order_number"), // номер РТ
  supplierId: integer("supplier_id").notNull(), // поставщик из directoryRefueling
  basis: text("basis"), // автоматически по поставщику
  buyerId: integer("buyer_id").notNull(), // покупатель из directoryRefueling
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  purchasePriceId: integer("purchase_price_id"),
  salePrice: decimal("sale_price", { precision: 12, scale: 4 }),
  salePriceId: integer("sale_price_id"),
  purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  cumulativeProfit: decimal("cumulative_profit", { precision: 15, scale: 2 }),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false),
  warehouseStatus: text("warehouse_status"),
  priceStatus: text("price_status"),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
});

// ============ RELATIONS ============

export const rolesRelations = relations(roles, ({ many }) => ({
  permissions: many(rolePermissions),
  users: many(users),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  transactions: many(warehouseTransactions),
}));

export const warehouseTransactionsRelations = relations(warehouseTransactions, ({ one }) => ({
  warehouse: one(warehouses, { fields: [warehouseTransactions.warehouseId], references: [warehouses.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true });

// Registration schema - for public registration (roleId assigned automatically)
export const registerUserSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
  firstName: z.string().min(1, "Введите имя"),
  lastName: z.string().min(1, "Введите фамилию"),
  patronymic: z.string().optional(),
  confirmPassword: z.string().optional(),
});

// Admin user creation schema - roleId can be specified by admin
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLoginAt: true });

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

export const insertDirectoryWholesaleSchema = createInsertSchema(directoryWholesale).omit({ id: true });
export const insertDirectoryRefuelingSchema = createInsertSchema(directoryRefueling).omit({ id: true });
export const insertDirectoryLogisticsSchema = createInsertSchema(directoryLogistics).omit({ id: true });

export const insertPriceSchema = createInsertSchema(prices).omit({ id: true });
export const insertDeliveryCostSchema = createInsertSchema(deliveryCost).omit({ id: true });
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true });
export const insertWarehouseTransactionSchema = createInsertSchema(warehouseTransactions).omit({ id: true });

export const insertExchangeSchema = createInsertSchema(exchange).omit({ id: true, createdAt: true });
export const insertMovementSchema = createInsertSchema(movement).omit({ id: true, createdAt: true });
export const insertOptSchema = createInsertSchema(opt).omit({ id: true, createdAt: true });
export const insertAircraftRefuelingSchema = createInsertSchema(aircraftRefueling).omit({ id: true, createdAt: true });

// ============ TYPES ============

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

export type DirectoryWholesale = typeof directoryWholesale.$inferSelect;
export type InsertDirectoryWholesale = z.infer<typeof insertDirectoryWholesaleSchema>;

export type DirectoryRefueling = typeof directoryRefueling.$inferSelect;
export type InsertDirectoryRefueling = z.infer<typeof insertDirectoryRefuelingSchema>;

export type DirectoryLogistics = typeof directoryLogistics.$inferSelect;
export type InsertDirectoryLogistics = z.infer<typeof insertDirectoryLogisticsSchema>;

export type Price = typeof prices.$inferSelect;
export type InsertPrice = z.infer<typeof insertPriceSchema>;

export type DeliveryCost = typeof deliveryCost.$inferSelect;
export type InsertDeliveryCost = z.infer<typeof insertDeliveryCostSchema>;

export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;

export type WarehouseTransaction = typeof warehouseTransactions.$inferSelect;
export type InsertWarehouseTransaction = z.infer<typeof insertWarehouseTransactionSchema>;

export type Exchange = typeof exchange.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;

export type Movement = typeof movement.$inferSelect;
export type InsertMovement = z.infer<typeof insertMovementSchema>;

export type Opt = typeof opt.$inferSelect;
export type InsertOpt = z.infer<typeof insertOptSchema>;

export type AircraftRefueling = typeof aircraftRefueling.$inferSelect;
export type InsertAircraftRefueling = z.infer<typeof insertAircraftRefuelingSchema>;

// Module names for permissions
export const MODULES = [
  "opt",
  "refueling", 
  "exchange",
  "movement",
  "warehouses",
  "prices",
  "delivery_cost",
  "directories",
  "admin"
] as const;

export const ACTIONS = ["view", "create", "edit", "delete"] as const;

// Default roles
export const DEFAULT_ROLES = [
  { name: "Ген.дир", description: "Генеральный директор" },
  { name: "Админ", description: "Администратор системы" },
  { name: "Глав.бух", description: "Главный бухгалтер" },
  { name: "Коммерческий директор", description: "Коммерческий директор" },
  { name: "Руководитель проекта", description: "Руководитель проекта" },
  { name: "Ведущий менеджер", description: "Ведущий менеджер" },
  { name: "Руководитель подразделения", description: "Руководитель подразделения" },
  { name: "Менеджер", description: "Менеджер" },
  { name: "Операционист", description: "Операционист" },
  { name: "Оператор подразделения", description: "Оператор подразделения" },
] as const;

// Product types for refueling
export const PRODUCT_TYPES = [
  { value: "kerosene", label: "Керосин" },
  { value: "pvkj", label: "ПВКЖ" },
  { value: "service", label: "Услуга" },
  { value: "storage", label: "Хранение" },
  { value: "agent", label: "Агентские" },
] as const;
