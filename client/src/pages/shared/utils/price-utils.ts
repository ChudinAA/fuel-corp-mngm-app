
import type { Price } from "@shared/schema";

export interface ParsedPriceId {
  priceId: string | null;
  priceIndex: number;
}

export function parsePriceCompositeId(compositeId: string): ParsedPriceId {
  if (!compositeId) {
    return { priceId: null, priceIndex: 0 };
  }

  const parts = compositeId.split('-');
  if (parts.length >= 5) {
    return {
      priceId: parts.slice(0, -1).join('-'),
      priceIndex: parseInt(parts[parts.length - 1]),
    };
  }

  return {
    priceId: compositeId,
    priceIndex: 0,
  };
}

export function extractPriceIdsForSubmit(
  selectedPurchasePriceId: string,
  selectedSalePriceId: string,
  purchasePrices: Price[],
  salePrices: Price[],
  isWarehouseSupplier: boolean
): {
  purchasePriceId: string | null;
  purchasePriceIndex: number;
  salePriceId: string | null;
  salePriceIndex: number;
} {
  let purchasePriceId = null;
  let purchasePriceIndex = 0;

  if (!isWarehouseSupplier && selectedPurchasePriceId) {
    const parsed = parsePriceCompositeId(selectedPurchasePriceId);
    purchasePriceId = parsed.priceId;
    purchasePriceIndex = parsed.priceIndex;
  } else if (!isWarehouseSupplier && purchasePrices.length > 0) {
    purchasePriceId = purchasePrices[0].id;
    purchasePriceIndex = 0;
  }

  let salePriceId = null;
  let salePriceIndex = 0;

  if (selectedSalePriceId) {
    const parsed = parsePriceCompositeId(selectedSalePriceId);
    salePriceId = parsed.priceId;
    salePriceIndex = parsed.priceIndex;
  } else if (salePrices.length > 0) {
    salePriceId = salePrices[0].id;
    salePriceIndex = 0;
  }

  return {
    purchasePriceId,
    purchasePriceIndex,
    salePriceId,
    salePriceIndex,
  };
}
