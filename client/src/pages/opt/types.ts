
import type { Opt } from "@shared/schema";

export type OptApi = Omit<
  Opt,
  "quantityKg" | "purchasePrice" | "salePrice" | "deliveryTariff"
> & {
  quantityTonnes: number;
  purchasePricePerTonne: number | null;
  salePricePerTonne: number | null;
  deliveryTariffPerTonne: number | null;
};

export interface OptFormProps {
  onSuccess?: () => void;
  editData?: OptApi | null;
}

export interface AddOptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editOpt: OptApi | null;
  isCopy?: boolean;
}

export interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}

export interface OptDealExtended extends OptApi {
  supplier?: {
    id: string;
    name: string;
    isWarehouse: boolean;
  };
  buyer?: {
    id: string;
    name: string;
  };
  carrier?: {
    id: string;
    name: string;
  } | null;
  deliveryLocation?: {
    id: string;
    name: string;
  } | null;
  warehouse?: {
    id: string;
    name: string;
  } | null;
}
