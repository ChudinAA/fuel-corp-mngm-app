import { useMemo } from "react";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { PRODUCT_TYPE } from "@shared/constants";

interface UseOptWarehouseBalanceProps {
  warehouseId?: string;
  dealDate?: Date;
  isEditing?: boolean;
  editQuantityKg?: string;
  initialCurrentBalance?: string;
}

export function useOptWarehouseBalance({
  warehouseId,
  dealDate,
  isEditing,
  editQuantityKg,
  initialCurrentBalance,
}: UseOptWarehouseBalanceProps) {
  const isBackdated = useMemo(() => {
    if (!dealDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dealDate);
    selectedDate.setHours(0, 0, 0, 0);
    // Считаем задним числом только если дата СТРОГО раньше сегодня
    return selectedDate.getTime() < today.getTime();
  }, [dealDate]);

  const { data: historicalData, isLoading: isHistoricalLoading } =
    useWarehouseBalance(
      isBackdated ? warehouseId : undefined,
      dealDate,
      PRODUCT_TYPE.KEROSENE,
    );

  const { data: currentData, isLoading: isCurrentLoading } =
    useWarehouseBalance(warehouseId, new Date(), PRODUCT_TYPE.KEROSENE);

  const availableBalance = useMemo(() => {
    if (!warehouseId) return null;

    // Если мы еще загружаем данные, возвращаем null
    if (isHistoricalLoading || isCurrentLoading) return null;

    const hist = historicalData?.balance
      ? parseFloat(historicalData.balance)
      : initialCurrentBalance
        ? parseFloat(initialCurrentBalance)
        : 0;
    const curr = currentData?.balance
      ? parseFloat(currentData.balance)
      : initialCurrentBalance
        ? parseFloat(initialCurrentBalance)
        : 0;

    // Используем минимум из исторического и текущего остатка
    const baseBalance = Math.min(hist, curr);

    if (isEditing && editQuantityKg) {
      return baseBalance + parseFloat(editQuantityKg);
    }

    return baseBalance;
  }, [
    warehouseId,
    isBackdated,
    historicalData,
    currentData,
    isHistoricalLoading,
    isCurrentLoading,
    isEditing,
    editQuantityKg,
    initialCurrentBalance,
  ]);

  const warehousePrice = useMemo(() => {
    if (isHistoricalLoading) return null;
    return historicalData?.averageCost ? parseFloat(historicalData.averageCost) : null;
  }, [historicalData, isHistoricalLoading]);

  return {
    availableBalance,
    warehousePrice,
    isLoading: isHistoricalLoading || isCurrentLoading,
  };
}
