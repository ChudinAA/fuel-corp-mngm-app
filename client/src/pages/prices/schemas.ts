
import { z } from "zod";

export const priceFormSchema = z.object({
  dateFrom: z.date({ required_error: "Укажите дату начала" }),
  dateTo: z.date({ required_error: "Укажите дату окончания" }),
  counterpartyType: z.enum(["wholesale", "refueling"]),
  counterpartyRole: z.enum(["supplier", "buyer"]),
  counterpartyId: z.string().min(1, "Выберите контрагента"),
  productType: z.enum(["kerosine", "service", "pvkj", "agent", "storage"]),
  basis: z.string().min(1, "Выберите базис"),
  volume: z.string().optional(),
  priceValues: z.array(z.object({
    price: z.string().min(1, "Укажите цену")
  })).min(1, "Добавьте хотя бы одну цену"),
  contractNumber: z.string().optional(),
});
