
import { z } from "zod";

export const optFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  carrierId: z.string().optional(),
  deliveryLocationId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPriceId: z.string().optional(),
});

export type OptFormData = z.infer<typeof optFormSchema>;
