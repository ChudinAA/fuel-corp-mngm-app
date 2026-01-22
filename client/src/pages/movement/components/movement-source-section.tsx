import { Combobox } from "@/components/ui/combobox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOVEMENT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import type { AllSupplier } from "../types";
import { Warehouse } from "@shared/schema";

interface MovementSourceSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  suppliers: AllSupplier[];
  warehouses: Warehouse[];
}

export function MovementSourceSection({
  form,
  watchMovementType,
  suppliers,
  warehouses,
}: MovementSourceSectionProps) {
  const watchSupplierId = form.watch("supplierId");
  const selectedSupplier = suppliers?.find((w) => w.id === watchSupplierId);

  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const selectedWarehouse = warehouses?.find(
    (w) => w.id === watchFromWarehouseId,
  );

  if (watchMovementType === MOVEMENT_TYPE.SUPPLY) {
    return (
      <FormField
        control={form.control}
        name="supplierId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel>Поставщик</FormLabel>
            <FormControl>
              <div className="w-full">
                <Combobox
                  options={suppliers
                    ?.filter(s => s.isActive)
                    ?.map((s) => ({ value: s.id, label: s.name })) || []}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Выберите поставщика"
                  className="w-full"
                  dataTestId="select-movement-supplier"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  } else {
    return (
      <FormField
        control={form.control}
        name="fromWarehouseId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel>Откуда (склад)</FormLabel>
            <FormControl>
              <div className="w-full">
                <Combobox
                  options={warehouses
                    ?.filter(w => w.isActive)
                    ?.map((w) => ({ value: w.id, label: w.name })) || []}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Выберите склад"
                  className="w-full"
                  dataTestId="select-movement-from"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
}
