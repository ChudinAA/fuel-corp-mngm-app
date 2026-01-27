import type { RefuelingAbroad } from "@shared/schema";

export interface RefuelingAbroadFormProps {
  onSuccess?: () => void;
  editData?: RefuelingAbroad | null;
}

export interface AddRefuelingAbroadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editRefueling: RefuelingAbroad | null;
  isCopy?: boolean;
}

export interface RefuelingAbroadExtended extends RefuelingAbroad {
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
