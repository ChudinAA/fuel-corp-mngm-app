
import { useMemo } from "react";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";

interface UseWarehouseBalanceProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId: string;
  kgNum: number;
  warehouses: any[];
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
    const balance = parseFloat(isPvkj ? fromWarehouse.pvkjBalance || "0" : fromWarehouse.currentBalance || "0");
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
  }, [watchMovementType, watchProductType, watchFromWarehouseId, kgNum, warehouses]);
}
