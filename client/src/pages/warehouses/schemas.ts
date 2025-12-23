
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
});

export type WarehouseFormData = z.infer<typeof warehouseFormSchema>;
