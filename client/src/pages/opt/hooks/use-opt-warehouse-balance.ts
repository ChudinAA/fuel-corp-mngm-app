import { useMemo } from "react";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { PRODUCT_TYPE } from "@shared/constants";

interface UseOptWarehouseBalanceProps {
  productType: string;
  warehouseId?: string;
  dealDate?: Date;
  isEditing?: boolean;
  editQuantityKg?: string;
  initialCurrentBalance?: string;
}

export function useOptWarehouseBalance({
  productType,
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
      productType,
    );

  const { data: currentData, isLoading: isCurrentLoading } =
    useWarehouseBalance(warehouseId, new Date(), productType);

  const availableBalance = useMemo(() => {
    if (!warehouseId) return null;

    // Если мы еще загружаем данные, возвращаем null
    if (isHistoricalLoading || isCurrentLoading) return null;

    const hist = historicalData && typeof historicalData === 'object' && 'balance' in historicalData
      ? parseFloat(historicalData.balance)
      : initialCurrentBalance
        ? parseFloat(initialCurrentBalance)
        : 0;
    const curr = currentData && typeof currentData === 'object' && 'balance' in currentData
      ? parseFloat(currentData.balance)
      : initialCurrentBalance
        ? parseFloat(initialCurrentBalance)
        : 0;

    // Используем минимум из исторического и текущего остатка
    const baseBalance = Math.min(hist, curr);

    // ВАЖНО: При редактировании editQuantityKg — это ИЗНАЧАЛЬНЫЙ объем сделки.
    // Чтобы получить "доступный остаток" (включая объем текущей сделки),
    // нам нужно прибавить его к baseBalance, если бэк его исключил.
    // Если мы создаем новую сделку, editQuantityKg = 0.
    
    const initialQty = editQuantityKg ? parseFloat(editQuantityKg) : 0;
    return baseBalance + initialQty;
  }, [
    warehouseId,
    isBackdated,
    historicalData,
    currentData,
    isHistoricalLoading,
    isCurrentLoading,
    editQuantityKg,
    initialCurrentBalance,
  ]);

  const warehousePrice = useMemo(() => {
    if (isHistoricalLoading) return null;
    return historicalData && typeof historicalData === 'object' && 'averageCost' in historicalData ? (historicalData.averageCost ? parseFloat(historicalData.averageCost) : null) : null;
  }, [historicalData, isHistoricalLoading]);

  return {
    availableBalance,
    warehousePrice,
    isLoading: isHistoricalLoading || isCurrentLoading,
  };
}
