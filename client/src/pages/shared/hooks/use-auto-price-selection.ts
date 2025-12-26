
import { useEffect } from "react";
import type { Price } from "@shared/schema";

interface UseAutoPriceSelectionProps {
  supplierId: string;
  buyerId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  isWarehouseSupplier: boolean;
  editData: any;
  setSelectedPurchasePriceId: (id: string) => void;
  setSelectedSalePriceId: (id: string) => void;
  formSetValue: (field: string, value: string) => void;
}

export function useAutoPriceSelection({
  supplierId,
  buyerId,
  purchasePrices,
  salePrices,
  isWarehouseSupplier,
  editData,
  setSelectedPurchasePriceId,
  setSelectedSalePriceId,
  formSetValue,
}: UseAutoPriceSelectionProps) {
  // Автоматический выбор первой цены покупки при выборе поставщика
  useEffect(() => {
    if (supplierId && purchasePrices.length > 0 && !isWarehouseSupplier && !editData) {
      const firstPurchasePriceId = `${purchasePrices[0].id}-0`;
      setSelectedPurchasePriceId(firstPurchasePriceId);
      formSetValue("selectedPurchasePriceId", firstPurchasePriceId);
    }
  }, [supplierId, purchasePrices, editData, isWarehouseSupplier, setSelectedPurchasePriceId, formSetValue]);

  // Автоматический выбор первой цены продажи при выборе покупателя
  useEffect(() => {
    if (buyerId && salePrices.length > 0 && !editData) {
      const firstSalePriceId = `${salePrices[0].id}-0`;
      setSelectedSalePriceId(firstSalePriceId);
      formSetValue("selectedSalePriceId", firstSalePriceId);
    }
  }, [buyerId, salePrices, editData, setSelectedSalePriceId, formSetValue]);
}
