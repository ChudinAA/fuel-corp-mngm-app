import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { calculateKgFromLiters } from "../../movement/utils";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";

interface UseLikCalculationsProps {
  form: any;
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId?: string | null;
  watchToWarehouseId?: string | null;
  watchFromEquipmentId?: string | null;
  watchToEquipmentId?: string | null;
  watchMovementDate: Date;
  watchLiters?: string;
  watchDensity?: string;
  watchKg?: string;
  inputMode: "liters" | "kg";
  warehouses: any[];
  equipments: any[];
}

export function useLikCalculations({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  watchFromEquipmentId,
  watchLiters,
  watchDensity,
  watchKg,
  inputMode,
  warehouses,
  equipments,
  watchMovementDate,
}: UseLikCalculationsProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && watchLiters && watchDensity) {
      return calculateKgFromLiters(
        parseFloat(watchLiters),
        parseFloat(watchDensity),
      );
    }
    return watchKg ? parseFloat(watchKg) : 0;
  }, [inputMode, watchLiters, watchDensity, watchKg]);

  const kgNum = calculatedKg || 0;

  // Live balance API gives real-time averageCost — avoids stale warehouse list props
  const isStorageToTzk = watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK;
  const { data: balanceData } = useWarehouseBalance(
    isStorageToTzk && watchFromWarehouseId ? watchFromWarehouseId : undefined,
    watchMovementDate instanceof Date ? watchMovementDate : undefined,
    watchProductType,
  );

  const averageCost = useMemo(() => {
    if (isStorageToTzk) {
      // Prefer live averageCost from balance API (always up-to-date)
      if (balanceData && typeof balanceData === "object" && "averageCost" in balanceData && balanceData.averageCost) {
        return parseFloat(balanceData.averageCost as string);
      }
      // Fallback to warehouse list (may be stale after new movements)
      const sourceWarehouse = warehouses.find((w) => w.id === watchFromWarehouseId);
      if (!sourceWarehouse) return 0;
      const costStr =
        watchProductType === PRODUCT_TYPE.PVKJ
          ? sourceWarehouse.pvkjAverageCost
          : sourceWarehouse.averageCost;
      return costStr ? parseFloat(costStr) : 0;
    } else {
      // TZK_TO_STORAGE or other: source is equipment
      const sourceEquipment = equipments.find((e) => e.id === watchFromEquipmentId);
      if (!sourceEquipment) return 0;
      const costStr =
        watchProductType === PRODUCT_TYPE.PVKJ
          ? sourceEquipment.pvkjAverageCost
          : sourceEquipment.averageCost;
      return costStr ? parseFloat(costStr) : 0;
    }
  }, [
    isStorageToTzk,
    balanceData,
    watchFromWarehouseId,
    watchFromEquipmentId,
    watchProductType,
    warehouses,
    equipments,
  ]);

  const purchaseAmount = kgNum * averageCost;

  return {
    calculatedKg,
    kgNum,
    averageCost,
    purchaseAmount,
  };
}
