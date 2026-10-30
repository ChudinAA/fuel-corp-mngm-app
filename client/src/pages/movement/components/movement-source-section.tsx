import { Combobox } from "@/components/ui/combobox";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MOVEMENT_TYPE } from "@shared/constants";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import type { AllSupplier } from "../types";
import { Warehouse } from "@shared/schema";
import { BaseTypeBadge } from "@/components/base-type-badge";

interface MovementSourceSectionProps {
  form: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchSupplierId: string;
  watchFromWarehouseId: string;
  suppliers: AllSupplier[];
  warehouses: Warehouse[];
  allBases?: any[];
}

export function MovementSourceSection({
  form,
  watchMovementType,
  watchSupplierId,
  watchFromWarehouseId,
  suppliers,
  warehouses,
  allBases = [],
}: MovementSourceSectionProps) {
  const selectedSupplier = suppliers?.find((supplier) => supplier.id === watchSupplierId);
  const selectedWarehouse = warehouses?.find((warehouse) => warehouse.id === watchFromWarehouseId);
  const sourceBases = (watchMovementType === MOVEMENT_TYPE.SUPPLY
    ? selectedSupplier?.baseIds
    : selectedWarehouse?.baseIds) || [];
  const bases = sourceBases.map((id) => allBases.find((base) => base.id === id)).filter(Boolean);
  return (
    <>
      <FormItem className="min-w-0">
        <FormLabel>
          {watchMovementType === MOVEMENT_TYPE.SUPPLY ? "Поставщик" : "Откуда (склад)"}
        </FormLabel>
        <Combobox
          options={watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? suppliers?.map((s) => ({ value: s.id, label: s.name })) || []
            : warehouses?.map((w) => ({ value: w.id, label: w.name })) || []}
          value={watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? watchSupplierId || ""
            : watchFromWarehouseId || ""}
          onValueChange={(val) => {
            if (watchMovementType === MOVEMENT_TYPE.SUPPLY) {
              form.setValue("supplierId", val, { shouldValidate: true });
            } else {
              form.setValue("fromWarehouseId", val, { shouldValidate: true });
            }
            form.setValue("basisId", "");
            form.setValue("basis", "");
          }}
          placeholder={watchMovementType === MOVEMENT_TYPE.SUPPLY
            ? "Выберите поставщика"
            : "Выберите склад"}
          dataTestId={
            watchMovementType === MOVEMENT_TYPE.SUPPLY
              ? "select-movement-supplier"
              : "select-movement-from"
          }
        />
      </FormItem>
      <FormField
        control={form.control}
        name="basisId"
        render={({ field }) => (
          <FormItem className="min-w-0">
            <FormLabel>{watchMovementType === MOVEMENT_TYPE.SUPPLY ? "Базис Поставщика" : "Базис Склада"}</FormLabel>
            <Combobox
              options={bases.map((base: any) => ({
                value: base.id,
                label: base.name,
                render: <div className="flex items-center gap-2">{base.name}<BaseTypeBadge type={base.baseType} short /></div>,
              }))}
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
                const base = bases.find((item: any) => item.id === value);
                if (base) form.setValue("basis", base.name);
              }}
              placeholder="Выберите базис"
              className="w-full"
              dataTestId="select-movement-basis"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
