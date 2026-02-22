import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useWarehouseBalance as useBaseWarehouseBalance } from "@/hooks/use-warehouse-balance";

interface UseLikBalanceProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId?: string | null;
  watchFromEquipmentId?: string | null;
  kgNum: number;
  warehouses: any[];
  equipments: any[];
  isEditing?: boolean;
  initialQuantityKg?: number;
  watchMovementDate?: Date;
}

export function useLikBalance({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  watchFromEquipmentId,
  kgNum,
  warehouses,
  equipments,
  isEditing = false,
  initialQuantityKg = 0,
  watchMovementDate,
}: UseLikBalanceProps) {
  const isBackdated = useMemo(() => {
    if (!watchMovementDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(watchMovementDate);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate.getTime() < today.getTime();
  }, [watchMovementDate]);

  // If from TZA, we need to find its parent warehouse to check balance logic
  // but for TZA we might have its own balance in equipment table
  const sourceId = watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA ? watchFromWarehouseId : watchFromEquipmentId;

  const { data: balanceData, isLoading } = useBaseWarehouseBalance(
    sourceId && watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA ? sourceId : undefined,
    watchMovementDate,
    watchProductType
  );

  return useMemo(() => {
    if (!sourceId) return { balance: 0, status: "ok", message: "—" };
    if (isLoading) return { balance: 0, status: "ok", message: "Загрузка..." };

    let currentBalance = 0;
    let name = "";

    if (watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZA) {
      const wh = warehouses.find((w) => w.id === sourceId);
      name = wh?.name || "";
      currentBalance = balanceData && typeof balanceData === "object" && "balance" in balanceData 
        ? parseFloat(balanceData.balance) 
        : parseFloat(watchProductType === PRODUCT_TYPE.PVKJ ? wh?.pvkjBalance || "0" : wh?.currentBalance || "0");
    } else {
      const eq = equipments.find((e) => e.id === sourceId);
      name = eq?.name || "";
      // For TZA we use equipment balance fields
      currentBalance = parseFloat(watchProductType === PRODUCT_TYPE.PVKJ ? eq?.pvkjBalance || "0" : eq?.currentBalance || "0");
    }

    const available = isEditing ? currentBalance + initialQuantityKg : currentBalance;

    if (available <= 0) return { balance: available, status: "error", message: `Склад пуст. Доступно: ${available.toLocaleString()} кг` };
    if (kgNum > available) return { balance: available, status: "error", message: `Недостаточно! Доступно: ${available.toLocaleString()} кг` };

    return { balance: available, status: "ok", message: `${available.toLocaleString()} кг` };
  }, [sourceId, isLoading, balanceData, watchProductType, watchMovementType, warehouses, equipments, isEditing, initialQuantityKg, kgNum]);
}
