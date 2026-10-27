import type { RefuelingAbroad } from "@shared/schema";

export type RefuelingAbroadApi = Omit<
  RefuelingAbroad,
  | "quantityKg"
  | "purchasePriceUsd"
  | "purchasePriceRub"
  | "salePriceUsd"
  | "salePriceRub"
> & {
  quantityTonnes: number | null;
  purchasePriceUsdPerTonne: number | null;
  purchasePriceRubPerTonne: number | null;
  salePriceUsdPerTonne: number | null;
  salePriceRubPerTonne: number | null;
};

export interface RefuelingAbroadFormProps {
  onSuccess?: () => void;
  editData?: (RefuelingAbroadApi & { originalId?: string }) | null;
}

export interface AddRefuelingAbroadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editRefueling: RefuelingAbroadApi | null;
  isCopy?: boolean;
}

export interface RefuelingAbroadExtended extends RefuelingAbroadApi {
  supplier?: {
    id: string;
    name: string;
    isIntermediary?: boolean;
    isForeign?: boolean;
  };
  buyer?: {
    id: string;
    name: string;
    isForeign?: boolean;
  };
  intermediary?: {
    id: string;
    name: string;
  } | null;
  storageCard?: {
    id: string;
    name: string;
    airportCode: string;
  } | null;
}

export interface CommissionCalculatorProps {
  formula: string;
  onFormulaChange: (formula: string) => void;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  exchangeRate: number;
  calculatedCommission: number | null;
}
