import { z } from "zod";

export const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }).optional().nullable().describe("Дата перемещения"),
  movementType: z.string().optional().describe("Тип перемещения"),
  productType: z.string().optional().describe("Тип топлива"),
  supplierId: z.string().optional().describe("Поставщик"),
  basis: z.string().optional().describe("Базис"),
  basisId: z.string().optional(),
  supplierBaseId: z.string().optional(),
  fromWarehouseId: z.string().optional().describe("Склад-источник"),
  toWarehouseId: z.string().optional().describe("Склад-получатель"),
  inputMode: z.enum(["liters", "kg"]).default("kg").describe("Единица ввода"),
  quantityLiters: z.string().optional().describe("Количество (л)"),
  density: z.string().optional().describe("Плотность"),
  quantityKg: z.string().optional().describe("Количество (кг)"),
  carrierId: z.string().optional().describe("Перевозчик"),
  purchasePrice: z.string().optional().describe("Цена покупки"),
  selectedPurchasePriceId: z.string().optional().nullable(),
  purchasePriceId: z.string().optional(),
  purchasePriceIndex: z.number().optional(),
  deliveryPrice: z.string().optional().describe("Цена доставки"),
  notes: z.string().optional().describe("Примечания"),
  isDraft: z.boolean().default(false).describe("Черновик"),
});

export type MovementFormData = z.infer<typeof movementFormSchema>;
