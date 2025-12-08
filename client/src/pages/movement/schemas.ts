
import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  movementType: z.string().min(1, "Выберите тип перемещения"),
  productType: z.string().min(1, "Выберите тип продукта"),
  supplierId: z.string().optional(),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().min(1, "Выберите склад назначения"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().refine((val) => {
    if (!val) return false;
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, { message: "Укажите положительное количество" }),
  carrierId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
