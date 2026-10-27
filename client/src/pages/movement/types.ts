
import type { Movement, Warehouse } from "@shared/schema";

export type InputMode = "liters" | "tonnes";

export interface MovementDialogProps {
  warehouses: Warehouse[];
  suppliers: AllSupplier[];
  carriers: any[];
  vehicles: any[];
  trailers: any[];
  drivers: any[];
  prices: any[];
  deliveryCosts: any[];
  editMovement: Movement | null;
  isCopy?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface MovementTableProps {
  data: Movement[];
  isLoading: boolean;
  onEdit: (movement: Movement) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

export interface CalculatedValues {
  calculatedKg: string | null;
  calculatedTonnes: number | null;
  purchasePricePerTonne: number;
  deliveryCost: number;
  totalCost: number;
  costPerKg: number;
  costPerTonne: number;
}

export interface AllSupplier {
  id: string;
  name: string;
  baseIds: string[];
  isWarehouse: boolean;
}
