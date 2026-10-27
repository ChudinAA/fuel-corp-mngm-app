
import type { Movement as DatabaseMovement, Warehouse } from "@shared/schema";

export type InputMode = "liters" | "tonnes";

export type MovementApiRecord = Omit<
  DatabaseMovement,
  "quantityKg" | "purchasePrice" | "deliveryPrice" | "costPerKg"
> & {
  quantityTonnes: number | string | null;
  purchaseAmount: number | string | null;
  purchasePricePerTonne: number | string | null;
  deliveryPricePerTonne: number | string | null;
  costPerTonne: number | string | null;
  quantityKg?: number | string | null;
  purchasePrice?: number | string | null;
  deliveryPrice?: number | string | null;
  costPerKg?: number | string | null;
};

export interface MovementDialogProps {
  warehouses: Warehouse[];
  suppliers: AllSupplier[];
  carriers: any[];
  vehicles: any[];
  trailers: any[];
  drivers: any[];
  prices: any[];
  deliveryCosts: any[];
  editMovement: MovementApiRecord | null;
  isCopy?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface MovementTableProps {
  data: MovementApiRecord[];
  isLoading: boolean;
  onEdit: (movement: MovementApiRecord) => void;
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
