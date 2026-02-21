import { z } from "zod";

export const equipmentMovementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  movementType: z.string().min(1, "Выберите тип перемещения"),
  productType: z.string().min(1, "Выберите продукт"),
  fromWarehouseId: z.string().optional().nullable(),
  toWarehouseId: z.string().optional().nullable(),
  fromEquipmentId: z.string().optional().nullable(),
  toEquipmentId: z.string().optional().nullable(),
  inputMode: z.enum(["liters", "kg"]).default("kg"),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  purchaseAmount: z.number().optional(),
  averageCost: z.number().optional(),
  notes: z.string().optional(),
  isDraft: z.boolean().default(false),
});

export type EquipmentMovementFormData = z.infer<typeof equipmentMovementFormSchema>;
