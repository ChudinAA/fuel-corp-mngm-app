import { z } from "zod";

export const intermediaryItemSchema = z.object({
  id: z.string().optional(),
  intermediaryId: z.string(),
  orderIndex: z.number(),
  commissionFormula: z.string().optional().nullable(),
  manualCommissionUsd: z.number().optional().nullable(),
  commissionUsd: z.number().optional().nullable(),
  commissionRub: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const refuelingAbroadFormSchema = z
  .object({
    refuelingDate: z.date().optional().nullable(),
    productType: z.string().optional().nullable(),
    aircraftNumber: z.string().optional().nullable(),
    flightNumber: z.string().optional().nullable(),
    airportCode: z.string().optional().nullable(),

    supplierId: z.string().optional().nullable().default(""),
    buyerId: z.string().optional().nullable().default(""),
    basisId: z.string().optional().nullable().default(""),
    storageCardId: z.string().optional().nullable(),

    intermediaries: z.array(intermediaryItemSchema).default([]),

    inputMode: z.enum(["liters", "kg"]).default("kg"),
    quantityLiters: z.string().optional().nullable(),
    density: z.string().optional().nullable(),
    quantityKg: z.string().optional().nullable(),

    selectedPurchasePriceId: z.string().optional().nullable(),
    selectedSalePriceId: z.string().optional().nullable(),
    purchasePriceIndex: z.number().optional().nullable(),
    salePriceIndex: z.number().optional().nullable(),

    purchasePriceUsd: z.string().optional().nullable(),
    salePriceUsd: z.string().optional().nullable(),

    purchaseExchangeRateId: z.string().optional().nullable(),
    manualPurchaseExchangeRate: z.string().optional().nullable(),
    manualPurchaseExchangeRateDate: z.string().optional().nullable(),
    saleExchangeRateId: z.string().optional().nullable(),
    manualSaleExchangeRate: z.string().optional().nullable(),
    manualSaleExchangeRateDate: z.string().optional().nullable(),

    notes: z.string().optional().nullable(),
    isApproxVolume: z.boolean().default(false),
    isDraft: z.boolean().default(false),
    rtNumber: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.isDraft) {
      if (!data.refuelingDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите дату заправки",
          path: ["refuelingDate"],
        });
      }
      if (!data.productType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите продукт",
          path: ["productType"],
        });
      }
      if (!data.supplierId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите поставщика",
          path: ["supplierId"],
        });
      }
      if (!data.buyerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите покупателя",
          path: ["buyerId"],
        });
      }
      if (!data.basisId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Выберите базис",
          path: ["basisId"],
        });
      }
    }
  });

export type RefuelingAbroadFormData = z.infer<typeof refuelingAbroadFormSchema>;
