
import { z } from "zod";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";

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

export const DELIVERY_ENTITY_TYPES = [
  { value: DELIVERY_ENTITY_TYPE.BASE, label: "Базис" },
  { value: DELIVERY_ENTITY_TYPE.WAREHOUSE, label: "Склад" },
  { value: DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION, label: "Место доставки" },
] as const;
