
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
}

export interface PriceDialogProps {
  editPrice?: Price | null;
  onEditComplete?: () => void;
}

export interface PricesTableProps {
  counterpartyRole: "supplier" | "buyer";
  counterpartyType: "wholesale" | "refueling";
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
