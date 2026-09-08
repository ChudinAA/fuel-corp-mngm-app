import { z } from "zod";

export const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }).describe("Дата заправки"),
  productType: z.string().min(1, "Выберите продукт").describe("Тип топлива"),
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
  inputMode: z.enum(["liters", "kg"]).describe("Единица ввода"),
  quantityLiters: z.string().optional().nullable().describe("Количество (л)"),
  density: z.string().optional().nullable().describe("Плотность"),
  quantityKg: z.string().optional().nullable().describe("Количество (кг)"),
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
});

export type RefuelingFormData = z.infer<typeof refuelingFormSchema>;
