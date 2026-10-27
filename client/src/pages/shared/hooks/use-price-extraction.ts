
import { useMemo } from "react";
import type { Price, Supplier, Warehouse } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import { extractPriceRate, type PriceRateUnit } from "../utils/price-rate";

interface UsePriceExtractionProps {
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse?: Warehouse;
  selectedSupplier?: Supplier;
  productType?: string;
  basisId?: string;
}

export function usePriceExtraction({
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  isWarehouseSupplier,
  supplierWarehouse,
  selectedSupplier,
  productType,
  basisId,
}: UsePriceExtractionProps) {
  const purchaseRate = useMemo(() => {
    // Для услуги заправки - сначала проверяем basis-specific service_price у поставщика
    if (productType === PRODUCT_TYPE.SERVICE) {
      if (basisId && selectedSupplier?.basisPrices) {
        const basisPrice = selectedSupplier.basisPrices.find(
          (bp) => bp.basisId === basisId
        );
        if (basisPrice?.servicePrice) {
          return { value: parseFloat(basisPrice.servicePrice), unit: "kg" as const };
        }
      }
    }

    // Для ПВКЖ - сначала проверяем basis-specific pvkj_price у поставщика
    if (productType === PRODUCT_TYPE.PVKJ) {
      if (basisId && selectedSupplier?.basisPrices) {
        const basisPrice = selectedSupplier.basisPrices.find(
          (bp) => bp.basisId === basisId
        );
        if (basisPrice?.pvkjPrice) {
          return { value: parseFloat(basisPrice.pvkjPrice), unit: "kg" as const };
        }
      }
      // Если basis price не задана — берём со склада
      if (isWarehouseSupplier && supplierWarehouse) {
        return { value: parseFloat(supplierWarehouse.pvkjAverageCost || "0"), unit: "kg" as const };
      }
      // Если нет basis-price и поставщик не склад — используем цену из таблицы цен (fall-through ниже)
    }

    // Для керосина со склада
    if (isWarehouseSupplier && supplierWarehouse && productType !== PRODUCT_TYPE.SERVICE) {
      return { value: parseFloat(supplierWarehouse.averageCost || "0"), unit: "kg" as const };
    }

    return extractPriceRate(purchasePrices, selectedPurchasePriceId);
  }, [purchasePrices, selectedPurchasePriceId, isWarehouseSupplier, supplierWarehouse, selectedSupplier, productType, basisId]);

  const saleRate = useMemo(() => {
    return extractPriceRate(salePrices, selectedSalePriceId);
  }, [salePrices, selectedSalePriceId]);

  return {
    purchasePrice: purchaseRate.value,
    purchasePriceUnit: purchaseRate.unit as PriceRateUnit,
    salePrice: saleRate.value,
    salePriceUnit: saleRate.unit,
  };
}
