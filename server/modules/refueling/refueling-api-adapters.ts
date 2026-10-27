import {
  legacyDealMassToTonnes,
  pricePerKilogramToPerTonne,
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

export class RefuelingApiInputError extends Error {}

function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RefuelingApiInputError(`${field} должна быть числом`);
  }
  return parsed;
}

export function toLegacyRefuelingInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RefuelingApiInputError("Тело заправки должно быть объектом");
  }

  const input = body as Record<string, unknown>;
  const legacy = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = optionalNumber(input.quantityTonnes, "Масса в тоннах");
    legacy.quantityKg =
      tonnes === null ? null : Number(tonnesToKilograms(tonnes).toFixed(2));
    delete legacy.quantityTonnes;
  }

  for (const [apiField, legacyField] of [
    ["purchasePricePerTonne", "purchasePrice"],
    ["salePricePerTonne", "salePrice"],
    ["agentFeeRatePerTonne", "agentFeeRate"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = optionalNumber(input[apiField], apiField);
      legacy[legacyField] =
        rate === null ? null : pricePerTonneToPerKilogram(rate);
      delete legacy[apiField];
    }
  }

  return legacy;
}

function storedRateFromAmount(
  amount: unknown,
  quantityTonnes: number | null,
  field: string,
): number | null {
  const total = optionalNumber(amount, field);
  if (total === null || quantityTonnes === null || quantityTonnes <= 0) {
    return null;
  }
  return total / quantityTonnes;
}

export function refuelingDealToApi<
  T extends {
    quantityKg: unknown;
    quantityLiters?: unknown;
    density?: unknown;
    purchaseAmount?: unknown;
    saleAmount?: unknown;
    agentFee?: unknown;
    agentFeeRate?: unknown;
    otherServiceFee?: unknown;
    isAgentFeeEnabled?: unknown;
    isOtherServiceEnabled?: unknown;
    isPriceRecharge?: unknown;
    isPvkjRecharge?: unknown;
  },
>(deal: T) {
  const {
    quantityKg,
    purchasePrice,
    salePrice,
    agentFeeRate,
    ...fields
  } = deal as T & {
    purchasePrice?: unknown;
    salePrice?: unknown;
  };
  const quantityTonnes = legacyDealMassToTonnes(
    quantityKg as number | string | null | undefined,
    deal.quantityLiters as number | string | null | undefined,
    deal.density as number | string | null | undefined,
  );
  const isRecharge = Boolean(deal.isPriceRecharge || deal.isPvkjRecharge);
  const agentFee =
    deal.isAgentFeeEnabled === false
      ? 0
      : optionalNumber(deal.agentFee, "agentFee") ?? 0;
  const otherServiceFee =
    deal.isOtherServiceEnabled === false
      ? 0
      : optionalNumber(deal.otherServiceFee, "otherServiceFee") ?? 0;
  const saleAmount = optionalNumber(deal.saleAmount, "saleAmount");
  const baseSaleAmount =
    saleAmount === null
      ? null
      : saleAmount - (isRecharge ? agentFee + otherServiceFee : 0);
  const agentFeeRateValue = optionalNumber(agentFeeRate, "agentFeeRate");

  return {
    ...fields,
    quantityTonnes,
    purchasePricePerTonne: storedRateFromAmount(
      deal.purchaseAmount,
      quantityTonnes,
      "purchaseAmount",
    ),
    salePricePerTonne: storedRateFromAmount(
      baseSaleAmount,
      quantityTonnes,
      "saleAmount",
    ),
    agentFeeRatePerTonne:
      agentFeeRateValue === null
        ? null
        : pricePerKilogramToPerTonne(agentFeeRateValue),
  };
}
