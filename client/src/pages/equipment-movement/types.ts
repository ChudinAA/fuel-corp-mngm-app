import type { EquipmentMovement, Warehouse, Equipment } from "@shared/schema";

export type InputMode = "liters" | "kg";

export interface EquipmentMovementDialogProps {
  warehouses: Warehouse[];
  equipments: Equipment[];
  editMovement: EquipmentMovement | null;
  isCopy?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface EquipmentMovementTableProps {
  onEdit: (movement: EquipmentMovement) => void;
  onDelete: (id: string) => void;
  onShowHistory: () => void;
}
