import {
  CounterpartyRole,
  CounterpartyType,
  ProductType,
  Currency,
} from "@shared/constants";
import type { Price } from "@shared/schema";

export interface PriceApi extends Omit<Price, "priceValues"> {
  priceRate?: {
    unit: "tonne" | "liter";
    values: Array<number | null>;
  };
  contractVolume?: {
    limitUnit: "tonne";
    limit: number | null;
    usedUnit: "tonne";
    used: number | null;
  };
}

export interface PriceFormData {
  dateFrom: Date;
  dateTo: Date;
  counterpartyType: CounterpartyType;
  counterpartyRole: CounterpartyRole;
  counterpartyId: string;
  productType: ProductType;
  nomenclatureId?: string | null;
  contractId: string;
  basis: string;
  basisId?: string;
  limitType?: "volume" | "amount";
  volume?: string;
  maxDealAmount?: string;
  priceValues: Array<{ price: string }>;
  contractNumber?: string;
  contractAppendix?: string;
  notes?: string;
  currency?: string;
  currencyId?: string;
  loadingBasisId?: string;
  priceUnit?: "tonne" | "liter";
  contractLimitEnabled?: boolean;
}

export interface PriceDialogProps {
  editPrice?: PriceApi | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
  inlineDefaults?: Partial<PriceFormData>;
}

export interface PricesTableProps {
  dealTypeFilter: "all" | "wholesale" | "refueling" | "abroad";
  roleFilter: "all" | "supplier" | "buyer";
  productTypeFilter: string;
  onEdit?: (price: PriceApi) => void;
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
