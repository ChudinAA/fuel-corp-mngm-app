import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import {
  calculateEquipmentMovementTonnes,
  type EquipmentMovementInputMode,
} from "../unit-calculations";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { useEquipmentBalance } from "@/hooks/use-equipment-balance";

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

  // Live balance API gives real-time averageCost — avoids stale warehouse list props
  const isStorageToTzk = watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK;
  const { data: balanceData } = useWarehouseBalance(
    isStorageToTzk && watchFromWarehouseId ? watchFromWarehouseId : undefined,
    watchMovementDate instanceof Date ? watchMovementDate : undefined,
    watchProductType,
  );
  const { data: equipmentBalanceData } = useEquipmentBalance(
    !isStorageToTzk && watchFromEquipmentId
      ? watchFromEquipmentId
      : undefined,
    watchMovementDate instanceof Date ? watchMovementDate : undefined,
    watchProductType,
    true,
  );

  const averageCostPerTonne = useMemo(() => {
    const sourceWarehouse = isStorageToTzk
      ? warehouses.find((w) => w.id === watchFromWarehouseId)
      : undefined;
    const sourceEquipment = !isStorageToTzk
      ? equipments.find((e) => e.id === watchFromEquipmentId)
      : undefined;

    const explicitSourceRate = isStorageToTzk
      ? watchProductType === PRODUCT_TYPE.PVKJ
        ? sourceWarehouse?.pvkjAverageCostPerTonne
        : sourceWarehouse?.averageCostPerTonne
      : watchProductType === PRODUCT_TYPE.PVKJ
        ? sourceEquipment?.pvkjAverageCostPerTonne
        : sourceEquipment?.averageCostPerTonne;
    if (isStorageToTzk) {
      const liveRate =
        balanceData &&
        typeof balanceData === "object" &&
        "averageCostPerTonne" in balanceData
          ? Number(balanceData.averageCostPerTonne)
          : null;
      if (liveRate !== null && Number.isFinite(liveRate)) return liveRate;
    } else {
      const liveRate =
        equipmentBalanceData &&
        typeof equipmentBalanceData === "object" &&
        "averageCostPerTonne" in equipmentBalanceData
          ? Number(equipmentBalanceData.averageCostPerTonne)
          : null;
      if (liveRate !== null && Number.isFinite(liveRate)) return liveRate;
    }

    if (explicitSourceRate == null) return 0;
    const rate = Number(explicitSourceRate);
    return Number.isFinite(rate) ? rate : 0;
  }, [
    isStorageToTzk,
    balanceData,
    equipmentBalanceData,
    watchFromWarehouseId,
    watchFromEquipmentId,
    watchProductType,
    warehouses,
    equipments,
  ]);

  const purchaseAmount = tonnesNum * averageCostPerTonne;

  return {
    calculatedTonnes,
    tonnesNum,
    averageCostPerTonne,
    purchaseAmount,
  };
}
