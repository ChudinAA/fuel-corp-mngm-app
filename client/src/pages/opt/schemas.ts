
import { z } from "zod";

export const optFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  warehouseId: z.string().optional().nullable(),
  quantityLiters: z.string().optional().nullable(),
  density: z.string().optional().nullable(),
  quantityKg: z.string().optional().nullable(),
  carrierId: z.string().optional().nullable(),
  deliveryLocationId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isApproxVolume: z.boolean().default(false),
  selectedPurchasePriceId: z.string().optional().nullable(),
  selectedSalePriceId: z.string().optional().nullable(),
  purchasePriceIndex: z.number().optional().nullable(),
  salePriceIndex: z.number().optional().nullable(),
  isDraft: z.boolean().default(false),
  basis: z.string().optional().nullable(),
  buyerBasis: z.string().optional().nullable(),
});

export type OptFormData = z.infer<typeof optFormSchema>;
