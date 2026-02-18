import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }).optional().nullable(),
  movementType: z.string().optional(),
  productType: z.string().optional(),
  supplierId: z.string().optional(),
  basis: z.string().optional(),
  basisId: z.string().optional(),
  supplierBaseId: z.string().optional(),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().optional(),
  inputMode: z.enum(["liters", "kg"]).default("kg"),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().optional(),
  carrierId: z.string().optional(),
  purchasePrice: z.string().optional(),
  selectedPurchasePriceId: z.string().optional().nullable(),
  purchasePriceId: z.string().optional(),
  purchasePriceIndex: z.number().optional(),
  deliveryPrice: z.string().optional(),
  notes: z.string().optional(),
  isDraft: z.boolean().default(false),
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
