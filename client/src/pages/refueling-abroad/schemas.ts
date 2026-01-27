import { z } from "zod";

export const refuelingAbroadFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }),
  productType: z.string().min(1, "Выберите продукт"),
  aircraftNumber: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  airportCode: z.string().min(1, "Укажите код аэропорта"),
  
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  intermediaryId: z.string().optional().nullable(),
  storageCardId: z.string().optional().nullable(),
  
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional().nullable(),
  density: z.string().optional().nullable(),
  quantityKg: z.string().optional().nullable(),
  
  purchasePriceUsd: z.string().min(1, "Укажите цену закупки в USD"),
  salePriceUsd: z.string().min(1, "Укажите цену продажи в USD"),
  exchangeRateId: z.string().optional().nullable(),
  manualExchangeRate: z.string().optional().nullable(),
  
  commissionFormula: z.string().optional().nullable(),
  commissionUsd: z.string().optional().nullable(),
  
  notes: z.string().optional().nullable(),
  isDraft: z.boolean().default(false),
});

export type RefuelingAbroadFormData = z.infer<typeof refuelingAbroadFormSchema>;
