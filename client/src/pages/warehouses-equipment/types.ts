import type { Equipment } from "@shared/schema";

export type EquipmentApi = Equipment & {
  currentBalanceTonnes?: string;
  pvkjBalanceTonnes?: string;
};
