import { useMemo } from "react";
import { EQUIPMENT_MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useWarehouseBalance as useBaseWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { formatTonnes, kilogramsToTonnes } from "@shared/units";

interface UseLikBalanceProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId?: string | null;
  watchFromEquipmentId?: string | null;
  quantityTonnes: number;
  warehouses: any[];
  equipments: any[];
  isEditing?: boolean;
  initialQuantityTonnes?: number;
  watchMovementDate?: Date;
}

export function useLikBalance({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  watchFromEquipmentId,
  quantityTonnes,
  warehouses,
  equipments,
  isEditing = false,
  initialQuantityTonnes = 0,
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

  // If from TZK, we need to find its parent warehouse to check balance logic
  // but for TZK we might have its own balance in equipment table
  const sourceId = watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK ? watchFromWarehouseId : watchFromEquipmentId;

  const { data: balanceData, isLoading } = useBaseWarehouseBalance(
    sourceId && watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK ? sourceId : undefined,
    watchMovementDate,
    watchProductType
  );

  return useMemo(() => {
    if (!sourceId) return { balance: 0, status: "ok", message: "—" };
    if (isLoading) return { balance: 0, status: "ok", message: "Загрузка..." };

    let currentBalanceKg = 0;
    let name = "";

    if (watchMovementType === EQUIPMENT_MOVEMENT_TYPE.STORAGE_TO_TZK) {
      const wh = warehouses.find((w) => w.id === sourceId);
      name = wh?.name || "";
      currentBalanceKg =
        balanceData &&
        typeof balanceData === "object" &&
        "balance" in balanceData
          ? Number.parseFloat(String(balanceData.balance))
          : Number.parseFloat(
              watchProductType === PRODUCT_TYPE.PVKJ
                ? wh?.pvkjBalance || "0"
                : wh?.currentBalance || "0",
            );
    } else {
      const eq = equipments.find((e) => e.id === sourceId);
      name = eq?.name || "";
      // For TZK we use equipment balance fields
      currentBalanceKg = Number.parseFloat(
        watchProductType === PRODUCT_TYPE.PVKJ
          ? eq?.pvkjBalance || "0"
          : eq?.currentBalance || "0",
      );
    }

    const currentBalanceTonnes = kilogramsToTonnes(currentBalanceKg);
    const availableTonnes = isEditing
      ? currentBalanceTonnes + initialQuantityTonnes
      : currentBalanceTonnes;

    if (availableTonnes <= 0) return { balance: availableTonnes, status: "error", message: "Пусто" };
    if (quantityTonnes > availableTonnes) return { balance: availableTonnes, status: "error", message: `Недостаточно! Доступно: ${formatTonnes(availableTonnes)} т` };

    if (quantityTonnes > 0) {
      const remainingTonnes = availableTonnes - quantityTonnes;
      return { balance: availableTonnes, status: "ok", message: `${formatTonnes(availableTonnes)} т → после: ${formatTonnes(remainingTonnes)} т` };
    }

    return { balance: availableTonnes, status: "ok", message: `${formatTonnes(availableTonnes)} т` };
  }, [sourceId, isLoading, balanceData, watchProductType, watchMovementType, warehouses, equipments, isEditing, initialQuantityTonnes, quantityTonnes]);
}
