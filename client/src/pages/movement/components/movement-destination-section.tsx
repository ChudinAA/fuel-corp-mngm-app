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
import { AllSupplier } from "../types";

interface MovementDestinationSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchFromWarehouseId: string;
  warehouses: any[];
  suppliers: AllSupplier[];
  allBases?: any[];
  availableCarriers: any[];
  warehouseBalance: { message: string; status: "ok" | "error" | "warning" };
  supplierContractVolumeStatus: {
    message: string;
    status: "ok" | "error" | "warning";
  };
}

export function MovementDestinationSection({
  form,
  watchMovementType,
  watchFromWarehouseId,
  warehouses,
  suppliers,
  allBases,
  availableCarriers,
  warehouseBalance,
  supplierContractVolumeStatus,
}: MovementDestinationSectionProps) {
  const { hasPermission } = useAuth();
  const [addDeliveryCostOpen, setAddDeliveryCostOpen] = useState(false);

  const watchSupplierId = form.watch("supplierId");
  const selectedSupplier = suppliers?.find((w) => w.id === watchSupplierId);

  const selectedSupplierBases =
    selectedSupplier?.baseIds
      ?.map((id) => allBases?.find((b) => b.id === id))
      .filter(Boolean) || [];

  return (
    <div className="grid gap-2 md:grid-cols-4">
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

      {watchMovementType === MOVEMENT_TYPE.SUPPLY ? (
        <CalculatedField
          label="Доступн. об-м Поставщика"
          value={supplierContractVolumeStatus.message}
          status={supplierContractVolumeStatus.status}
        />
      ) : (
        <CalculatedField
          label="Объем на складе"
          value={watchFromWarehouseId ? warehouseBalance.message : "—"}
          status={watchFromWarehouseId ? warehouseBalance.status : "ok"}
        />
      )}

      <FormField
        control={form.control}
        name="basis"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">Базис Поставщика</FormLabel>
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

      <AddDeliveryCostDialog
        editDeliveryCost={null}
        isInline
        inlineOpen={addDeliveryCostOpen}
        onInlineOpenChange={setAddDeliveryCostOpen}
      />
    </div>
  );
}
