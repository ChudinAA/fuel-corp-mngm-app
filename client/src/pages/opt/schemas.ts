
import { z } from "zod";

export const optFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  warehouseId: z.string().optional(),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().optional(),
  carrierId: z.string().optional(),
  deliveryLocationId: z.string().optional(),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPurchasePriceId: z.string().optional(),
  selectedSalePriceId: z.string().optional(),
});

export type OptFormData = z.infer<typeof optFormSchema>;
