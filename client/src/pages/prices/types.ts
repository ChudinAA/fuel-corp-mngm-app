
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

export interface PriceFilterState {
  dateFrom?: string;
  dateTo?: string;
  counterpartyType: "all" | "wholesale" | "refueling";
  counterpartyRole: "all" | "supplier" | "buyer";
  productType: string;
  showArchived: boolean;
}

export interface PricesTableProps {
  dealTypeFilter: "all" | "wholesale" | "refueling";
  roleFilter: "all" | "supplier" | "buyer";
  productTypeFilter: string;
  detailedFilters: PriceFilterState;
  onEdit: (price: Price) => void;
}

export interface FilteredPricesResult {
  data: Price[];
  total: number;
  hasMore: boolean;
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
