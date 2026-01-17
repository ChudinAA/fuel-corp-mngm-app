import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";

interface UseMovementValidationProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId: string;
  calculatedKg: number | null;
  kgNum: number;
  purchasePrice: number | null;
  warehouses: any[];
  supplierContractVolumeStatus: {
    message: string;
    status: "ok" | "error" | "warning";
  };
  toast: any;
}

export function useMovementValidation({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  calculatedKg,
  kgNum,
  purchasePrice,
  warehouses,
  supplierContractVolumeStatus,
  toast,
}: UseMovementValidationProps) {
  const validateForm = (): boolean => {
    // Check quantity
    if (!calculatedKg || kgNum <= 0) {
      throw new Error("Укажите корректное количество топлива");
    }

    // For internal movement, check source warehouse balance
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find(
        (w) => w.id === watchFromWarehouseId,
      );
      if (!fromWarehouse) {
        throw new Error("Склад-источник не найден");
      }

      const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
      const currentBalance = parseFloat(
        isPvkj
          ? fromWarehouse.pvkjBalance || "0"
          : fromWarehouse.currentBalance || "0",
      );
      const currentCost = parseFloat(
        isPvkj
          ? fromWarehouse.pvkjAverageCost || "0"
          : fromWarehouse.averageCost || "0",
      );

      if (currentBalance < kgNum) {
        throw new Error(`На складе "${fromWarehouse.name}" недостаточно ${isPvkj ? "ПВКЖ" : "керосина"}. Доступно: ${currentBalance.toLocaleString()} кг, требуется: ${kgNum.toLocaleString()} кг.`);
      }

      if (currentCost <= 0) {
        throw new Error(`На складе "${fromWarehouse.name}" отсутствует себестоимость ${isPvkj ? "ПВКЖ" : "керосина"}. Невозможно выполнить перемещение.`);
      }
    }

    // Check purchase price (for supply)
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && purchasePrice === null) {
      throw new Error("Не указана цена закупки. Проверьте настройки поставщика, базиса или маршрута.");
    }

    if (
      watchMovementType === MOVEMENT_TYPE.SUPPLY &&
      supplierContractVolumeStatus.status === "error"
    ) {
      throw new Error(supplierContractVolumeStatus.message);
    }

    return true;
  };

  return { validateForm };
}
