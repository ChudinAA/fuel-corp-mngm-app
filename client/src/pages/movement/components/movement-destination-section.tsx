
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalculatedField } from "./calculated-field";
import { MOVEMENT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";

interface MovementDestinationSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchFromWarehouseId: string;
  warehouses: any[];
  availableCarriers: any[];
  warehouseBalance: { message: string; status: "ok" | "error" | "warning" };
}

export function MovementDestinationSection({ 
  form, 
  watchMovementType,
  watchFromWarehouseId,
  warehouses, 
  availableCarriers,
  warehouseBalance
}: MovementDestinationSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField
        control={form.control}
        name="toWarehouseId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">Куда (склад)</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-to">
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {warehouses?.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {watchMovementType === MOVEMENT_TYPE.INTERNAL ? (
        <div className="grid grid-cols-2 gap-4">
          <FormField 
            control={form.control} 
            name="carrierId" 
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">Перевозчик</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-movement-carrier">
                      <SelectValue placeholder="Выберите перевозчика" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCarriers.length > 0 ? (
                      availableCarriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                    ) : (
                      <SelectItem value="none" disabled>Нет перевозчиков для данного маршрута</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} 
          />

          <CalculatedField 
            label="Объем на складе" 
            value={watchFromWarehouseId ? warehouseBalance.message : "—"}
            status={watchFromWarehouseId ? warehouseBalance.status : "ok"}
          />
        </div>
      ) : (
        <FormField 
          control={form.control} 
          name="carrierId" 
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">Перевозчик</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger data-testid="select-movement-carrier">
                    <SelectValue placeholder="Выберите перевозчика" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableCarriers.length > 0 ? (
                    availableCarriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                  ) : (
                    <SelectItem value="none" disabled>Нет перевозчиков для данного маршрута</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} 
        />
      )}
    </div>
  );
}
