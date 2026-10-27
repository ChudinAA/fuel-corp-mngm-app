import {
  pricePerTonneToPerKilogram,
  tonnesToKilograms,
} from "@shared/units";

function readNonNegative(value: string | number, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Некорректное значение: ${label}`);
  }
  return parsed;
}

export function tonnesToLegacyWarehouseKilograms(
  tonnes: string | number,
): string {
  return tonnesToKilograms(
    readNonNegative(tonnes, "масса в тоннах"),
  ).toFixed(2);
}

export function inventoryInputToLegacyWarehousePayload(input: {
  productType: string;
  targetDate: string;
  targetBalance: string;
  targetAverageCost: string;
}) {
  const targetBalanceTonnes = readNonNegative(
    input.targetBalance,
    "остаток в тоннах",
  );
  const targetCostPerTonne = readNonNegative(
    input.targetAverageCost,
    "себестоимость за тонну",
  );

  return {
    productType: input.productType,
    targetDate: input.targetDate,
    targetBalance: tonnesToKilograms(targetBalanceTonnes).toFixed(2),
    targetAverageCost: pricePerTonneToPerKilogram(
      targetCostPerTonne,
    ).toFixed(6),
  };
}
