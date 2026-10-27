
import { z } from "zod";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";
import type { DeliveryCost } from "@shared/schema";

export type DeliveryCostApiRecord = Omit<DeliveryCost, "costPerKg"> & {
  costPerTonne: number | string | null;
};

export const deliveryCostFormSchema = z.object({
  carrierId: z.string().min(1, "Выберите перевозчика"),
  contractId: z.string().optional(),
  fromEntityType: z.string().min(1, "Выберите тип отправления"),
  fromEntityId: z.string().min(1, "Выберите пункт отправления"),
  fromLocation: z.string().min(1, "Укажите откуда"),
  toEntityType: z.string().min(1, "Выберите тип назначения"),
  toEntityId: z.string().min(1, "Выберите пункт назначения"),
  toLocation: z.string().min(1, "Укажите куда"),
  costPerTonne: z.string().min(1, "Укажите стоимость за тонну"),
  distance: z.string().optional(),
  transitDays: z.string().optional(),
  priority: z.string().optional(),
});

export type DeliveryCostFormData = z.infer<typeof deliveryCostFormSchema>;

export const DELIVERY_ENTITY_TYPES = [
  { value: DELIVERY_ENTITY_TYPE.BASE, label: "Базис" },
  { value: DELIVERY_ENTITY_TYPE.WAREHOUSE, label: "Склад" },
  { value: DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION, label: "Место доставки" },
] as const;
