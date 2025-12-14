
import type { Movement, Warehouse } from "@shared/schema";

export type InputMode = "liters" | "kg";

export interface MovementDialogProps {
  warehouses: Warehouse[];
  suppliers: AllSupplier[];
  carriers: any[];
  prices: any[];
  deliveryCosts: any[];
  editMovement: Movement | null;
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
  purchasePrice: number;
  deliveryCost: number;
  totalCost: number;
  costPerKg: number;
}

export interface AllSupplier {
  id: string;
  name: string;
  baseIds: string[];
  isWarehouse: boolean;
}
