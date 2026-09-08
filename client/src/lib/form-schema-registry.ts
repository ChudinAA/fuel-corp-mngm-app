/**
 * Единый реестр форм-схем для автоматического извлечения меток полей.
 *
 * КАК ИСПОЛЬЗОВАТЬ при добавлении нового поля:
 * 1. Добавьте поле в Zod-схему своей формы с .describe("Русское название"):
 *    newField: z.string().optional().describe("Название нового поля"),
 * 2. Это всё — метка автоматически появится в аудите без правки field-labels.ts.
 *
 * Для добавления новой сущности:
 * 1. Импортируйте её схему ниже
 * 2. Вызовите registerZodSchema("entity_type", schema)
 *
 * Для полей, которых нет в форме (вычисляемые, DB-only), метки
 * по-прежнему берутся из статического FIELD_LABELS в field-labels.ts.
 */

import { registerZodSchema } from "./field-labels";

// ── Основные операции ──────────────────────────────────────────────────────────
import { optFormSchema } from "@/pages/opt/schemas";
import { movementFormSchema } from "@/pages/movement/schemas";
import { refuelingFormSchema } from "@/pages/refueling/schemas";
import { refuelingAbroadFormSchema } from "@/pages/refueling-abroad/schemas";
import { transportationFormSchema } from "@/pages/transportation/schemas";
import { equipmentMovementFormSchema } from "@/pages/equipment-movement/schemas";

// ── Справочники ────────────────────────────────────────────────────────────────
import { priceFormSchema } from "@/pages/prices/schemas";

// ── Регистрация: entity type → схема ──────────────────────────────────────────
// entity type должен точно совпадать с ключами в FIELD_LABELS и с тем,
// что передаётся в AuditService.log({ entityType })
registerZodSchema("opt", optFormSchema);
registerZodSchema("movement", movementFormSchema);
registerZodSchema("aircraft_refueling", refuelingFormSchema);
registerZodSchema("aircraft_refueling_abroad", refuelingAbroadFormSchema);
registerZodSchema("transportation", transportationFormSchema);
registerZodSchema("equipment_movement", equipmentMovementFormSchema);
registerZodSchema("prices", priceFormSchema);
