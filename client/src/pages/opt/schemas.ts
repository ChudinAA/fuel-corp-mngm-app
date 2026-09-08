import { z } from "zod";

export const optFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }).describe("Дата сделки"),
  supplierId: z.string().min(1, "Выберите поставщика").describe("Поставщик"),
  buyerId: z.string().min(1, "Выберите покупателя").describe("Покупатель"),
  warehouseId: z.string().optional().nullable().describe("Склад"),
  productType: z.string().min(1, "Выберите продукт").describe("Тип топлива"),
  quantityLiters: z.string().optional().nullable().describe("Количество (л)"),
  density: z.string().optional().nullable().describe("Плотность"),
  quantityKg: z.string().optional().nullable().describe("Количество (кг)"),
  carrierId: z.string().optional().nullable().describe("Перевозчик"),
  deliveryLocationId: z.string().optional().nullable().describe("Место доставки"),
  notes: z.string().optional().nullable().describe("Примечания"),
  isApproxVolume: z.boolean().default(false).describe("Примерный объём"),
  isPlannedDeal: z.boolean().default(false).describe("Плановая сделка"),
  isNoDeliveryRequired: z.boolean().default(false).describe("Без доставки"),
  selectedPurchasePriceId: z.string().optional().nullable(),
  selectedSalePriceId: z.string().optional().nullable(),
  purchasePriceIndex: z.number().optional().nullable(),
  salePriceIndex: z.number().optional().nullable(),
  isDraft: z.boolean().default(false).describe("Черновик"),
  inputMode: z.enum(["liters", "kg"]).default("kg").describe("Единица ввода"),
  basis: z.string().optional().nullable().describe("Базис"),
  basisId: z.string().uuid().optional().nullable(),
  customerBasis: z.string().optional().nullable().describe("Базис покупателя"),
  customerBasisId: z.string().uuid().optional().nullable(),
});

export type OptFormData = z.infer<typeof optFormSchema>;
