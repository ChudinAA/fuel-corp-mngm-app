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
import { CalculatedField } from "./calculated-field";
import { MOVEMENT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddDeliveryCostDialog } from "@/pages/delivery/components/delivery-cost-dialog";

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
  warehouseBalance,
}: MovementDestinationSectionProps) {
  const { hasPermission } = useAuth();
  const [addDeliveryCostOpen, setAddDeliveryCostOpen] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <FormField
        control={form.control}
        name="toWarehouseId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              Куда (склад)
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="select-movement-to">
                  <SelectValue placeholder="Выберите склад" />
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

      <FormField
        control={form.control}
        name="carrierId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              Перевозчик
            </FormLabel>
            <div className="flex gap-1">
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <FormControl>
                  <SelectTrigger
                    data-testid="select-movement-carrier"
                    className="flex-1"
                  >
                    <SelectValue placeholder="Выберите перевозчика" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableCarriers.length > 0 ? (
                    availableCarriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      Нет перевозчиков для данного маршрута
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {hasPermission("delivery", "create") && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setAddDeliveryCostOpen(true)}
                  data-testid="button-add-delivery-cost-inline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <CalculatedField
        label="Объем на складе"
        value={
          watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? "Объем не со склада"
            : watchFromWarehouseId
              ? warehouseBalance.message
              : "—"
        }
        status={watchFromWarehouseId ? warehouseBalance.status : "ok"}
      />

      <AddDeliveryCostDialog
        editDeliveryCost={null}
        isInline
        inlineOpen={addDeliveryCostOpen}
        onInlineOpenChange={setAddDeliveryCostOpen}
      />
    </div>
  );
}
