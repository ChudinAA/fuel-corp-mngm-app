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
  const { data: historicalBalanceStr, isLoading } = useWarehouseBalance(
    warehouseId,
    dealDate,
    PRODUCT_TYPE.KEROSENE
  );

  const availableBalance = useMemo(() => {
    if (!warehouseId || !dealDate) return null;
    
    // Если данные еще грузятся, возвращаем null чтобы не показывать неверный остаток
    if (isLoading) return null;

    const balanceAtDate = historicalBalanceStr ? parseFloat(historicalBalanceStr) : 0;

    if (isEditing && editQuantityKg) {
      // При редактировании: остаток на дату + объем текущей сделки (возвращаем его в "пул" доступного)
      return balanceAtDate + parseFloat(editQuantityKg);
    }

    return balanceAtDate;
  }, [warehouseId, dealDate, historicalBalanceStr, isLoading, isEditing, editQuantityKg]);

  return {
    availableBalance,
    isLoading,
  };
}
