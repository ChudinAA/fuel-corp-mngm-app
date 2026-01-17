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
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import type { AllSupplier } from "../types";

interface MovementSourceSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchProductType: string;
  suppliers: AllSupplier[];
  warehouses: any[];
  allBases?: any[];
}

export function MovementSourceSection({
  form,
  watchMovementType,
  watchProductType,
  suppliers,
  warehouses,
  allBases,
}: MovementSourceSectionProps) {
  const watchSupplierId = form.watch("supplierId");
  const selectedSupplier = suppliers?.find((w) => w.id === watchSupplierId);

  const selectedSupplierBases = selectedSupplier?.baseIds?.map(id => 
    allBases?.find(b => b.id === id)
  ).filter(Boolean) || [];

  const watchFromWarehouseId = form.watch("fromWarehouseId");
  const selectedWarehouse = warehouses?.find(
    (w) => w.id === watchFromWarehouseId,
  );

  const selectedWarehouseBases = selectedWarehouse?.baseIds?.map(id => 
    allBases?.find(b => b.id === id)
  ).filter(Boolean) || [];

  if (watchMovementType === MOVEMENT_TYPE.SUPPLY) {
    return (
      <>
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

        {watchSupplierId && (
          <FormField
            control={form.control}
            name="basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Базис Поставщика</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-movement-basis">
                      <SelectValue placeholder="Выберите базис" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectedSupplierBases.map((b: any) => (
                      <SelectItem key={b.id} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                    {selectedSupplierBases.length === 0 && (
                      <SelectItem value="none" disabled>
                        Базисы не привязаны
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </>
    );
  } else {
    return (
      <>
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

        {watchFromWarehouseId && (
          <FormField
            control={form.control}
            name="basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Базис Склада</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-movement-basis">
                      <SelectValue placeholder="Выберите базис" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {selectedWarehouseBases.map((b: any) => (
                      <SelectItem key={b.id} value={b.name}>
                        {b.name}
                      </SelectItem>
                    ))}
                    {selectedWarehouseBases.length === 0 && (
                      <SelectItem value="none" disabled>
                        Базисы не привязаны
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </>
    );
  }
}
