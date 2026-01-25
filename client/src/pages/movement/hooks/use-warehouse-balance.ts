import { useMemo } from "react";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useWarehouseBalance as useBaseWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { formatNumber } from "../utils";

interface UseWarehouseBalanceProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId: string;
  kgNum: number;
  warehouses: any[];
  isEditing?: boolean;
  initialWarehouseBalance?: number;
  watchMovementDate?: Date;
}

interface WarehouseBalanceResult {
  balance: number;
  cost: number;
  status: "ok" | "error" | "warning";
  message: string;
}

export function useWarehouseBalanceMov(props: UseWarehouseBalanceProps): WarehouseBalanceResult {
  const {
    watchMovementType,
    watchProductType,
    watchFromWarehouseId,
    kgNum,
    warehouses,
    isEditing = false,
    initialWarehouseBalance = 0,
    watchMovementDate,
  } = props;

  const isBackdated = useMemo(() => {
    if (!watchMovementDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(watchMovementDate);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate.getTime() < today.getTime();
  }, [watchMovementDate]);

  const { data: historicalBalanceStr, isLoading: isHistoricalLoading } = useBaseWarehouseBalance(
    (watchMovementType === MOVEMENT_TYPE.INTERNAL && isBackdated) ? watchFromWarehouseId : undefined,
    watchMovementDate,
    watchProductType
  );

  const { data: currentBalanceStr, isLoading: isCurrentLoading } = useBaseWarehouseBalance(
    (watchMovementType === MOVEMENT_TYPE.INTERNAL) ? watchFromWarehouseId : undefined,
    new Date(),
    watchProductType
  );

  const isLoading = isHistoricalLoading || isCurrentLoading;

  return useMemo(() => {
    if (watchMovementType !== MOVEMENT_TYPE.INTERNAL || !watchFromWarehouseId) {
      return { balance: 0, cost: 0, status: "ok", message: "—" };
    }

    if (isLoading) {
      return { balance: 0, cost: 0, status: "ok", message: "Загрузка..." };
    }

    const fromWarehouse = warehouses.find(w => w.id === watchFromWarehouseId);
    if (!fromWarehouse) {
      return { balance: 0, cost: 0, status: "error", message: "Склад не найден" };
    }

    const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
    
    const hist = historicalBalanceStr && typeof historicalBalanceStr === 'object' && 'balance' in historicalBalanceStr
      ? parseFloat(historicalBalanceStr.balance)
      : parseFloat(isPvkj ? fromWarehouse.pvkjBalance || "0" : fromWarehouse.currentBalance || "0");
      
    const curr = currentBalanceStr && typeof currentBalanceStr === 'object' && 'balance' in currentBalanceStr
      ? parseFloat(currentBalanceStr.balance)
      : parseFloat(isPvkj ? fromWarehouse.pvkjBalance || "0" : fromWarehouse.currentBalance || "0");
    
    let baseBalance = Math.min(hist, curr);
    
    // ВАЖНО: Приводим к единообразию с ОПТ и Заправками.
    // initialWarehouseBalance теперь передается как начальный объем сделки (initialQuantityKg).
    let balance = isEditing ? baseBalance + initialWarehouseBalance : baseBalance;

    const cost = historicalBalanceStr && typeof historicalBalanceStr === 'object' && 'averageCost' in historicalBalanceStr && historicalBalanceStr.averageCost
      ? parseFloat(historicalBalanceStr.averageCost)
      : parseFloat(isPvkj ? fromWarehouse.pvkjAverageCost || "0" : fromWarehouse.averageCost || "0");

    if (balance <= 0) {
      return { balance, cost, status: "error", message: "Склад пуст" };
    }

    if (cost <= 0) {
      return { balance, cost, status: "error", message: "Нет себестоимости" };
    }

    if (kgNum <= 0) {
      return { status: "ok", message: `${formatNumber(balance)} кг` };
    }
    
    if (kgNum > 0) {
      const remaining = balance - kgNum;
      if (remaining < 0) {
        return { balance, cost, status: "error", message: `Недостаточно! Доступно: ${balance.toLocaleString()} кг` };
      }
      return { balance, cost, status: "ok", message: `ОК: ${remaining.toLocaleString()} кг` };
    }

    return { balance, cost, status: "ok", message: `${balance.toLocaleString()} кг` };
  }, [watchMovementType, watchProductType, watchFromWarehouseId, kgNum, warehouses, isEditing, initialWarehouseBalance, historicalBalanceStr, currentBalanceStr, isLoading]);
}

export const useWarehouseBalance = useWarehouseBalanceMov;
