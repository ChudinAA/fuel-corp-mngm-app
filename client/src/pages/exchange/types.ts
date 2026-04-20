
import type { Exchange, Warehouse, Supplier } from "@shared/schema";

export interface ExchangeDialogProps {
  warehouses: Warehouse[];
  supplierWarehouses: Supplier[];
  editExchange: Exchange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ExchangeTableProps {
  data: Exchange[];
  isLoading: boolean;
  onEdit: (exchange: Exchange) => void;
  onDelete: (id: string) => void;
  isDeletingId?: string;
}
