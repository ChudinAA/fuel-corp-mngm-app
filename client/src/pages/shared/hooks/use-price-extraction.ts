
import { useMemo } from "react";
import type { Price, Supplier, Warehouse } from "@shared/schema";
import { PRODUCT_TYPE } from "@shared/constants";
import {
  extractPriceRate,
  warehouseAverageCostRate,
  type PriceRateUnit,
} from "../utils/price-rate";
import { getStoredBasisPriceRate } from "../utils/basis-price-units";

type WarehouseWithCostRates = Warehouse & {
  averageCostPerTonne?: string | null;
  pvkjAverageCostPerTonne?: string | null;
};

interface UsePriceExtractionProps {
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  isWarehouseSupplier: boolean;
  supplierWarehouse?: WarehouseWithCostRates;
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
        const serviceRate = basisPrice
          ? getStoredBasisPriceRate(
              basisPrice.servicePricePerTonne,
              basisPrice.servicePrice,
            )
          : null;
        if (serviceRate?.value) {
          return serviceRate;
        }
      }
    }

    // Для ПВКЖ - сначала проверяем basis-specific pvkj_price у поставщика
    if (productType === PRODUCT_TYPE.PVKJ) {
      if (basisId && selectedSupplier?.basisPrices) {
        const basisPrice = selectedSupplier.basisPrices.find(
          (bp) => bp.basisId === basisId
        );
        const pvkjRate = basisPrice
          ? getStoredBasisPriceRate(
              basisPrice.pvkjPricePerTonne,
              basisPrice.pvkjPrice,
            )
          : null;
        if (pvkjRate?.value) {
          return pvkjRate;
        }
      }
      // Если basis price не задана — берём со склада
      if (isWarehouseSupplier && supplierWarehouse) {
        return warehouseAverageCostRate(
          supplierWarehouse.pvkjAverageCostPerTonne,
          supplierWarehouse.pvkjAverageCost,
        );
      }
      // Если нет basis-price и поставщик не склад — используем цену из таблицы цен (fall-through ниже)
    }

    // Для керосина со склада
    if (isWarehouseSupplier && supplierWarehouse && productType !== PRODUCT_TYPE.SERVICE) {
      return warehouseAverageCostRate(
        supplierWarehouse.averageCostPerTonne,
        supplierWarehouse.averageCost,
      );
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
