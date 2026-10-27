import type { Equipment } from "@shared/schema";

export type EquipmentApi = Equipment & {
  currentBalanceTonnes?: string;
  pvkjBalanceTonnes?: string;
  averageCostPerTonne?: string | null;
  pvkjAverageCostPerTonne?: string | null;
};

export type EquipmentTransactionApi = import("@shared/schema").EquipmentTransaction & {
  quantityTonnes?: string;
  balanceBeforeTonnes?: string | null;
  balanceAfterTonnes?: string | null;
  averageCostBeforePerTonne?: string | null;
  averageCostAfterPerTonne?: string | null;
  pricePerTonne?: string | null;
};
