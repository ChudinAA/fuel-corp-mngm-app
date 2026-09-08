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
    refuelingDate: z.date().optional().nullable().describe("Дата заправки"),
    productType: z.string().optional().nullable().describe("Тип топлива"),
    aircraftNumber: z.string().optional().nullable().describe("Номер ВС"),
    flightNumber: z.string().optional().nullable().describe("Номер рейса"),
    airportCode: z.string().optional().nullable().describe("Код аэропорта"),

    supplierId: z.string().optional().nullable().default("").describe("Поставщик"),
    buyerId: z.string().optional().nullable().default("").describe("Покупатель"),
    basisId: z.string().optional().nullable().default(""),
    storageCardId: z.string().optional().nullable(),

    intermediaries: z.array(intermediaryItemSchema).default([]),

    inputMode: z.enum(["liters", "kg"]).default("kg").describe("Единица ввода"),
    quantityLiters: z.string().optional().nullable().describe("Количество (л)"),
    density: z.string().optional().nullable().describe("Плотность"),
    quantityKg: z.string().optional().nullable().describe("Количество (кг)"),

    selectedPurchasePriceId: z.string().optional().nullable(),
    selectedSalePriceId: z.string().optional().nullable(),
    purchasePriceIndex: z.number().optional().nullable(),
    salePriceIndex: z.number().optional().nullable(),

    purchasePriceUsd: z.string().optional().nullable().describe("Цена покупки (USD)"),
    salePriceUsd: z.string().optional().nullable().describe("Цена продажи (USD)"),

    purchaseExchangeRateId: z.string().optional().nullable(),
    manualPurchaseExchangeRate: z.string().optional().nullable().describe("Курс покупки (ручной)"),
    manualPurchaseExchangeRateDate: z.string().optional().nullable().describe("Дата курса покупки"),
    saleExchangeRateId: z.string().optional().nullable(),
    manualSaleExchangeRate: z.string().optional().nullable().describe("Курс продажи (ручной)"),
    manualSaleExchangeRateDate: z.string().optional().nullable().describe("Дата курса продажи"),

    notes: z.string().optional().nullable().describe("Примечания"),
    isApproxVolume: z.boolean().default(false).describe("Примерный объём"),
    isDraft: z.boolean().default(false).describe("Черновик"),
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
