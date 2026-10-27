import { z } from "zod";
import { PRODUCT_TYPE } from "@shared/constants";

export const transportationFormSchema = z
  .object({
    supplierId: z.string().nullable().optional().describe("Поставщик"),
    buyerId: z.string().nullable().optional().describe("Покупатель"),
    dealDate: z.string().nullable().optional().describe("Дата сделки"),
    basisId: z.string().nullable().optional(),
    customerBasisId: z.string().nullable().optional(),
    productType: z.string().nullable().optional().default(PRODUCT_TYPE.KEROSENE).describe("Тип топлива"),
    nomenclatureId: z.string().nullable().optional().describe("Номенклатура"),
    quantityLiters: z.number().nullable().optional().describe("Количество (л)"),
    density: z.number().nullable().optional().describe("Плотность"),
    quantityTonnes: z.number().nullable().optional().describe("Масса (т)"),
    inputMode: z.enum(["liters", "tonnes"]).nullable().optional().describe("Единица ввода"),
    purchasePrice: z.number().nullable().optional().describe("Цена покупки"),
    purchasePriceId: z.string().nullable().optional(),
    purchasePriceIndex: z.number().default(0),
    salePrice: z.number().nullable().optional().describe("Цена продажи"),
    salePriceId: z.string().nullable().optional(),
    salePriceIndex: z.number().default(0),
    purchaseAmount: z.number().nullable().optional().describe("Сумма покупки"),
    saleAmount: z.number().nullable().optional().describe("Сумма продажи"),
    carrierId: z.string().nullable().optional().describe("Перевозчик"),
    deliveryLocationId: z.string().nullable().optional().describe("Место доставки"),
    deliveryTariff: z.number().nullable().optional().describe("Тариф доставки"),
    deliveryCost: z.number().nullable().optional().describe("Стоимость доставки"),
    profit: z.number().nullable().optional().describe("Прибыль"),
    notes: z.string().default("").describe("Примечания"),
    isDraft: z.boolean().default(false).describe("Черновик"),
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
      if (data.inputMode === "liters") {
        if (
          data.quantityLiters === null ||
          data.quantityLiters === undefined ||
          data.quantityLiters <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Укажите количество в литрах",
            path: ["quantityLiters"],
          });
        }
        if (
          data.density === null ||
          data.density === undefined ||
          !Number.isFinite(data.density) ||
          data.density <= 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Укажите положительную плотность",
            path: ["density"],
          });
        }
      } else if (
        data.quantityTonnes === null ||
        data.quantityTonnes === undefined ||
        data.quantityTonnes <= 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Укажите массу в тоннах",
          path: ["quantityTonnes"],
        });
      }
    }
  });

export type TransportationFormSchema = z.infer<typeof transportationFormSchema>;
