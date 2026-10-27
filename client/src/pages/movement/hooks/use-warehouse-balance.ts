import { useMemo } from "react";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useWarehouseBalance as useBaseWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { formatTonnes } from "@shared/units";
import {
  resolveWarehouseAverageCostPerTonne,
  resolveWarehouseBalanceTonnes,
} from "../warehouse-balance-utils";

interface UseWarehouseBalanceProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId: string;
  quantityTonnes: number;
  warehouses: any[];
  isEditing?: boolean;
  initialQuantityTonnes?: number;
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
    quantityTonnes,
    warehouses,
    isEditing = false,
    initialQuantityTonnes = 0,
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

  return useMemo<WarehouseBalanceResult>(() => {
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
    
    const fallbackBalanceTonnes = isPvkj
      ? fromWarehouse.pvkjBalanceTonnes
      : fromWarehouse.currentBalanceTonnes;
    const fallbackBalanceKilograms = isPvkj
      ? fromWarehouse.pvkjBalance
      : fromWarehouse.currentBalance;
    const baseBalanceTonnes = Math.min(
      resolveWarehouseBalanceTonnes(
        historicalBalanceStr,
        fallbackBalanceTonnes,
        fallbackBalanceKilograms,
      ),
      resolveWarehouseBalanceTonnes(
        currentBalanceStr,
        fallbackBalanceTonnes,
        fallbackBalanceKilograms,
      ),
    );
    
    const balanceTonnes = isEditing
      ? baseBalanceTonnes + initialQuantityTonnes
      : baseBalanceTonnes;

    const costPerTonne = resolveWarehouseAverageCostPerTonne(
      historicalBalanceStr,
      isPvkj
        ? fromWarehouse.pvkjAverageCostPerTonne
        : fromWarehouse.averageCostPerTonne,
      isPvkj ? fromWarehouse.pvkjAverageCost : fromWarehouse.averageCost,
    );

    if (balanceTonnes <= 0) {
      return { balance: balanceTonnes, cost: costPerTonne, status: "error", message: "Склад пуст" };
    }

    if (costPerTonne <= 0) {
      return { balance: balanceTonnes, cost: costPerTonne, status: "error", message: "Нет себестоимости" };
    }

    if (quantityTonnes <= 0) {
      return { balance: balanceTonnes, cost: costPerTonne, status: "ok", message: `${formatTonnes(balanceTonnes)} т` };
    }
    
    if (quantityTonnes > 0) {
      const remainingTonnes = balanceTonnes - quantityTonnes;
      if (remainingTonnes < 0) {
        return { balance: balanceTonnes, cost: costPerTonne, status: "error", message: `Недостаточно! Доступно: ${formatTonnes(balanceTonnes)} т` };
      }
      return { balance: balanceTonnes, cost: costPerTonne, status: "ok", message: `ОК: ${formatTonnes(remainingTonnes)} т` };
    }

    return { balance: balanceTonnes, cost: costPerTonne, status: "ok", message: `${formatTonnes(balanceTonnes)} т` };
  }, [watchMovementType, watchProductType, watchFromWarehouseId, quantityTonnes, warehouses, isEditing, initialQuantityTonnes, historicalBalanceStr, currentBalanceStr, isLoading]);
}

export const useWarehouseBalance = useWarehouseBalanceMov;
