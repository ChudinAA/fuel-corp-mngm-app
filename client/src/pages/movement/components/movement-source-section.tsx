import { Combobox } from "@/components/ui/combobox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { MOVEMENT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import type { AllSupplier } from "../types";
import { Warehouse } from "@shared/schema";

interface MovementSourceSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchSupplierId: string;
  watchFromWarehouseId: string;
  suppliers: AllSupplier[];
  warehouses: Warehouse[];
}

export function MovementSourceSection({
  form,
  watchMovementType,
  watchSupplierId,
  watchFromWarehouseId,
  suppliers,
  warehouses,
}: MovementSourceSectionProps) {
  return (
    <FormItem>
      <FormLabel>
        {watchMovementType === MOVEMENT_TYPE.SUPPLY
          ? "Поставщик"
          : "Откуда (склад)"}
      </FormLabel>
      <Combobox
        options={
          watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? suppliers?.map((s) => ({ value: s.id, label: s.name })) || []
            : warehouses?.map((w) => ({ value: w.id, label: w.name })) || []
        }
        value={
          watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? watchSupplierId || ""
            : watchFromWarehouseId || ""
        }
        onValueChange={(val) => {
          if (watchMovementType === MOVEMENT_TYPE.SUPPLY) {
            form.setValue("supplierId", val, { shouldValidate: true });
          } else {
            form.setValue("fromWarehouseId", val, {
              shouldValidate: true,
            });
          }
        }}
        placeholder={
          watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? "Выберите поставщика"
            : "Выберите склад"
        }
      />
    </FormItem>
  );
}
