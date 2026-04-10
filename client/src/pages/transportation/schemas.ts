import { z } from "zod";
import { PRODUCT_TYPE } from "@shared/constants";

export const transportationFormSchema = z
  .object({
    supplierId: z.string().nullable().optional(),
    buyerId: z.string().nullable().optional(),
    dealDate: z.string().nullable().optional(),
    basisId: z.string().nullable().optional(),
    customerBasisId: z.string().nullable().optional(),
    productType: z.string().nullable().optional().default(PRODUCT_TYPE.KEROSENE),
    quantityLiters: z.number().nullable().optional(),
    density: z.number().nullable().optional(),
    quantityKg: z.number().nullable().optional(),
    inputMode: z.string().nullable().optional(),
    purchasePrice: z.number().nullable().optional(),
    purchasePriceId: z.string().nullable().optional(),
    purchasePriceIndex: z.number().default(0),
    salePrice: z.number().nullable().optional(),
    salePriceId: z.string().nullable().optional(),
    salePriceIndex: z.number().default(0),
    purchaseAmount: z.number().nullable().optional(),
    saleAmount: z.number().nullable().optional(),
    carrierId: z.string().nullable().optional(),
    deliveryLocationId: z.string().nullable().optional(),
    deliveryTariff: z.number().nullable().optional(),
    deliveryCost: z.number().nullable().optional(),
    profit: z.number().nullable().optional(),
    notes: z.string().default(""),
    isDraft: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.buyerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Выберите заказчика",
        path: ["buyerId"],
      });
    }
    if (!data.isDraft) {
      if (!data.dealDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите дату сделки",
          path: ["dealDate"],
        });
      }
      if (data.quantityKg === null || data.quantityKg === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите количество (кг)",
          path: ["quantityKg"],
        });
      }
    }
  });

export type TransportationFormSchema = z.infer<typeof transportationFormSchema>;
