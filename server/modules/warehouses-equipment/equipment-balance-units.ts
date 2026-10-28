import { kilogramsToTonnes, tonnesToKilograms } from "@shared/units";

type MassValue = string | number | null | undefined;

type EquipmentBalanceFields = {
  currentBalance?: MassValue;
  currentBalanceTonnes?: MassValue;
  pvkjBalance?: MassValue;
  pvkjBalanceTonnes?: MassValue;
};

type EquipmentTransactionMassFields = {
  quantity: MassValue;
  quantityTonnes?: MassValue;
  balanceBefore?: MassValue;
  balanceBeforeTonnes?: MassValue;
  balanceAfter?: MassValue;
  balanceAfterTonnes?: MassValue;
};

function hasMassValue(value: MassValue): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function readMassTonnes(
  tonnesValue: MassValue,
  kilogramsValue: MassValue,
): number {
  if (hasMassValue(tonnesValue)) return Number(tonnesValue);
  if (hasMassValue(kilogramsValue)) {
    return kilogramsToTonnes(Number(kilogramsValue));
  }
  return 0;
}

export function massMirrorFields(valueTonnes: number): {
  tonnes: string;
  kilograms: string;
} {
  return {
    tonnes: valueTonnes.toFixed(5),
    kilograms: tonnesToKilograms(valueTonnes).toFixed(2),
  };
}

function normalizeBalancePair(
  tonnesValue: MassValue,
  kilogramsValue: MassValue,
): { tonnes: string | null | undefined; kilograms: string | null | undefined } {
  if (hasMassValue(tonnesValue)) {
    return massMirrorFields(Number(tonnesValue));
  }
  if (hasMassValue(kilogramsValue)) {
    return massMirrorFields(kilogramsToTonnes(Number(kilogramsValue)));
  }
  return { tonnes: tonnesValue as null | undefined, kilograms: kilogramsValue as null | undefined };
}

function normalizeOptionalMassPair(
  tonnesValue: MassValue,
  kilogramsValue: MassValue,
): { tonnes: string | null | undefined; kilograms: string | null | undefined } {
  if (!hasMassValue(tonnesValue) && !hasMassValue(kilogramsValue)) {
    return {
      tonnes: tonnesValue as null | undefined,
      kilograms: kilogramsValue as null | undefined,
    };
  }
  return massMirrorFields(readMassTonnes(tonnesValue, kilogramsValue));
}

export function normalizeEquipmentBalanceFields<
  T extends EquipmentBalanceFields,
>(values: T): T {
  const current = normalizeBalancePair(
    values.currentBalanceTonnes,
    values.currentBalance,
  );
  const pvkj = normalizeBalancePair(
    values.pvkjBalanceTonnes,
    values.pvkjBalance,
  );

  return {
    ...values,
    currentBalanceTonnes: current.tonnes,
    currentBalance: current.kilograms,
    pvkjBalanceTonnes: pvkj.tonnes,
    pvkjBalance: pvkj.kilograms,
  } as T;
}

export function normalizeEquipmentTransactionMassFields<
  T extends EquipmentTransactionMassFields,
>(values: T): T {
  const quantity = massMirrorFields(
    readMassTonnes(values.quantityTonnes, values.quantity),
  );
  const before = normalizeOptionalMassPair(
    values.balanceBeforeTonnes,
    values.balanceBefore,
  );
  const after = normalizeOptionalMassPair(
    values.balanceAfterTonnes,
    values.balanceAfter,
  );

  return {
    ...values,
    quantityTonnes: quantity.tonnes,
    quantity: quantity.kilograms,
    balanceBeforeTonnes: before.tonnes,
    balanceBefore: before.kilograms,
    balanceAfterTonnes: after.tonnes,
    balanceAfter: after.kilograms,
  } as T;
}
