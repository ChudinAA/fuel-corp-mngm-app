
import { useMemo } from "react";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";

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

export function useWarehouseBalance({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  kgNum,
  warehouses,
  isEditing = false,
  initialWarehouseBalance = 0,
  watchMovementDate,
}: UseWarehouseBalanceProps): WarehouseBalanceResult {
  
  return useMemo(() => {
    if (watchMovementType !== MOVEMENT_TYPE.INTERNAL || !watchFromWarehouseId) {
      return { balance: 0, cost: 0, status: "ok", message: "—" };
    }

    const fromWarehouse = warehouses.find(w => w.id === watchFromWarehouseId);
    if (!fromWarehouse) {
      return { balance: 0, cost: 0, status: "error", message: "Склад не найден" };
    }

    const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
    
    const { data: historicalBalanceStr } = useWarehouseBalance(
      watchFromWarehouseId || undefined,
      watchMovementDate,
      watchProductType
    );

    const historicalBalanceAtDate = historicalBalanceStr ? parseFloat(historicalBalanceStr) : null;

    // Приоритет отдаем историческому балансу, если он загружен
    let balance: number;
    if (historicalBalanceAtDate !== null) {
      balance = isEditing && initialWarehouseBalance > 0
        ? historicalBalanceAtDate + (initialWarehouseBalance - parseFloat(isPvkj ? fromWarehouse.pvkjBalance || "0" : fromWarehouse.currentBalance || "0"))
        : historicalBalanceAtDate;
    } else {
      // Фолбек на текущий баланс
      balance = isEditing && initialWarehouseBalance > 0 
        ? initialWarehouseBalance 
        : parseFloat(isPvkj ? fromWarehouse.pvkjBalance || "0" : fromWarehouse.currentBalance || "0");
    }

    const cost = parseFloat(isPvkj ? fromWarehouse.pvkjAverageCost || "0" : fromWarehouse.averageCost || "0");

    if (balance <= 0) {
      return { balance, cost, status: "error", message: "Склад пуст" };
    }

    if (cost <= 0) {
      return { balance, cost, status: "error", message: "Нет себестоимости" };
    }

    if (kgNum > 0) {
      const remaining = balance - kgNum;
      if (remaining < 0) {
        return { balance, cost, status: "error", message: `Недостаточно! Доступно: ${balance.toLocaleString()} кг` };
      }
      return { balance, cost, status: "ok", message: `ОК: ${remaining.toLocaleString()} кг` };
    }

    return { balance, cost, status: "ok", message: `${balance.toLocaleString()} кг` };
  }, [watchMovementType, watchProductType, watchFromWarehouseId, kgNum, warehouses, isEditing, initialWarehouseBalance]);
}
