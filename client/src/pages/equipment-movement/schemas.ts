import { z } from "zod";

export const equipmentMovementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  productType: z.string().min(1, "Выберите продукт"),
  fromWarehouseId: z.string().optional().nullable(),
  toWarehouseId: z.string().optional().nullable(),
  fromEquipmentId: z.string().optional().nullable(),
  toEquipmentId: z.string().optional().nullable(),
  inputMode: z.enum(["liters", "kg"]).default("kg"),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  costPerKg: z.string().optional(),
  basis: z.string().optional(),
  basisId: z.string().optional(),
  notes: z.string().optional(),
  isDraft: z.boolean().default(false),
}).refine(data => {
  // Movement must be between different points or at least one equipment must be selected
  // if warehouses are the same.
  if (data.fromWarehouseId === data.toWarehouseId) {
    if (data.fromEquipmentId === data.toEquipmentId) {
      return false;
    }
  }
  return true;
}, {
  message: "Выберите разные точки отправления и назначения",
  path: ["toEquipmentId"]
});

export type EquipmentMovementFormData = z.infer<typeof equipmentMovementFormSchema>;
