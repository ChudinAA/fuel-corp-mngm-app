import { useMemo } from "react";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { calculateKgFromLiters } from "../../movement/utils";

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
}: UseLikCalculationsProps) {
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && watchLiters && watchDensity) {
      return calculateKgFromLiters(parseFloat(watchLiters), parseFloat(watchDensity));
    }
    return watchKg ? parseFloat(watchKg) : 0;
  }, [inputMode, watchLiters, watchDensity, watchKg]);

  const kgNum = calculatedKg || 0;

  const averageCost = useMemo(() => {
    let sourceWarehouse = null;

    if (watchMovementType === MOVEMENT_TYPE.LIK_STORAGE_TO_TZA && watchFromWarehouseId) {
      sourceWarehouse = warehouses.find((w) => w.id === watchFromWarehouseId);
    } else if (watchFromEquipmentId) {
      const tza = equipments.find((e) => e.id === watchFromEquipmentId);
      if (tza && tza.warehouseId) {
        sourceWarehouse = warehouses.find((w) => w.id === tza.warehouseId);
      }
    }

    if (!sourceWarehouse) return 0;

    const costStr = watchProductType === PRODUCT_TYPE.PVKJ ? sourceWarehouse.pvkjAverageCost : sourceWarehouse.averageCost;
    return costStr ? parseFloat(costStr) : 0;
  }, [watchMovementType, watchFromWarehouseId, watchFromEquipmentId, watchProductType, warehouses, equipments]);

  const purchaseAmount = kgNum * averageCost;

  return {
    calculatedKg,
    kgNum,
    averageCost,
    purchaseAmount,
  };
}
