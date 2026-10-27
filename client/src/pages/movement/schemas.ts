import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }).optional().nullable().describe("Дата перемещения"),
  movementType: z.string().optional().describe("Тип перемещения"),
  productType: z.string().optional().describe("Тип топлива"),
  nomenclatureId: z.string().optional().nullable().describe("Номенклатура"),
  supplierId: z.string().optional().describe("Поставщик"),
  basis: z.string().optional().describe("Базис"),
  basisId: z.string().optional(),
  supplierBaseId: z.string().optional(),
  fromWarehouseId: z.string().optional().describe("Склад-источник"),
  toWarehouseId: z.string().optional().describe("Склад-получатель"),
  inputMode: z.enum(["liters", "tonnes"]).default("tonnes").describe("Единица ввода"),
  quantityLiters: z.string().optional().describe("Количество (л)"),
  density: z.string().optional().describe("Плотность"),
  quantityTonnes: z.string().optional().describe("Масса (т)"),
  carrierId: z.string().optional().describe("Перевозчик"),
  purchasePrice: z.string().optional().describe("Цена покупки"),
  selectedPurchasePriceId: z.string().optional().nullable(),
  purchasePriceId: z.string().optional(),
  purchasePriceIndex: z.number().optional(),
  deliveryPrice: z.string().optional().describe("Цена доставки"),
  notes: z.string().optional().describe("Примечания"),
  isDraft: z.boolean().default(false).describe("Черновик"),
}).superRefine((data, ctx) => {
  if (data.isDraft) return;
  if (data.inputMode === "liters") {
    if (!data.quantityLiters || Number(data.quantityLiters) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите количество в литрах",
        path: ["quantityLiters"],
      });
    }
    const density = Number(data.density);
    if (!Number.isFinite(density) || density <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Укажите положительную плотность",
        path: ["density"],
      });
    }
  } else if (!data.quantityTonnes || Number(data.quantityTonnes) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Укажите массу в тоннах",
      path: ["quantityTonnes"],
    });
  }
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
