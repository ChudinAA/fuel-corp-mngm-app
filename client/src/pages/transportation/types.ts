export interface TransportationFormData {
  supplierId: string | null;
  buyerId: string | null;
  dealDate: string | null;
  basisId: string | null;
  customerBasisId: string | null;
  productType: string | null;
  quantityLiters: number | null;
  density: number | null;
  quantityKg: number | null;
  inputMode: string | null;
  purchasePrice: number | null;
  purchasePriceId: string | null;
  purchasePriceIndex: number;
  salePrice: number | null;
  salePriceId: string | null;
  salePriceIndex: number;
  purchaseAmount: number | null;
  saleAmount: number | null;
  carrierId: string | null;
  deliveryLocationId: string | null;
  deliveryTariff: number | null;
  deliveryCost: number | null;
  profit: number | null;
  notes: string;
  isDraft: boolean;
}

export interface TransportationDialogProps {
  editItem?: any | null;
  onEditComplete?: () => void;
  isInline?: boolean;
  inlineOpen?: boolean;
  onInlineOpenChange?: (open: boolean) => void;
  defaultValues?: Partial<TransportationFormData>;
}
