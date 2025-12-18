
import { z } from "zod";
import { ENTITY_TYPE } from "@shared/constants";

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
  { value: ENTITY_TYPE.BASE, label: "Базис" },
  { value: ENTITY_TYPE.WAREHOUSE, label: "Склад" },
  { value: ENTITY_TYPE.DELIVERY_LOCATION, label: "Место доставки" },
] as const;
