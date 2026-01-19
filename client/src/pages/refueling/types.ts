
import type { AircraftRefueling } from "@shared/schema";

export interface RefuelingFormProps {
  onSuccess?: () => void;
  editData?: AircraftRefueling | null;
}

export interface AddRefuelingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editRefueling: AircraftRefueling | null;
  isCopy?: boolean;
}

export interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}

export interface RefuelingDealExtended extends AircraftRefueling {
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
