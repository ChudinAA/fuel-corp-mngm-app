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
import type { AnyPgColumn } from "drizzle-orm/pg-core";
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
    referenceNomenclatureId: uuid("reference_nomenclature_id").references((): AnyPgColumn => nomenclature.id),
    referenceUnitId: uuid("reference_unit_id").references((): AnyPgColumn => unitsOfMeasure.id),
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
      .references(() => nomenclatureTypes.id),
    productType: text("product_type"),
    name: text("name").notNull(),
    unitId: uuid("unit_id").notNull().references(() => unitsOfMeasure.id),
    isDefault: boolean("is_default").notNull().default(false),
    ...auditColumns(),
  },
  (table) => ({
    typeIdx: index("nomenclature_type_idx").on(table.nomenclatureTypeId),
    unitIdx: index("nomenclature_unit_idx").on(table.unitId),
    oneDefaultPerProductIdx: uniqueIndex("nomenclature_one_default_per_product_idx")
      .on(table.productType)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL AND ${table.productType} IS NOT NULL`),
  }),
);

export const nomenclatureTypesRelations = relations(nomenclatureTypes, ({ many }) => ({
  items: many(nomenclature),
}));

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ one, many }) => ({
  items: many(nomenclature),
  referenceNomenclature: one(nomenclature, {
    fields: [unitsOfMeasure.referenceNomenclatureId],
    references: [nomenclature.id],
    relationName: "unitReferenceNomenclature",
  }),
  referenceUnit: one(unitsOfMeasure, {
    fields: [unitsOfMeasure.referenceUnitId],
    references: [unitsOfMeasure.id],
    relationName: "unitConversion",
  }),
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
  .omit({ ...insertAuditOmit, referenceNomenclatureId: true })
  .extend({
    shortName: z.string().min(1),
    fullName: z.string().min(1),
    conversionFactor: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, "Кратность должна быть положительным числом").nullable().optional(),
    referenceUnitId: z.string().uuid().nullable().optional(),
  });

export const insertNomenclatureSchema = createInsertSchema(nomenclature)
  .omit(insertAuditOmit)
  .extend({
    nomenclatureTypeId: z.string().uuid().nullable().optional(),
    productType: z.enum(["kerosene", "pvkj", "service"]),
    unitId: z.string().uuid(),
    name: z.string().min(1),
    isDefault: z.boolean().optional(),
  });

export type NomenclatureType = typeof nomenclatureTypes.$inferSelect;
export type UnitOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NomenclatureItem = typeof nomenclature.$inferSelect;
