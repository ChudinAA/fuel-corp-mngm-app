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

export function normalizeRefuelingInput(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RefuelingApiInputError("Тело заправки должно быть объектом");
  }

  const input = body as Record<string, unknown>;
  const normalized = { ...input };

  if (Object.prototype.hasOwnProperty.call(input, "quantityTonnes")) {
    const tonnes = optionalNumber(input.quantityTonnes, "Масса в тоннах");
    const normalizedTonnes =
      tonnes === null ? null : Number(tonnes.toFixed(5));
    normalized.quantityTonnes = normalizedTonnes;
    if (Object.prototype.hasOwnProperty.call(input, "quantityKg")) {
      normalized.quantityKg = optionalNumber(
        input.quantityKg,
        "Масса в килограммах",
      );
    } else {
      normalized.quantityKg =
        normalizedTonnes === null
          ? null
          : Number(tonnesToKilograms(normalizedTonnes).toFixed(2));
    }
  } else if (Object.prototype.hasOwnProperty.call(input, "quantityKg")) {
    const kilograms = optionalNumber(input.quantityKg, "Масса в килограммах");
    normalized.quantityKg = kilograms;
    normalized.quantityTonnes =
      kilograms === null ? null : Number((kilograms / 1_000).toFixed(5));
  }

  for (const [apiField, legacyField] of [
    ["purchasePricePerTonne", "purchasePrice"],
    ["salePricePerTonne", "salePrice"],
    ["agentFeeRatePerTonne", "agentFeeRate"],
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(input, apiField)) {
      const rate = optionalNumber(input[apiField], apiField);
      normalized[apiField] = rate;
      normalized[legacyField] = Object.prototype.hasOwnProperty.call(
        input,
        legacyField,
      )
        ? optionalNumber(input[legacyField], legacyField)
        : rate === null
          ? null
          : pricePerTonneToPerKilogram(rate);
    } else if (Object.prototype.hasOwnProperty.call(input, legacyField)) {
      const rate = optionalNumber(input[legacyField], legacyField);
      normalized[legacyField] = rate;
      normalized[apiField] =
        rate === null ? null : pricePerKilogramToPerTonne(rate);
    }
  }

  return normalized;
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
    quantityTonnes?: unknown;
    quantityLiters?: unknown;
    density?: unknown;
    purchasePricePerTonne?: unknown;
    salePricePerTonne?: unknown;
    agentFeeRatePerTonne?: unknown;
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
    quantityTonnes: storedQuantityTonnes,
    purchasePrice,
    purchasePricePerTonne: storedPurchasePricePerTonne,
    salePrice,
    salePricePerTonne: storedSalePricePerTonne,
    agentFeeRate,
    agentFeeRatePerTonne: storedAgentFeeRatePerTonne,
    ...fields
  } = deal as T & {
    quantityTonnes?: unknown;
    purchasePrice?: unknown;
    purchasePricePerTonne?: unknown;
    salePrice?: unknown;
    salePricePerTonne?: unknown;
    agentFeeRate?: unknown;
    agentFeeRatePerTonne?: unknown;
  };
  const quantityTonnes =
    optionalNumber(storedQuantityTonnes, "quantityTonnes") ??
    legacyDealMassToTonnes(
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
  const storedPurchaseRate = optionalNumber(
    storedPurchasePricePerTonne,
    "purchasePricePerTonne",
  );
  const legacyPurchaseRate = optionalNumber(purchasePrice, "purchasePrice");
  const storedSaleRate = optionalNumber(
    storedSalePricePerTonne,
    "salePricePerTonne",
  );
  const legacySaleRate = optionalNumber(salePrice, "salePrice");
  const agentFeeRateValue = optionalNumber(agentFeeRate, "agentFeeRate");
  const storedAgentFeeRate = optionalNumber(
    storedAgentFeeRatePerTonne,
    "agentFeeRatePerTonne",
  );

  return {
    ...fields,
    quantityTonnes,
    purchasePricePerTonne:
      storedPurchaseRate ??
      (legacyPurchaseRate === null
        ? storedRateFromAmount(
            deal.purchaseAmount,
            quantityTonnes,
            "purchaseAmount",
          )
        : pricePerKilogramToPerTonne(legacyPurchaseRate)),
    salePricePerTonne:
      storedSaleRate ??
      (legacySaleRate === null
        ? storedRateFromAmount(
            baseSaleAmount,
            quantityTonnes,
            "saleAmount",
          )
        : pricePerKilogramToPerTonne(legacySaleRate)),
    agentFeeRatePerTonne:
      storedAgentFeeRate ??
      (agentFeeRateValue === null
        ? null
        : pricePerKilogramToPerTonne(agentFeeRateValue)),
  };
}
