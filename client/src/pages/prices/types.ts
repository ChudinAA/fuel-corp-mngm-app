
import type { Price } from "@shared/schema";

export interface PriceFormData {
  dateFrom: Date;
  dateTo: Date;
  counterpartyType: "wholesale" | "refueling";
  counterpartyRole: "supplier" | "buyer";
  counterpartyId: string;
  productType: "kerosine" | "service" | "pvkj" | "agent" | "storage";
  basis: string;
  volume?: string;
  priceValues: Array<{ price: string }>;
  contractNumber?: string;
  notes?: string;
}

export interface PriceDialogProps {
  editPrice?: Price | null;
  onEditComplete?: () => void;
}

export interface PricesTableProps {
  dealTypeFilter: "all" | "wholesale" | "refueling";
  roleFilter: "all" | "supplier" | "buyer";
  productTypeFilter: string;
  onEdit: (price: Price) => void;
}

export interface SelectionCheckState {
  calculating: boolean;
  result: string | null;
}

export interface DateCheckState {
  checking: boolean;
  result: {
    status: string;
    message: string;
    overlaps?: { id: number; dateFrom: string; dateTo: string }[];
  } | null;
}
