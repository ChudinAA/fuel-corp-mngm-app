
import { z } from "zod";

export const warehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  baseId: z.string().min(1, "Выберите базис"),
});

export const newWarehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  bases: z.array(
    z.object({ 
      baseId: z.string().min(1, "Выберите базис") 
    })
  ).min(1, "Добавьте хотя бы один базис"),
  storageCost: z.string().optional(),
  createSupplier: z.boolean(),
  isBase: z.boolean().default(false),
  isExport: z.boolean().default(false),
  services: z.array(z.object({
    serviceType: z.string().min(1, "Выберите тип услуги"),
    serviceValue: z.string().min(1, "Укажите значение"),
  })).default([]),
});

export type WarehouseFormData = z.infer<typeof warehouseFormSchema>;
