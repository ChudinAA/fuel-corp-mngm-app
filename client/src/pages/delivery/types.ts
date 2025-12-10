
import { z } from "zod";

export const deliveryCostFormSchema = z.object({
  carrierId: z.string().min(1, "Выберите перевозчика"),
  fromEntityType: z.string().min(1, "Выберите тип отправления"),
  fromEntityId: z.string().min(1, "Выберите пункт отправления"),
  fromLocation: z.string().min(1, "Укажите откуда"),
  toEntityType: z.string().min(1, "Выберите тип назначения"),
  toEntityId: z.string().min(1, "Выберите пункт назначения"),
  toLocation: z.string().min(1, "Укажите куда"),
  costPerKg: z.string().min(1, "Укажите стоимость за кг"),
  distance: z.string().optional(),
});

export type DeliveryCostFormData = z.infer<typeof deliveryCostFormSchema>;

export const ENTITY_TYPES = [
  { value: "base", label: "Базис" },
  { value: "warehouse", label: "Склад" },
  { value: "delivery_location", label: "Место доставки" },
] as const;
