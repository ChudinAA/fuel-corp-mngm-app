
import { useEffect } from "react";
import type { Price } from "@shared/schema";

interface UseAutoPriceSelectionProps {
  supplierId: string;
  buyerId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  isWarehouseSupplier: boolean;
  productType: string;
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
  productType,
  editData,
  setSelectedPurchasePriceId,
  setSelectedSalePriceId,
  formSetValue,
}: UseAutoPriceSelectionProps) {

  // Автоматический выбор первой цены покупки при выборе поставщика
  useEffect(() => {
    if (supplierId && purchasePrices.length > 0 && !isWarehouseSupplier && !editData && productType !== "service") {
      const firstPurchasePriceId = `${purchasePrices[0].id}-0`;
      setSelectedPurchasePriceId(firstPurchasePriceId);
      formSetValue("selectedPurchasePriceId", firstPurchasePriceId);
    }
  }, [supplierId, purchasePrices, editData, isWarehouseSupplier, setSelectedPurchasePriceId, formSetValue, productType]);

  // Автоматический выбор первой цены продажи при выборе покупателя или изменении цен (например, при смене точки поставки)
  useEffect(() => {
    if (buyerId && salePrices.length > 0 && !editData) {
      const firstSalePriceId = `${salePrices[0].id}-0`;
      setSelectedSalePriceId(firstSalePriceId);
      formSetValue("selectedSalePriceId", firstSalePriceId);
    } else if (buyerId && salePrices.length === 0 && !editData) {
      // Очищаем выбор, если цен для нового базиса нет
      setSelectedSalePriceId("");
      formSetValue("selectedSalePriceId", "");
    }
  }, [buyerId, salePrices, editData, setSelectedSalePriceId, formSetValue]);
}
