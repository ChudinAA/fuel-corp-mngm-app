import { z } from "zod";

export const allowedCounterpartyTypes = ["supplier", "customer", "carrier"] as const;

export const counterpartySyncItemSchema = z.object({
  type: z.enum(allowedCounterpartyTypes),
  id_1c: z.string().trim().uuid(),
  inn: z.string().trim().max(32).nullable().optional(),
  name: z.string().trim().min(1).max(255),
  full_name: z.string().trim().max(500).nullable().optional(),
  status: z.string().trim().max(64).nullable().optional(),
}).strict();

export const counterpartySyncBatchSchema = z.object({
  items: z.array(counterpartySyncItemSchema).min(1).max(500),
}).strict();

export type CounterpartySyncItem = z.infer<typeof counterpartySyncItemSchema>;
export type CounterpartyType = CounterpartySyncItem["type"];

export function getCounterpartyStatusKind(status: string | null | undefined) {
  if (status == null || status === "") return "unchanged" as const;
  const normalized = status.trim().toLocaleLowerCase("ru-RU");
  if (["deleted", "delete", "deletion_marked", "пометка удаления", "удален", "удалён"].includes(normalized)) {
    return "deleted" as const;
  }
  if (["active", "enabled", "активен", "действующий"].includes(normalized)) {
    return "active" as const;
  }
  return "unknown" as const;
}
