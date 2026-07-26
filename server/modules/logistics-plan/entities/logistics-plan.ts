import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";
import { logisticsCarriers, logisticsVehicles, logisticsTrailers, logisticsDrivers } from "../../logistics/entities/logistics";
import { planningScenarios } from "../../planning/entities/planning";
import { deliveryCost } from "../../delivery/entities/delivery";

// ============ TRANSPORT UNITS (Связка: перевозчик + тягач + прицеп + водитель) ============

export const logisticsTransportUnits = pgTable("logistics_transport_units", {
  id: uuid("id").defaultRandom().primaryKey(),
  carrierId: uuid("carrier_id").references(() => logisticsCarriers.id, { onDelete: "set null" }),
  vehicleId: uuid("vehicle_id").references(() => logisticsVehicles.id, { onDelete: "set null" }),
  trailerId: uuid("trailer_id").references(() => logisticsTrailers.id, { onDelete: "set null" }),
  driverId: uuid("driver_id").references(() => logisticsDrivers.id, { onDelete: "set null" }),
  trailerCapacityM3: decimal("trailer_capacity_m3", { precision: 10, scale: 2 }),
  currentLocationEntityType: text("current_location_entity_type"),
  currentLocationEntityId: uuid("current_location_entity_id"),
  currentLocationName: text("current_location_name"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  carrierIdx: index("ltu_carrier_idx").on(table.carrierId),
  vehicleIdx: index("ltu_vehicle_idx").on(table.vehicleId),
  isActiveIdx: index("ltu_is_active_idx").on(table.isActive),
}));

// ============ DRIVER SCHEDULE (Табель водителей) ============

export const logisticsDriverSchedule = pgTable("logistics_driver_schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id").references(() => logisticsDrivers.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'available', 'unavailable', 'vacation', 'sick', 'other'
  dateFrom: timestamp("date_from", { mode: "string" }).notNull(),
  dateTo: timestamp("date_to", { mode: "string" }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  driverIdx: index("lds_driver_idx").on(table.driverId),
  dateFromIdx: index("lds_date_from_idx").on(table.dateFrom),
  dateToIdx: index("lds_date_to_idx").on(table.dateTo),
}));

// ============ VEHICLE AVAILABILITY (Доступность транспорта) ============

export const logisticsVehicleAvailability = pgTable("logistics_vehicle_availability", {
  id: uuid("id").defaultRandom().primaryKey(),
  vehicleId: uuid("vehicle_id").references(() => logisticsVehicles.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'maintenance', 'repair', 'to', 'other'
  dateFrom: timestamp("date_from", { mode: "string" }).notNull(),
  dateTo: timestamp("date_to", { mode: "string" }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  vehicleIdx: index("lva_vehicle_idx").on(table.vehicleId),
  dateFromIdx: index("lva_date_from_idx").on(table.dateFrom),
}));

// ============ PLAN ROUTES (Плановые маршруты логистики) ============

export const logisticsPlanRoutes = pgTable("logistics_plan_routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  transportUnitId: uuid("transport_unit_id").references(() => logisticsTransportUnits.id, { onDelete: "set null" }),
  scenarioId: uuid("scenario_id").references(() => planningScenarios.id, { onDelete: "set null" }),
  syncId: uuid("sync_id"),
  planEntryId: uuid("plan_entry_id"),
  deliveryCostId: uuid("delivery_cost_id").references(() => deliveryCost.id, { onDelete: "set null" }),
  type: text("type").notNull(), // 'route', 'deadhead', 'unavailable'
  status: text("status").notNull().default("manual"), // 'auto', 'manual'
  fromEntityType: text("from_entity_type"),
  fromEntityId: uuid("from_entity_id"),
  fromEntityName: text("from_entity_name"),
  toEntityType: text("to_entity_type"),
  toEntityId: uuid("to_entity_id"),
  toEntityName: text("to_entity_name"),
  dateStart: timestamp("date_start", { mode: "string" }),
  dateEnd: timestamp("date_end", { mode: "string" }),
  priority: integer("priority"),
  isDeadline: boolean("is_deadline").default(false),
  isUnplanned: boolean("is_unplanned").default(false),
  isOptimal: boolean("is_optimal").default(true),
  isLate: boolean("is_late").default(false),
  unavailabilityReason: text("unavailability_reason"),
  notes: text("notes"),
  periodFrom: timestamp("period_from", { mode: "string" }),
  periodTo: timestamp("period_to", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  transportUnitIdx: index("lpr_transport_unit_idx").on(table.transportUnitId),
  scenarioIdx: index("lpr_scenario_idx").on(table.scenarioId),
  dateStartIdx: index("lpr_date_start_idx").on(table.dateStart),
  periodIdx: index("lpr_period_idx").on(table.periodFrom, table.periodTo),
}));

