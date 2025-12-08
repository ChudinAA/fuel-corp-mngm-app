
import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  movementType: z.string().min(1, "Выберите тип перемещения"),
  productType: z.string().min(1, "Выберите тип продукта"),
  supplierId: z.string().optional(),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().min(1, "Выберите склад назначения"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.coerce.number().positive().optional().nullable(),
  density: z.coerce.number().positive().optional().nullable(),
  quantityKg: z.coerce.number().positive({ message: "Укажите положительное количество" }),
  carrierId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
