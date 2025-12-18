
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { OptFormData } from "../schemas";
import type { Base, Supplier } from "@shared/schema";
import { CalculatedField } from "./calculated-field";

interface OptFormBasisWarehouseSectionProps {
  form: UseFormReturn<OptFormData>;
  selectedSupplier?: Supplier;
  bases?: Base[];
  selectedBasis: string;
  setSelectedBasis: (basis: string) => void;
  warehouseStatus: {
    status: "ok" | "warning" | "error";
    message: string;
  };
}

export function OptFormBasisWarehouseSection({
  form,
  selectedSupplier,
  bases,
  selectedBasis,
  setSelectedBasis,
  warehouseStatus,
}: OptFormBasisWarehouseSectionProps) {
  const showBasisSelector =
    selectedSupplier &&
    selectedSupplier.baseIds &&
    selectedSupplier.baseIds.length > 1;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {showBasisSelector ? (
        <FormItem>
          <FormLabel className="flex items-center gap-2">Базис</FormLabel>
          <Select
            value={selectedBasis}
            onValueChange={(value) => {
              const base = bases?.find((b) => b.name === value);
              if (base) setSelectedBasis(base.name);
            }}
          >
            <FormControl>
              <SelectTrigger data-testid="select-basis">
                <SelectValue placeholder="Выберите базис" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {selectedSupplier.baseIds.map((baseId) => {
                const base = bases?.find((b) => b.id === baseId);
                return base ? (
                  <SelectItem key={base.id} value={base.name}>
                    {base.name}
                  </SelectItem>
                ) : null;
              })}
            </SelectContent>
          </Select>
        </FormItem>
      ) : (
        <CalculatedField label="Базис" value={selectedBasis || "—"} />
      )}

      <CalculatedField
        label="Объем на складе"
        value={warehouseStatus.message}
        status={warehouseStatus.status}
      />
    </div>
  );
}
