import { z } from "zod";

import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
  CURRENCY,
} from "@shared/constants";

export const priceFormSchema = z.object({
  dateFrom: z.date({ required_error: "Укажите дату начала" }),
  dateTo: z.date({ required_error: "Укажите дату окончания" }),
  counterpartyType: z.enum([
    COUNTERPARTY_TYPE.WHOLESALE,
    COUNTERPARTY_TYPE.REFUELING,
    COUNTERPARTY_TYPE.REFUELING_ABROAD,
  ]),
  counterpartyRole: z.enum([
    COUNTERPARTY_ROLE.SUPPLIER,
    COUNTERPARTY_ROLE.BUYER,
  ]),
  counterpartyId: z.string().min(1, "Выберите контрагента"),
  productType: z.enum([
    PRODUCT_TYPE.KEROSENE,
    PRODUCT_TYPE.SERVICE,
    PRODUCT_TYPE.PVKJ,
    PRODUCT_TYPE.AGENT,
    PRODUCT_TYPE.STORAGE,
  ]),
  basis: z.string().min(1, "Выберите базис"),
  basisId: z.string().optional(),
  volume: z.string().min(1, "Укажите объем по договору"),
  priceValues: z
    .array(
      z.object({
        price: z.string().min(1, "Укажите цену"),
      }),
    )
    .min(1, "Добавьте хотя бы одну цену"),
  contractNumber: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().optional().default("RUB"),
  currencyId: z.string().optional(),
  targetCurrencyId: z.string().optional(),
});
