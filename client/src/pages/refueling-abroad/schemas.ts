import { z } from "zod";

export const intermediaryItemSchema = z.object({
  id: z.string().optional(),
  intermediaryId: z.string(),
  orderIndex: z.number(),
  commissionFormula: z.string().optional().nullable(),
  commissionUsd: z.number().optional().nullable(),
  commissionRub: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const refuelingAbroadFormSchema = z.object({
  refuelingDate: z.date().optional().nullable(),
  productType: z.string().optional().nullable(),
  aircraftNumber: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  airportCode: z.string().optional().nullable(),
  
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  storageCardId: z.string().optional().nullable(),
  
  intermediaries: z.array(intermediaryItemSchema).default([]),
  
  inputMode: z.enum(["liters", "kg"]).default("kg"),
  quantityLiters: z.string().optional().nullable(),
  density: z.string().optional().nullable(),
  quantityKg: z.string().optional().nullable(),
  
  purchasePriceUsd: z.string().optional().nullable(),
  salePriceUsd: z.string().optional().nullable(),
  
  purchaseExchangeRateId: z.string().optional().nullable(),
  manualPurchaseExchangeRate: z.string().optional().nullable(),
  saleExchangeRateId: z.string().optional().nullable(),
  manualSaleExchangeRate: z.string().optional().nullable(),
  
  notes: z.string().optional().nullable(),
  isApproxVolume: z.boolean().default(false),
  isDraft: z.boolean().default(false),
}).superRefine((data, ctx) => {
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
    if (!data.airportCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите код аэропорта",
        path: ["airportCode"],
      });
    }
    if (!data.purchasePriceUsd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите цену закупки в USD",
        path: ["purchasePriceUsd"],
      });
    }
    if (!data.salePriceUsd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите цену продажи в USD",
        path: ["salePriceUsd"],
      });
    }
  }
});

export type RefuelingAbroadFormData = z.infer<typeof refuelingAbroadFormSchema>;
