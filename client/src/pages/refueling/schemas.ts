
import { z } from "zod";

export const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }),
  productType: z.string().min(1, "Выберите продукт"),
  aircraftNumber: z.string().optional(),
  orderNumber: z.string().optional(),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  warehouseId: z.string().optional(),
  basis: z.string().min(1, "Выберите базис"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().optional(),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPurchasePriceId: z.string().optional(),
  selectedSalePriceId: z.string().optional(),
  purchasePriceIndex: z.number().optional(),
  salePriceIndex: z.number().optional(),
});

export type RefuelingFormData = z.infer<typeof refuelingFormSchema>;
