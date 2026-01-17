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
    return selectedDate.getTime() < today.getTime();
  }, [dealDate]);

  const { data: historicalBalanceStr, isLoading } = useWarehouseBalance(
    isBackdated ? warehouseId : undefined,
    dealDate,
    PRODUCT_TYPE.KEROSENE
  );

  const availableBalance = useMemo(() => {
    if (!warehouseId) return null;
    
    // Если это текущая дата, берем баланс из объекта склада (уже загружен в OptForm)
    if (!isBackdated) {
      // Баланс будет передан через initialCurrentBalance или найден в warehouses
      return initialCurrentBalance ? parseFloat(initialCurrentBalance) : null;
    }

    if (isLoading) return null;

    const balanceAtDate = historicalBalanceStr ? parseFloat(historicalBalanceStr) : 0;

    if (isEditing && editQuantityKg) {
      return balanceAtDate + parseFloat(editQuantityKg);
    }

    return balanceAtDate;
  }, [warehouseId, isBackdated, historicalBalanceStr, isLoading, isEditing, editQuantityKg, initialCurrentBalance]);

  return {
    availableBalance,
    isLoading,
  };
}
