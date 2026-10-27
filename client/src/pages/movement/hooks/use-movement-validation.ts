import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { formatTonnes } from "@shared/units";
import {
  resolveWarehouseAverageCostPerTonne,
  resolveWarehouseBalanceTonnes,
} from "../warehouse-balance-utils";

interface UseMovementValidationProps {
  watchMovementType: string;
  watchProductType: string;
  watchFromWarehouseId: string;
  watchCarrierId: string;
  calculatedTonnes: number | null;
  tonnesNum: number;
  purchasePrice: number | null;
  warehouses: any[];
  supplierContractVolumeStatus: {
    message: string;
    status: "ok" | "error" | "warning";
  };
  toast: any;
  sameBasis?: boolean;
}

export function useMovementValidation({
  watchMovementType,
  watchProductType,
  watchFromWarehouseId,
  watchCarrierId,
  calculatedTonnes,
  tonnesNum,
  purchasePrice,
  warehouses,
  supplierContractVolumeStatus,
  toast,
  sameBasis = false,
}: UseMovementValidationProps) {
  const validateForm = (): boolean => {
    // Check quantity
    if (!calculatedTonnes || tonnesNum <= 0) {
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
      const currentBalanceTonnes = resolveWarehouseBalanceTonnes(
        null,
        isPvkj
          ? fromWarehouse.pvkjBalanceTonnes
          : fromWarehouse.currentBalanceTonnes,
        isPvkj ? fromWarehouse.pvkjBalance : fromWarehouse.currentBalance,
      );
      const currentCostPerTonne = resolveWarehouseAverageCostPerTonne(
        null,
        isPvkj
          ? fromWarehouse.pvkjAverageCostPerTonne
          : fromWarehouse.averageCostPerTonne,
        isPvkj ? fromWarehouse.pvkjAverageCost : fromWarehouse.averageCost,
      );

      if (currentBalanceTonnes < tonnesNum) {
        throw new Error(
          `На складе "${fromWarehouse.name}" недостаточно ${isPvkj ? "ПВКЖ" : "керосина"}. Доступно: ${formatTonnes(currentBalanceTonnes)} т, требуется: ${formatTonnes(tonnesNum)} т.`,
        );
      }

      if (currentCostPerTonne <= 0) {
        throw new Error(
          `На складе "${fromWarehouse.name}" отсутствует себестоимость ${isPvkj ? "ПВКЖ" : "керосина"}. Невозможно выполнить перемещение.`,
        );
      }
    }

    // Check carrier (skip if same basis — delivery not needed)
    if (!watchCarrierId && !sameBasis) {
      throw new Error("Выберите перевозчика");
    }

    // Check purchase price (for supply)
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && purchasePrice === null) {
      throw new Error(
        "Не указана цена закупки. Проверьте настройки поставщика, базиса или маршрута.",
      );
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
