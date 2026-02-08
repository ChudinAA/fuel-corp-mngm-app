import {
  CounterpartyRole,
  CounterpartyType,
  ProductType,
  Currency,
} from "@shared/constants";
import type { Price } from "@shared/schema";

export interface PriceFormData {
  dateFrom: Date;
  dateTo: Date;
  counterpartyType: CounterpartyType;
  counterpartyRole: CounterpartyRole;
  counterpartyId: string;
  productType: ProductType;
  basis: string;
  basisId?: string;
  volume?: string;
  priceValues: Array<{ price: string }>;
  contractNumber?: string;
  notes?: string;
  currency?: string;
  currencyId?: string;
  targetCurrencyId?: string;
}

export interface PriceDialogProps {
  editPrice?: Price | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export interface PricesTableProps {
  dealTypeFilter: "all" | "wholesale" | "refueling" | "refueling_abroad";
  roleFilter: "all" | "supplier" | "buyer";
  productTypeFilter: string;
  onEdit: (price: Price) => void;
}

export interface SelectionCheckState {
  calculating: boolean;
  result: string | null;
}

export interface DateCheckParams {
  counterpartyId: string;
  counterpartyType: string;
  counterpartyRole: string;
  basis: string;
  productType: string;
  dateFrom: Date;
  dateTo: Date;
  excludeId?: string;
}

export interface DateCheckState {
  checking: boolean;
  result: {
    status: string;
    message: string;
    overlaps?: { id: number; dateFrom: string; dateTo: string }[];
  } | null;
}
