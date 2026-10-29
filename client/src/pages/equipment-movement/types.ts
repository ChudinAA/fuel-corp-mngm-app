import type { EquipmentMovement, Warehouse, Equipment } from "@shared/schema";

export type InputMode = "liters" | "tonnes";

export type EquipmentMovementApiRecord = Omit<
  EquipmentMovement,
  "quantityTonnes" | "costPerTonne"
> & {
  quantityTonnes: number | string | null;
  costPerTonne: number | string | null;
};

export interface EquipmentMovementDialogProps {
  warehouses: Warehouse[];
  // equipments: Equipment[];
  editMovement: EquipmentMovementApiRecord | null;
  isCopy?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface EquipmentMovementTableProps {
  onEdit: (movement: any) => void;
  onDelete: (id: string) => void;
  onShowHistory: (id?: string, name?: string) => void;
}
