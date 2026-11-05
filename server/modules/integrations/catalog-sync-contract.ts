import { z } from "zod";

const externalId = z.string().trim().uuid();
const status = z.string().trim().max(64).nullable().optional();
const batch = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item).min(1).max(500) }).strict();
const positiveDecimal = z.union([
  z.number().finite().positive().transform(String),
  z.string().trim().refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, "Значение должно быть положительным числом"),
]);

export const contractSyncItemSchema = z.object({
  id_1c: externalId,
  contract_name: z.string().trim().min(1).max(500),
  contract_number: z.string().trim().min(1).max(120),
  contract_date: z.string().date(),
  counterparty_type: z.enum(["supplier", "customer", "carrier"]),
  counterparty_id_1c: externalId,
  parent_contract_id_1c: externalId.nullable().optional(),
  status,
}).strict();
export const contractSyncBatchSchema = batch(contractSyncItemSchema);

export const nomenclatureTypeSyncItemSchema = z.object({
  id_1c: externalId,
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  status,
}).strict();
export const nomenclatureTypeSyncBatchSchema = batch(nomenclatureTypeSyncItemSchema);

export const unitSyncItemSchema = z.object({
  id_1c: externalId,
  short_name: z.string().trim().min(1).max(80),
  full_name: z.string().trim().min(1).max(255),
  conversion_factor: positiveDecimal.nullable().optional(),
  reference_unit_id_1c: externalId.nullable().optional(),
  status,
}).strict();
export const unitSyncBatchSchema = batch(unitSyncItemSchema);

export const nomenclatureSyncItemSchema = z.object({
  id_1c: externalId,
  product_type: z.enum(["kerosene", "pvkj", "service"]),
  nomenclature_type_id_1c: externalId.nullable().optional(),
  name: z.string().trim().min(1).max(255),
  unit_id_1c: externalId,
  is_default: z.boolean().optional(),
  status,
}).strict();
export const nomenclatureSyncBatchSchema = batch(nomenclatureSyncItemSchema);

export function getCatalogStatusKind(value: string | null | undefined) {
  if (value == null || value === "") return "unchanged" as const;
  const normalized = value.trim().toLocaleLowerCase("ru-RU");
  if (["deleted", "delete", "deletion_marked", "пометка удаления", "удален", "удалён"].includes(normalized)) {
    return "deleted" as const;
  }
  if (["active", "updated", "enabled", "активен", "действующий"].includes(normalized)) {
    return "active" as const;
  }
  return "unknown" as const;
}
