
import type { Opt, DirectoryWholesale, DirectoryLogistics } from "@shared/schema";

export interface OptFormProps {
  onSuccess?: () => void;
  editData?: Opt | null;
}

export interface AddOptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: DirectoryWholesale[];
  buyers: DirectoryWholesale[];
  carriers: DirectoryLogistics[];
  locations: DirectoryLogistics[];
  editOpt: Opt | null;
}

export interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}

export interface OptDealExtended extends Opt {
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
  isApproxVolume?: boolean;
}
