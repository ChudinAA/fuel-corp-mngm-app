import { useMemo } from "react";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { readAverageCostPerTonne } from "@/pages/shared/utils/tonne-balance-values";
import { calculateOptWarehouseBalanceTonnes } from "../warehouse-balance-utils";

interface UseOptWarehouseBalanceProps {
  productType: string;
  warehouseId?: string;
  dealDate?: Date;
  editQuantityTonnes?: string;
}

export function useOptWarehouseBalance({
  productType,
  warehouseId,
  dealDate,
  editQuantityTonnes,
}: UseOptWarehouseBalanceProps) {
  const isBackdated = useMemo(() => {
    if (!dealDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dealDate);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate.getTime() < today.getTime();
  }, [dealDate]);

  const { data: historicalData, isLoading: isHistoricalLoading } =
    useWarehouseBalance(
      isBackdated ? warehouseId : undefined,
      dealDate,
      productType,
    );
  const { data: currentData, isLoading: isCurrentLoading } =
    useWarehouseBalance(warehouseId, new Date(), productType);

  const effectiveHistoricalData = isBackdated ? historicalData : currentData;
  const isLoading = isHistoricalLoading || isCurrentLoading;

  const availableBalanceTonnes = useMemo(() => {
    if (!warehouseId || isLoading) return null;
    return calculateOptWarehouseBalanceTonnes(
      effectiveHistoricalData,
      currentData,
      editQuantityTonnes,
    );
  }, [
    warehouseId,
    isLoading,
    effectiveHistoricalData,
    currentData,
    editQuantityTonnes,
  ]);

  const warehousePricePerTonne = useMemo(() => {
    if (!warehouseId || isHistoricalLoading) return null;
    return readAverageCostPerTonne(effectiveHistoricalData);
  }, [warehouseId, isHistoricalLoading, effectiveHistoricalData]);

  return {
    availableBalanceTonnes,
    warehousePricePerTonne,
    isLoading,
  };
}
