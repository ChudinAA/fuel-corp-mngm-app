import { z } from "zod";

import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
  CURRENCY,
} from "@shared/constants";

export const priceFormSchema = z.object({
  dateFrom: z.date({ required_error: "Укажите дату начала" }).describe("Действует с"),
  dateTo: z.date({ required_error: "Укажите дату окончания" }).describe("Действует по"),
  counterpartyType: z
    .enum([
      COUNTERPARTY_TYPE.WHOLESALE,
      COUNTERPARTY_TYPE.REFUELING,
      COUNTERPARTY_TYPE.REFUELING_ABROAD,
      COUNTERPARTY_TYPE.TRANSPORTATION,
    ] as [string, ...string[]])
    .describe("Тип сделки"),
  counterpartyRole: z
    .enum([COUNTERPARTY_ROLE.SUPPLIER, COUNTERPARTY_ROLE.BUYER])
    .describe("Роль контрагента"),
  counterpartyId: z.string().min(1, "Выберите контрагента").describe("Контрагент"),
  productType: z
    .enum([
      PRODUCT_TYPE.KEROSENE,
      PRODUCT_TYPE.SERVICE,
      PRODUCT_TYPE.PVKJ,
      PRODUCT_TYPE.AGENT,
      PRODUCT_TYPE.STORAGE,
    ])
    .describe("Тип топлива"),
  basis: z.string().min(1, "Выберите базис").describe("Базис"),
  basisId: z.string().optional(),
  limitType: z.enum(["volume", "amount"]).default("volume").describe("Тип лимита"),
  volume: z.string().optional().describe("Объём"),
  maxDealAmount: z.string().optional().describe("Макс. сумма сделки"),
  priceValues: z
    .array(
      z.object({
        price: z.string().min(1, "Укажите цену"),
      }),
    )
    .min(1, "Добавьте хотя бы одну цену"),
  contractNumber: z.string().optional().describe("Номер договора"),
  contractAppendix: z.string().optional().describe("Приложение к договору"),
  notes: z.string().optional().describe("Примечания"),
  currency: z.string().optional().default("RUB").describe("Валюта"),
  currencyId: z.string().optional(),
  loadingBasisId: z.string().optional(),
  priceUnit: z.enum(["kg", "liter"]).default("kg").describe("Единица цены"),
  contractLimitEnabled: z.boolean().default(true).describe("Лимит по договору"),
});
