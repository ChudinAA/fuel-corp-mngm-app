import { useEffect, useRef } from "react";
import type { Price } from "@shared/schema";

interface UseAutoPriceSelectionProps {
  supplierId: string;
  buyerId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  isWarehouseSupplier: boolean;
  editData?: any;
  setSelectedPurchasePriceId: (id: string) => void;
  setSelectedSalePriceId: (id: string) => void;
  formSetValue: (name: string, value: any) => void;
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
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
  selectedPurchasePriceId,
  selectedSalePriceId,
}: UseAutoPriceSelectionProps) {
  const purchasePriceManuallySelected = useRef(false);
  const salePriceManuallySelected = useRef(false);
  const lastSupplierBuyer = useRef<string>("");

  useEffect(() => {
    const currentKey = `${supplierId}-${buyerId}`;

    // Если изменились поставщик или покупатель, сбрасываем флаги ручного выбора
    if (currentKey !== lastSupplierBuyer.current) {
      purchasePriceManuallySelected.current = false;
      salePriceManuallySelected.current = false;
      lastSupplierBuyer.current = currentKey;
    }

    // Автовыбор цены покупки только если не выбрана вручную
    if (!editData && supplierId && buyerId && purchasePrices.length > 0 && !isWarehouseSupplier && !purchasePriceManuallySelected.current) {
      const firstPurchasePrice = purchasePrices[0];
      const compositeId = `${firstPurchasePrice.id}-0`;
      setSelectedPurchasePriceId(compositeId);
      formSetValue("selectedPurchasePriceId", compositeId);
    }
  }, [supplierId, buyerId, purchasePrices, isWarehouseSupplier, editData, setSelectedPurchasePriceId, formSetValue]);

  useEffect(() => {
    const currentKey = `${supplierId}-${buyerId}`;

    if (currentKey !== lastSupplierBuyer.current) {
      lastSupplierBuyer.current = currentKey;
    }

    // Автовыбор цены продажи только если не выбрана вручную
    if (!editData && supplierId && buyerId && salePrices.length > 0 && !salePriceManuallySelected.current) {
      const firstSalePrice = salePrices[0];
      const compositeId = `${firstSalePrice.id}-0`;
      setSelectedSalePriceId(compositeId);
      formSetValue("selectedSalePriceId", compositeId);
    }
  }, [supplierId, buyerId, salePrices, editData, setSelectedSalePriceId, formSetValue]);

  // Отслеживаем ручной выбор цен
  useEffect(() => {
    if (!editData && selectedPurchasePriceId && purchasePrices.length > 0) {
      const firstCompositeId = `${purchasePrices[0].id}-0`;
      if (selectedPurchasePriceId !== firstCompositeId) {
        purchasePriceManuallySelected.current = true;
      }
    }
  }, [selectedPurchasePriceId, purchasePrices, editData]);

  useEffect(() => {
    if (!editData && selectedSalePriceId && salePrices.length > 0) {
      const firstCompositeId = `${salePrices[0].id}-0`;
      if (selectedSalePriceId !== firstCompositeId) {
        salePriceManuallySelected.current = true;
      }
    }
  }, [selectedSalePriceId, salePrices, editData]);
}