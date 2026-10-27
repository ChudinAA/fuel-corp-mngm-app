
import type { AircraftRefueling } from "@shared/schema";

export type RefuelingApi = Omit<
  AircraftRefueling,
  "quantityKg" | "purchasePrice" | "salePrice" | "agentFeeRate"
> & {
  quantityTonnes: number | null;
  purchasePricePerTonne: number | null;
  salePricePerTonne: number | null;
  agentFeeRatePerTonne: number | null;
};

export interface RefuelingFormProps {
  onSuccess?: () => void;
  editData?: RefuelingApi | null;
  editDeals?: RefuelingApi[];
  equipmentType?: string;
}

export interface AddRefuelingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editRefueling: RefuelingApi | null;
  isCopy?: boolean;
  equipmentType?: string;
}

export interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}

export interface RefuelingDealExtended extends RefuelingApi {
  supplier?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  };
  buyer?: {
    id: string;
    name: string;
  };
  warehouse?: {
    id: string;
    name: string;
  } | null;
}
