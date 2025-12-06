
import type { Exchange, Warehouse } from "@shared/schema";

export interface ExchangeDialogProps {
  warehouses: Warehouse[];
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
