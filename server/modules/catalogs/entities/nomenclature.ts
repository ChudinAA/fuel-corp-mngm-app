import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "../../users/entities/users";

const auditColumns = () => ({
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  createdById: uuid("created_by_id").references(() => users.id),
  updatedById: uuid("updated_by_id").references(() => users.id),
  deletedAt: timestamp("deleted_at", { mode: "string" }),
  deletedById: uuid("deleted_by_id").references(() => users.id),
});

export const nomenclatureTypes = pgTable(
  "nomenclature_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    id1c: text("id_1c"),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    ...auditColumns(),
  },
  (table) => ({ nameIdx: index("nomenclature_types_name_idx").on(table.name) }),
);

export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    id1c: text("id_1c"),
    shortName: text("short_name").notNull(),
    fullName: text("full_name").notNull(),
    conversionFactor: decimal("conversion_factor", { precision: 18, scale: 6 }),
    ...auditColumns(),
  },
  (table) => ({
    shortNameIdx: index("units_of_measure_short_name_idx").on(table.shortName),
  }),
);

export const nomenclature = pgTable(
  "nomenclature",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    id1c: text("id_1c"),
    nomenclatureTypeId: uuid("nomenclature_type_id")
      .notNull()
      .references(() => nomenclatureTypes.id),
    name: text("name").notNull(),
    unitId: uuid("unit_id").notNull().references(() => unitsOfMeasure.id),
    isDefault: boolean("is_default").notNull().default(false),
    ...auditColumns(),
  },
  (table) => ({
    typeIdx: index("nomenclature_type_idx").on(table.nomenclatureTypeId),
    unitIdx: index("nomenclature_unit_idx").on(table.unitId),
    oneDefaultPerTypeIdx: uniqueIndex("nomenclature_one_default_per_type_idx")
      .on(table.nomenclatureTypeId)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL`),
  }),
);

export const nomenclatureTypesRelations = relations(nomenclatureTypes, ({ many }) => ({
  items: many(nomenclature),
}));

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ many }) => ({
  items: many(nomenclature),
}));

export const nomenclatureRelations = relations(nomenclature, ({ one }) => ({
  type: one(nomenclatureTypes, {
    fields: [nomenclature.nomenclatureTypeId],
    references: [nomenclatureTypes.id],
  }),
  unit: one(unitsOfMeasure, {
    fields: [nomenclature.unitId],
    references: [unitsOfMeasure.id],
  }),
  createdBy: one(users, { fields: [nomenclature.createdById], references: [users.id] }),
  updatedBy: one(users, { fields: [nomenclature.updatedById], references: [users.id] }),
}));

const insertAuditOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  deletedById: true,
} as const;

export const insertNomenclatureTypeSchema = createInsertSchema(nomenclatureTypes)
  .omit(insertAuditOmit)
  .extend({ code: z.string().min(1), name: z.string().min(1) });

export const insertUnitOfMeasureSchema = createInsertSchema(unitsOfMeasure)
  .omit(insertAuditOmit)
  .extend({
    shortName: z.string().min(1),
    fullName: z.string().min(1),
    conversionFactor: z.string().nullable().optional(),
  });

export const insertNomenclatureSchema = createInsertSchema(nomenclature)
  .omit(insertAuditOmit)
  .extend({
    nomenclatureTypeId: z.string().uuid(),
    unitId: z.string().uuid(),
    name: z.string().min(1),
    isDefault: z.boolean().optional(),
  });

export type NomenclatureType = typeof nomenclatureTypes.$inferSelect;
export type UnitOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NomenclatureItem = typeof nomenclature.$inferSelect;
