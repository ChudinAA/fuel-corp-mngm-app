
import type { Movement, Warehouse, DirectoryWholesale, DirectoryLogistics } from "@shared/schema";

export type InputMode = "liters" | "kg";

export interface MovementDialogProps {
  warehouses: Warehouse[];
  suppliers: DirectoryWholesale[];
  carriers: DirectoryLogistics[];
  vehicles: DirectoryLogistics[];
  trailers: DirectoryLogistics[];
  drivers: DirectoryLogistics[];
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
