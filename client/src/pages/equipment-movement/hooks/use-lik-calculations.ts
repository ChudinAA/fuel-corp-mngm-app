import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import {
  calculateEquipmentMovementTonnes,
  equipmentMovementLegacyPricePerKgToPerTonne,
  equipmentMovementTonnesToLegacyKg,
  type EquipmentMovementInputMode,
} from "../unit-calculations";
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
  watchTonnes?: string;
  inputMode: EquipmentMovementInputMode;
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
  watchTonnes,
  inputMode,
  warehouses,
  equipments,
  watchMovementDate,
}: UseLikCalculationsProps) {
  const calculatedTonnes = useMemo(
    () =>
      calculateEquipmentMovementTonnes(
        inputMode,
        watchTonnes,
        watchLiters,
        watchDensity,
      ),
    [inputMode, watchTonnes, watchLiters, watchDensity],
  );
  const tonnesNum = calculatedTonnes ?? 0;
  const calculatedKg = equipmentMovementTonnesToLegacyKg(tonnesNum);
  const kgNum = calculatedKg;

  // Live balance API gives real-time averageCost — avoids stale warehouse list props
  const isStorageToTzk = watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK;
  const { data: balanceData } = useWarehouseBalance(
    isStorageToTzk && watchFromWarehouseId ? watchFromWarehouseId : undefined,
    watchMovementDate instanceof Date ? watchMovementDate : undefined,
    watchProductType,
  );

  const averageCostPerKg = useMemo(() => {
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

  const averageCostPerTonne =
    equipmentMovementLegacyPricePerKgToPerTonne(averageCostPerKg) ?? 0;
  const purchaseAmount = tonnesNum * averageCostPerTonne;

  return {
    calculatedKg,
    calculatedTonnes,
    tonnesNum,
    kgNum,
    averageCostPerKg,
    averageCostPerTonne,
    purchaseAmount,
  };
}