// ============ PLAN COMMENTS (Комментарии к маршрутам) ============

export const logisticsPlanComments = pgTable("logistics_plan_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  routeId: uuid("route_id").references(() => logisticsPlanRoutes.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  isAdmin: boolean("is_admin").default(false),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdById: uuid("created_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
}, (table) => ({
  routeIdx: index("lpc_route_idx").on(table.routeId),
  isReadIdx: index("lpc_is_read_idx").on(table.isRead),
}));

// ============ MONTHLY SYNC (Синхронизация с ежемесячным планом) ============

export const logisticsMonthlySyncs = pgTable("logistics_monthly_syncs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scenarioId: uuid("scenario_id").references(() => planningScenarios.id, { onDelete: "set null" }),
  periodFrom: timestamp("period_from", { mode: "string" }),
  periodTo: timestamp("period_to", { mode: "string" }),
  status: text("status").notNull().default("active"), // 'active', 'outdated'
  snapshotData: jsonb("snapshot_data"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
}, (table) => ({
  scenarioIdx: index("lms_scenario_idx").on(table.scenarioId),
  periodIdx: index("lms_period_idx").on(table.periodFrom, table.periodTo),
}));

// ============ NOTIFICATIONS (Уведомления) ============

export const logisticsPlanNotifications = pgTable("logistics_plan_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  syncId: uuid("sync_id").references(() => logisticsMonthlySyncs.id, { onDelete: "cascade" }),
  routeId: uuid("route_id"),
  type: text("type").notNull(), // 'change', 'unassigned', 'deadline', 'unplanned', 'non_optimal', 'late'
  message: text("message").notNull(),
  details: jsonb("details"),
  isRead: boolean("is_read").default(false),
  periodFrom: timestamp("period_from", { mode: "string" }),
  periodTo: timestamp("period_to", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => ({
  syncIdx: index("lpn_sync_idx").on(table.syncId),
  isReadIdx: index("lpn_is_read_idx").on(table.isRead),
  periodIdx: index("lpn_period_idx").on(table.periodFrom, table.periodTo),
}));

// ============ EXTRA DRIVERS (Дополнительные водители на ТС) ============

export const logisticsUnitExtraDrivers = pgTable("logistics_unit_extra_drivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  transportUnitId: uuid("transport_unit_id").notNull().references(() => logisticsTransportUnits.id, { onDelete: "cascade" }),
  driverId: uuid("driver_id").notNull().references(() => logisticsDrivers.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
}, (table) => ({
  unitIdx: index("lued_unit_idx").on(table.transportUnitId),
  driverIdx2: index("lued_driver_idx").on(table.driverId),
}));

export const insertLogisticsUnitExtraDriverSchema = z.object({
  transportUnitId: z.string().uuid(),
  driverId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

export type LogisticsUnitExtraDriver = typeof logisticsUnitExtraDrivers.$inferSelect;

// ============ RELATIONS ============

export const logisticsTransportUnitsRelations = relations(logisticsTransportUnits, ({ one, many }) => ({
  carrier: one(logisticsCarriers, { fields: [logisticsTransportUnits.carrierId], references: [logisticsCarriers.id] }),
  vehicle: one(logisticsVehicles, { fields: [logisticsTransportUnits.vehicleId], references: [logisticsVehicles.id] }),
  trailer: one(logisticsTrailers, { fields: [logisticsTransportUnits.trailerId], references: [logisticsTrailers.id] }),
  driver: one(logisticsDrivers, { fields: [logisticsTransportUnits.driverId], references: [logisticsDrivers.id] }),
  planRoutes: many(logisticsPlanRoutes),
}));

export const logisticsDriverScheduleRelations = relations(logisticsDriverSchedule, ({ one }) => ({
  driver: one(logisticsDrivers, { fields: [logisticsDriverSchedule.driverId], references: [logisticsDrivers.id] }),
}));

export const logisticsVehicleAvailabilityRelations = relations(logisticsVehicleAvailability, ({ one }) => ({
  vehicle: one(logisticsVehicles, { fields: [logisticsVehicleAvailability.vehicleId], references: [logisticsVehicles.id] }),
}));

export const logisticsPlanRoutesRelations = relations(logisticsPlanRoutes, ({ one, many }) => ({
  transportUnit: one(logisticsTransportUnits, { fields: [logisticsPlanRoutes.transportUnitId], references: [logisticsTransportUnits.id] }),
  scenario: one(planningScenarios, { fields: [logisticsPlanRoutes.scenarioId], references: [planningScenarios.id] }),
  deliveryCost: one(deliveryCost, { fields: [logisticsPlanRoutes.deliveryCostId], references: [deliveryCost.id] }),
  comments: many(logisticsPlanComments),
}));

export const logisticsPlanCommentsRelations = relations(logisticsPlanComments, ({ one }) => ({
  route: one(logisticsPlanRoutes, { fields: [logisticsPlanComments.routeId], references: [logisticsPlanRoutes.id] }),
  createdBy: one(users, { fields: [logisticsPlanComments.createdById], references: [users.id] }),
}));

export const logisticsMonthlySyncsRelations = relations(logisticsMonthlySyncs, ({ one, many }) => ({
  scenario: one(planningScenarios, { fields: [logisticsMonthlySyncs.scenarioId], references: [planningScenarios.id] }),
  notifications: many(logisticsPlanNotifications),
}));

export const logisticsPlanNotificationsRelations = relations(logisticsPlanNotifications, ({ one }) => ({
  sync: one(logisticsMonthlySyncs, { fields: [logisticsPlanNotifications.syncId], references: [logisticsMonthlySyncs.id] }),
}));

// ============ INSERT SCHEMAS ============

export const insertLogisticsTransportUnitSchema = createInsertSchema(logisticsTransportUnits).omit({ id: true });
export const insertLogisticsDriverScheduleSchema = createInsertSchema(logisticsDriverSchedule).omit({ id: true });
export const insertLogisticsVehicleAvailabilitySchema = createInsertSchema(logisticsVehicleAvailability).omit({ id: true });
export const insertLogisticsPlanRouteSchema = createInsertSchema(logisticsPlanRoutes).omit({ id: true });
export const insertLogisticsPlanCommentSchema = createInsertSchema(logisticsPlanComments).omit({ id: true });
export const insertLogisticsMonthlySyncSchema = createInsertSchema(logisticsMonthlySyncs).omit({ id: true });
export const insertLogisticsPlanNotificationSchema = createInsertSchema(logisticsPlanNotifications).omit({ id: true });

// ============ TYPES ============

export type LogisticsTransportUnit = typeof logisticsTransportUnits.$inferSelect;
export type InsertLogisticsTransportUnit = z.infer<typeof insertLogisticsTransportUnitSchema>;

export type LogisticsDriverSchedule = typeof logisticsDriverSchedule.$inferSelect;
export type InsertLogisticsDriverSchedule = z.infer<typeof insertLogisticsDriverScheduleSchema>;

export type LogisticsVehicleAvailability = typeof logisticsVehicleAvailability.$inferSelect;
export type InsertLogisticsVehicleAvailability = z.infer<typeof insertLogisticsVehicleAvailabilitySchema>;

export type LogisticsPlanRoute = typeof logisticsPlanRoutes.$inferSelect;
export type InsertLogisticsPlanRoute = z.infer<typeof insertLogisticsPlanRouteSchema>;

export type LogisticsPlanComment = typeof logisticsPlanComments.$inferSelect;
export type InsertLogisticsPlanComment = z.infer<typeof insertLogisticsPlanCommentSchema>;

export type LogisticsMonthlySync = typeof logisticsMonthlySyncs.$inferSelect;
export type InsertLogisticsMonthlySync = z.infer<typeof insertLogisticsMonthlySyncSchema>;

export type LogisticsPlanNotification = typeof logisticsPlanNotifications.$inferSelect;
export type InsertLogisticsPlanNotification = z.infer<typeof insertLogisticsPlanNotificationSchema>;
