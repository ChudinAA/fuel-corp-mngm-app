import { z } from "zod";

export const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }).describe("Дата заправки"),
  productType: z.string().min(1, "Выберите продукт").describe("Тип топлива"),
  nomenclatureId: z.string().optional().nullable().describe("Номенклатура"),
  aircraftNumber: z.string().optional().nullable().describe("Номер ВС"),
  orderNumber: z.string().optional().nullable().describe("Номер заказа"),
  flightNumber: z.string().optional().nullable().describe("Номер рейса"),
  supplierId: z.string().min(1, "Выберите поставщика").describe("Поставщик"),
  buyerId: z.string().min(1, "Выберите покупателя").describe("Покупатель"),
  warehouseId: z.string().optional().nullable().describe("Склад"),
  basis: z.string().min(1, "Выберите базис").describe("Базис"),
  basisId: z.string().uuid().optional().nullable(),
  customerBasis: z.string().optional().nullable().describe("Базис покупателя"),
  customerBasisId: z.string().uuid().optional().nullable(),
  inputMode: z.enum(["liters", "tonnes"]).describe("Единица ввода"),
  quantityLiters: z.string().optional().nullable().describe("Количество (л)"),
  density: z.string().optional().nullable().describe("Плотность"),
  quantityTonnes: z.string().optional().nullable().describe("Количество (т)"),
  notes: z.string().optional().nullable().describe("Примечания"),
  isApproxVolume: z.boolean().default(false).describe("Примерный объём"),
  isPlannedDeal: z.boolean().default(false).describe("Плановая сделка"),
  selectedPurchasePriceId: z.string().optional().nullable(),
  selectedSalePriceId: z.string().optional().nullable(),
  purchasePriceIndex: z.number().optional().nullable(),
  salePriceIndex: z.number().optional().nullable(),
  isDraft: z.boolean().default(false).describe("Черновик"),
  isPriceRecharge: z.boolean().default(false).describe("Переоформление цены"),
  isPvkjRecharge: z.boolean().default(false).describe("Дозаправка ПВКЖ"),
  setSalePriceZero: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (
    !data.isDraft &&
    data.inputMode === "liters" &&
    Number.parseFloat(data.quantityLiters || "0") > 0
  ) {
    const density = Number.parseFloat(data.density || "0");
    if (!Number.isFinite(density) || density <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите положительную плотность для пересчёта массы",
        path: ["density"],
      });
    }
  }
});

export type RefuelingFormData = z.infer<typeof refuelingFormSchema>;
