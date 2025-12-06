
import { z } from "zod";

export const exchangeFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  dealNumber: z.string().optional(),
  counterparty: z.string().min(1, "Укажите контрагента"),
  productType: z.string().min(1, "Выберите тип продукта"),
  quantityKg: z.string().min(1, "Укажите количество"),
  pricePerKg: z.string().min(1, "Укажите цену"),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

export type ExchangeFormData = z.infer<typeof exchangeFormSchema>;
