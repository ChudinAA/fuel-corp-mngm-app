import { z } from "zod";

export const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }),
  productType: z.string().min(1, "Выберите продукт"),
  aircraftNumber: z.string().optional().nullable(),
  orderNumber: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  warehouseId: z.string().optional().nullable(),
  basis: z.string().min(1, "Выберите базис"),
  customerBasis: z.string().optional().nullable(),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional().nullable(),
  density: z.string().optional().nullable(),
  quantityKg: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isApproxVolume: z.boolean().default(false),
  selectedPurchasePriceId: z.string().optional().nullable(),
  selectedSalePriceId: z.string().optional().nullable(),
  purchasePriceIndex: z.number().optional().nullable(),
  salePriceIndex: z.number().optional().nullable(),
  isDraft: z.boolean().default(false),
});

export type RefuelingFormData = z.infer<typeof refuelingFormSchema>;
