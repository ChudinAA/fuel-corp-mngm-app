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
      toast({
        title: "Ошибка: Укажите корректное количество топлива",
        description:
          "Укажите корректное количество топлива в килограммах или литрах.",
        variant: "destructive",
      });
      return false;
    }

    // For internal movement, check source warehouse balance
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find(
        (w) => w.id === watchFromWarehouseId,
      );
      if (!fromWarehouse) {
        toast({
          title: "Ошибка: Склад не найден",
          description: "Склад-источник не найден.",
          variant: "destructive",
        });
        return false;
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
        toast({
          title: "Ошибка: На складе недостаточно объема",
          description: `На складе "${fromWarehouse.name}" недостаточно ${isPvkj ? "ПВКЖ" : "керосина"}. Доступно: ${currentBalance.toLocaleString()} кг, требуется: ${kgNum.toLocaleString()} кг.`,
          variant: "destructive",
        });
        return false;
      }

      if (currentCost <= 0) {
        toast({
          title: "Ошибка: На складе отсутствует себестоимость",
          description: `На складе "${fromWarehouse.name}" отсутствует себестоимость ${isPvkj ? "ПВКЖ" : "керосина"}. Невозможно выполнить перемещение.`,
          variant: "destructive",
        });
        return false;
      }
    }

    // Check purchase price (for supply)
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && purchasePrice === null) {
      toast({
        title: "Ошибка: Не указана цена закупк",
        description:
          "Не указана цена закупки. Проверьте настройки поставщика, базиса или маршрута.",
        variant: "destructive",
      });
      return false;
    }

    if (
      watchMovementType === MOVEMENT_TYPE.SUPPLY &&
      supplierContractVolumeStatus.status === "error"
    ) {
      toast({
        title: "Ошибка: Недостаточно объема по договору Поставщика",
        description: supplierContractVolumeStatus.message,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  return { validateForm };
}
