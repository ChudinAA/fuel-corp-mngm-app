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

interface MovementSourceSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  suppliers: AllSupplier[];
  warehouses: any[];
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
          <FormItem>
            <FormLabel>Поставщик</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-supplier">
                  <SelectValue placeholder="Выберите поставщика">
                    {selectedSupplier?.name}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {suppliers?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                )) || (
                  <SelectItem value="none" disabled>
                    Нет данных
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
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
          <FormItem>
            <FormLabel>Откуда (склад)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-from">
                  <SelectValue placeholder="Выберите склад">
                    {selectedWarehouse?.name}
                  </SelectValue>
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {warehouses?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                )) || (
                  <SelectItem value="none" disabled>
                    Нет данных
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
}
