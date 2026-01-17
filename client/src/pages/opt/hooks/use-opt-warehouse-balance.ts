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

import { isSameDay } from "date-fns";

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

  const { data: historicalBalanceStr, isLoading: isHistoricalLoading } = useWarehouseBalance(
    isBackdated ? warehouseId : undefined,
    dealDate,
    PRODUCT_TYPE.KEROSENE
  );

  const { data: currentBalanceStr, isLoading: isCurrentLoading } = useWarehouseBalance(
    warehouseId,
    new Date(),
    PRODUCT_TYPE.KEROSENE
  );

  const availableBalance = useMemo(() => {
    if (!warehouseId) return null;
    
    // Если мы еще загружаем данные, возвращаем null
    if (isHistoricalLoading || isCurrentLoading) return null;

    const hist = historicalBalanceStr ? parseFloat(historicalBalanceStr) : (initialCurrentBalance ? parseFloat(initialCurrentBalance) : 0);
    const curr = currentBalanceStr ? parseFloat(currentBalanceStr) : (initialCurrentBalance ? parseFloat(initialCurrentBalance) : 0);
    
    // Используем минимум из исторического и текущего остатка
    const baseBalance = Math.min(hist, curr);

    if (isEditing && editQuantityKg) {
      return baseBalance + parseFloat(editQuantityKg);
    }

    return baseBalance;
  }, [warehouseId, isBackdated, historicalBalanceStr, currentBalanceStr, isHistoricalLoading, isCurrentLoading, isEditing, editQuantityKg, initialCurrentBalance]);

  return {
    availableBalance,
    isLoading: isHistoricalLoading || isCurrentLoading,
  };
}
