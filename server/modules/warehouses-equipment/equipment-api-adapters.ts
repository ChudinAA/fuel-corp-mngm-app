import { kilogramsToTonnes } from "@shared/units";

type LegacyEquipmentBalances = {
  currentBalance?: string | number | null;
  pvkjBalance?: string | number | null;
};

export function equipmentToApi<T extends LegacyEquipmentBalances>(equipment: T) {
  const currentBalanceKg = Number(equipment.currentBalance ?? "0");
  const pvkjBalanceKg = Number(equipment.pvkjBalance ?? "0");

  return {
    ...equipment,
    currentBalanceTonnes: kilogramsToTonnes(currentBalanceKg).toFixed(5),
    pvkjBalanceTonnes: kilogramsToTonnes(pvkjBalanceKg).toFixed(5),
  };
}
