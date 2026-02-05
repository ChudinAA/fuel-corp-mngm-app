import { Combobox } from "@/components/ui/combobox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
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

  const selectedWarehouse = warehouses?.find(
    (w) => w.id === watchFromWarehouseId,
  );

  const selectedWarehouseBases =
    selectedWarehouse?.baseIds
      ?.map((id) => allBases?.find((b) => b.id === id))
      .filter(Boolean) || [];

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
      <FormField
        control={form.control}
        name="toWarehouseId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel className="flex items-center gap-2">
              Куда (склад)
            </FormLabel>
            <FormControl>
              <div className="w-full">
                <Combobox
                  options={warehouses?.map((w) => ({ value: w.id, label: w.name })) || []}
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="Выберите склад"
                  className="w-full"
                  dataTestId="select-movement-to"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="carrierId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel className="flex items-center gap-2">
              Перевозчик
            </FormLabel>
            <div className="flex gap-1 items-center w-full">
              <FormControl>
                <div className="flex-1 min-w-0">
                  <Combobox
                    options={availableCarriers.map((c) => ({ value: c.id, label: c.name }))}
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    placeholder="Выберите перевозчика"
                    className="w-full"
                    dataTestId="select-movement-carrier"
                  />
                </div>
              </FormControl>
              {hasPermission("delivery", "create") && (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => setAddDeliveryCostOpen(true)}
                  data-testid="button-add-delivery-cost-inline"
                  className="shrink-0 h-9 w-9"
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
        <div className="col-span-1 min-w-0">
          <CalculatedField
            label="Доступн. об-м Поставщика"
            value={supplierContractVolumeStatus.message}
            status={supplierContractVolumeStatus.status}
          />
        </div>
      ) : (
        <div className="col-span-1 min-w-0">
          <CalculatedField
            label="Объем на складе"
            value={watchFromWarehouseId ? warehouseBalance.message : "—"}
            status={watchFromWarehouseId ? warehouseBalance.status : "ok"}
          />
        </div>
      )}

      {watchMovementType === MOVEMENT_TYPE.SUPPLY ? (
        <FormField
          control={form.control}
          name="basisId"
          render={({ field }) => (
            <FormItem className="col-span-1 min-w-0">
              <FormLabel className="flex items-center gap-2">
                Базис Поставщика
              </FormLabel>
              <FormControl>
                <div className="w-full">
                  <Combobox
                    options={selectedSupplierBases.map((b: any) => ({
                      value: b.id,
                      label: b.name
                    }))}
                    value={field.value || ""}
                    onValueChange={(val) => {
                      field.onChange(val);
                      const base = selectedSupplierBases.find((b: any) => b.id === val);
                      if (base) {
                        form.setValue("basis", base.name);
                      }
                    }}
                    placeholder="Выберите базис"
                    className="w-full"
                    dataTestId="select-movement-basis"
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
      <FormField
        control={form.control}
        name="basisId"
        render={({ field }) => (
          <FormItem className="col-span-1 min-w-0">
            <FormLabel className="flex items-center gap-2">Базис Склада</FormLabel>
            <FormControl>
              <div className="w-full">
                <Combobox
                  options={selectedWarehouseBases.map((b: any) => ({
                    value: b.id,
                    label: b.name
                  }))}
                  value={field.value || ""}
                  onValueChange={(val) => {
                    field.onChange(val);
                    const base = selectedWarehouseBases.find((b: any) => b.id === val);
                    if (base) {
                      form.setValue("basis", base.name);
                    }
                  }}
                  placeholder="Выберите базис"
                  className="w-full"
                  dataTestId="select-movement-basis"
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      )}

      <AddDeliveryCostDialog
        editDeliveryCost={null}
        isInline
        inlineOpen={addDeliveryCostOpen}
        onInlineOpenChange={setAddDeliveryCostOpen}
      />
    </div>
  );
}
