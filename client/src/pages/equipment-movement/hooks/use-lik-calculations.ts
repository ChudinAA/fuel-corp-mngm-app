import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import {
  calculateEquipmentMovementTonnes,
  equipmentMovementTonnesToLegacyKg,
  type EquipmentMovementInputMode,
} from "../unit-calculations";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { resolveWarehouseAverageCostPerTonne } from "@/pages/shared/utils/warehouse-balance-units";

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
    const legacySourceRate = isStorageToTzk
      ? watchProductType === PRODUCT_TYPE.PVKJ
        ? sourceWarehouse?.pvkjAverageCost
        : sourceWarehouse?.averageCost
      : watchProductType === PRODUCT_TYPE.PVKJ
        ? sourceEquipment?.pvkjAverageCost
        : sourceEquipment?.averageCost;

    if (isStorageToTzk) {
      const liveRate =
        balanceData &&
        typeof balanceData === "object" &&
        (("averageCostPerTonne" in balanceData &&
          balanceData.averageCostPerTonne != null) ||
          ("averageCost" in balanceData && balanceData.averageCost != null))
          ? resolveWarehouseAverageCostPerTonne(balanceData)
          : null;
      if (liveRate !== null) return liveRate;
    }

    if (explicitSourceRate == null && legacySourceRate == null) return 0;
    return resolveWarehouseAverageCostPerTonne(
      undefined,
      explicitSourceRate,
      legacySourceRate,
    );
  }, [
    isStorageToTzk,
    balanceData,
    watchFromWarehouseId,
    watchFromEquipmentId,
    watchProductType,
    warehouses,
    equipments,
  ]);

  const purchaseAmount = tonnesNum * averageCostPerTonne;

  return {
    calculatedKg,
    calculatedTonnes,
    tonnesNum,
    kgNum,
    averageCostPerTonne,
    purchaseAmount,
  };
}
