import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  movementType: z.string().min(1, "Выберите тип перемещения"),
  productType: z.string().min(1, "Выберите тип продукта"),
  supplierId: z.string().optional(),
  basis: z.string().optional(),
  supplierBaseId: z.string().optional(),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().min(1, "Выберите склад назначения"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  purchasePrice: z.string().optional(),
  purchasePriceId: z.string().optional(),
  purchasePriceIndex: z.number().optional(),
  deliveryPrice: z.string().optional(),
  notes: z.string().optional(),
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
