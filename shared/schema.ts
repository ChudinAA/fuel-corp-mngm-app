import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, date, boolean, timestamp, jsonb, serial, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============ ROLES & PERMISSIONS ============

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  permissions: text("permissions").array(),
  isDefault: boolean("is_default").default(false),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  module: text("module").notNull(),
  action: text("action").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ USERS ============

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  roleId: uuid("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ UNIFIED DIRECTORIES ============

// Единая таблица покупателей (для ОПТ и Заправки ВС)
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inn: text("inn"),
  contractNumber: text("contract_number"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  module: text("module").notNull(), // "wholesale", "refueling", "both"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ UNIFIED DIRECTORIES ============

// Unified Bases (for both wholesale and refueling)
export const bases = pgTable("bases", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  baseType: text("base_type").notNull(), // 'wholesale' or 'refueling'
  location: text("location"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Unified Suppliers (for both wholesale and refueling)
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  baseIds: text("base_ids").array(),
  servicePrice: decimal("service_price", { precision: 12, scale: 2 }),
  pvkjPrice: decimal("pvkj_price", { precision: 12, scale: 2 }),
  agentFee: decimal("agent_fee", { precision: 12, scale: 2 }),
  isWarehouse: boolean("is_warehouse").default(false),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  storageCost: decimal("storage_cost", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ DIRECTORIES: Логистика ============

// Перевозчики
export const logisticsCarriers = pgTable("logistics_carriers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inn: text("inn"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Места доставки
export const logisticsDeliveryLocations = pgTable("logistics_delivery_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Транспорт
export const logisticsVehicles = pgTable("logistics_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, { onDelete: "set null" }),
  regNumber: text("reg_number").notNull(),
  model: text("model"),
  capacityKg: decimal("capacity_kg", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Прицепы
export const logisticsTrailers = pgTable("logistics_trailers", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, { onDelete: "set null" }),
  regNumber: text("reg_number").notNull(),
  capacityKg: decimal("capacity_kg", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// Водители
export const logisticsDrivers = pgTable("logistics_drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ PRICES (Цены) ============

export const prices = pgTable("prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  productType: text("product_type").notNull(),
  counterpartyId: uuid("counterparty_id").notNull(),
  counterpartyType: text("counterparty_type").notNull(),
  counterpartyRole: text("counterparty_role").notNull(),
  basis: text("basis").notNull(),
  priceValues: text("price_values").array(),
  volume: decimal("volume", { precision: 15, scale: 2 }),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  contractNumber: text("contract_number"),
  contractAppendix: text("contract_appendix"),
  notes: text("notes"),
  soldVolume: decimal("sold_volume", { precision: 15, scale: 2 }).default("0"),
  dateCheckWarning: text("date_check_warning"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ DELIVERY COST (Стоимость доставки) ============

export const deliveryCost = pgTable("delivery_cost", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").notNull(),
  fromEntityType: text("from_entity_type").notNull(), // "base", "warehouse", "delivery_location"
  fromEntityId: uuid("from_entity_id").notNull(),
  fromLocation: text("from_location").notNull(),
  toEntityType: text("to_entity_type").notNull(), // "base", "warehouse", "delivery_location"
  toEntityId: uuid("to_entity_id").notNull(),
  toLocation: text("to_location").notNull(),
  costPerKg: decimal("cost_per_kg", { precision: 12, scale: 4 }).notNull(),
  distance: decimal("distance", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ WAREHOUSES (Склады) ============

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  baseIds: text("base_ids").array(), // Changed from baseId to array
  supplierId: uuid("supplier_id"), // Link to auto-created supplier
  currentBalance: decimal("current_balance", { precision: 15, scale: 2 }).default("0"),
  averageCost: decimal("average_cost", { precision: 12, scale: 4 }).default("0"),
  pvkjBalance: decimal("pvkj_balance", { precision: 15, scale: 2 }).default("0"),
  pvkjAverageCost: decimal("pvkj_average_cost", { precision: 12, scale: 4 }).default("0"),
  storageCost: decimal("storage_cost", { precision: 12, scale: 2 }), // Moved from logistics
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

export const warehouseTransactions = pgTable("warehouse_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
  transactionType: text("transaction_type").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  balanceBefore: decimal("balance_before", { precision: 15, scale: 2 }),
  balanceAfter: decimal("balance_after", { precision: 15, scale: 2 }),
  averageCostBefore: decimal("average_cost_before", { precision: 12, scale: 4 }),
  averageCostAfter: decimal("average_cost_after", { precision: 12, scale: 4 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ EXCHANGE (Биржа) ============

export const exchange = pgTable("exchange", {
  id: uuid("id").defaultRandom().primaryKey(),
  dealDate: date("deal_date").notNull(),
  dealNumber: text("deal_number"),
  counterparty: text("counterparty").notNull(),
  productType: text("product_type").notNull(),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 12, scale: 4 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
});

// ============ MOVEMENT (Перемещение) ============

export const movement = pgTable("movement", {
  id: uuid("id").defaultRandom().primaryKey(),
  movementDate: date("movement_date").notNull(),
  movementType: text("movement_type").notNull(),
  productType: text("product_type").notNull(),
  supplierId: uuid("supplier_id"),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").notNull().references(() => warehouses.id),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  deliveryPrice: decimal("delivery_price", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }),
  costPerKg: decimal("cost_per_kg", { precision: 12, scale: 4 }),
  carrierId: uuid("carrier_id"),
  vehicleNumber: text("vehicle_number"),
  trailerNumber: text("trailer_number"),
  driverName: text("driver_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ OPT (Оптовые продажи) ============

export const opt = pgTable("opt", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").notNull(),
  buyerId: uuid("buyer_id").notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  transactionId: uuid("transaction_id").references(() => warehouseTransactions.id),
  basis: text("basis"),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  purchasePriceId: uuid("purchase_price_id"),
  salePrice: decimal("sale_price", { precision: 12, scale: 4 }),
  salePriceId: uuid("sale_price_id"),
  purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
  carrierId: uuid("carrier_id"),
  deliveryLocationId: uuid("delivery_location_id"),
  deliveryTariff: decimal("delivery_tariff", { precision: 12, scale: 4 }),
  deliveryCost: decimal("delivery_cost", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false),
  warehouseStatus: text("warehouse_status"),
  priceStatus: text("price_status"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
});

// ============ AIRCRAFT REFUELING (Заправка ВС) ============

export const aircraftRefueling = pgTable("aircraft_refueling", {
  id: uuid("id").defaultRandom().primaryKey(),
  refuelingDate: date("refueling_date").notNull(),
  productType: text("product_type").notNull(),
  aircraftNumber: text("aircraft_number"),
  orderNumber: text("order_number"),
  supplierId: uuid("supplier_id").notNull(),
  basis: text("basis"),
  buyerId: uuid("buyer_id").notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id),
  transactionId: uuid("transaction_id").references(() => warehouseTransactions.id),
  quantityLiters: decimal("quantity_liters", { precision: 15, scale: 2 }),
  density: decimal("density", { precision: 6, scale: 4 }),
  quantityKg: decimal("quantity_kg", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 4 }),
  purchasePriceId: uuid("purchase_price_id"),
  salePrice: decimal("sale_price", { precision: 12, scale: 4 }),
  salePriceId: uuid("sale_price_id"),
  purchaseAmount: decimal("purchase_amount", { precision: 15, scale: 2 }),
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  contractNumber: text("contract_number"),
  notes: text("notes"),
  isApproxVolume: boolean("is_approx_volume").default(false),
  warehouseStatus: text("warehouse_status"),
  priceStatus: text("price_status"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
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

export const logisticsVehiclesRelations = relations(logisticsVehicles, ({ one }) => ({
  carrier: one(logisticsCarriers, { fields: [logisticsVehicles.carrierId], references: [logisticsCarriers.id] }),
}));

export const logisticsTrailersRelations = relations(logisticsTrailers, ({ one }) => ({
  carrier: one(logisticsCarriers, { fields: [logisticsTrailers.carrierId], references: [logisticsCarriers.id] }),
}));

export const logisticsDriversRelations = relations(logisticsDrivers, ({ one }) => ({
  carrier: one(logisticsCarriers, { fields: [logisticsDrivers.carrierId], references: [logisticsCarriers.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true });

export const registerUserSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
  firstName: z.string().min(1, "Введите имя"),
  lastName: z.string().min(1, "Введите фамилию"),
  confirmPassword: z.string().optional(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLoginAt: true });

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен быть не менее 6 символов"),
});

// Directory schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export const insertBaseSchema = createInsertSchema(bases).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });

export const insertLogisticsCarrierSchema = createInsertSchema(logisticsCarriers).omit({ id: true });
export const insertLogisticsDeliveryLocationSchema = createInsertSchema(logisticsDeliveryLocations).omit({ id: true });
export const insertLogisticsVehicleSchema = createInsertSchema(logisticsVehicles).omit({ id: true });
export const insertLogisticsTrailerSchema = createInsertSchema(logisticsTrailers).omit({ id: true });
export const insertLogisticsDriverSchema = createInsertSchema(logisticsDrivers).omit({ id: true });

export const insertPriceSchema = createInsertSchema(prices).omit({ id: true });
export const insertDeliveryCostSchema = createInsertSchema(deliveryCost).omit({ id: true });
export const insertWarehouseSchema = z.object({
  name: z.string().min(1),
  baseIds: z.array(z.string()).optional(),
  supplierId: z.string().uuid().optional().nullable(),
  storageCost: z.string().optional().nullable(),
  pvkjBalance: z.string().optional().nullable(),
  pvkjAverageCost: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  createdById: z.string().uuid(),
});
export const insertWarehouseTransactionSchema = createInsertSchema(warehouseTransactions).omit({ id: true });

export const insertExchangeSchema = createInsertSchema(exchange).omit({ id: true, createdAt: true });
export const insertMovementSchema = z.object({
  movementDate: z.string(),
  movementType: z.string(),
  productType: z.string(),
  supplierId: z.string().nullable().optional(),
  fromWarehouseId: z.string().nullable().optional(),
  toWarehouseId: z.string(),
  quantityLiters: z.number().nullable().optional(),
  density: z.number().nullable().optional(),
  quantityKg: z.number(),
  purchasePrice: z.number().nullable().optional(),
  deliveryPrice: z.number().nullable().optional(),
  deliveryCost: z.number().nullable().optional(),
  totalCost: z.number().nullable().optional(),
  costPerKg: z.number().nullable().optional(),
  carrierId: z.string().nullable().optional(),
  vehicleNumber: z.string().nullable().optional(),
  trailerNumber: z.string().nullable().optional(),
  driverName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
});
export const insertOptSchema = z.object({
  supplierId: z.string(),
  buyerId: z.string(),
  warehouseId: z.string().nullable().optional(),
  basis: z.string().nullable().optional(),
  quantityLiters: z.number().nullable().optional(),
  density: z.number().nullable().optional(),
  quantityKg: z.number(),
  purchasePrice: z.number().nullable().optional(),
  purchasePriceId: z.string().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  salePriceId: z.string().nullable().optional(),
  purchaseAmount: z.number().nullable().optional(),
  saleAmount: z.number().nullable().optional(),
  carrierId: z.string().nullable().optional(),
  deliveryLocationId: z.string().nullable().optional(),
  deliveryTariff: z.number().nullable().optional(),
  deliveryCost: z.number().nullable().optional(),
  profit: z.number().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isApproxVolume: z.boolean().optional(),
  warehouseStatus: z.string().nullable().optional(),
  priceStatus: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
  updatedById: z.string().nullable().optional()
});
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

// Directory types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Base = typeof bases.$inferSelect;
export type InsertBase = z.infer<typeof insertBaseSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type LogisticsCarrier = typeof logisticsCarriers.$inferSelect;
export type InsertLogisticsCarrier = z.infer<typeof insertLogisticsCarrierSchema>;

export type LogisticsDeliveryLocation = typeof logisticsDeliveryLocations.$inferSelect;
export type InsertLogisticsDeliveryLocation = z.infer<typeof insertLogisticsDeliveryLocationSchema>;

export type LogisticsVehicle = typeof logisticsVehicles.$inferSelect;
export type InsertLogisticsVehicle = z.infer<typeof insertLogisticsVehicleSchema>;

export type LogisticsTrailer = typeof logisticsTrailers.$inferSelect;
export type InsertLogisticsTrailer = z.infer<typeof insertLogisticsTrailerSchema>;

export type LogisticsDriver = typeof logisticsDrivers.$inferSelect;
export type InsertLogisticsDriver = z.infer<typeof insertLogisticsDriverSchema>;

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