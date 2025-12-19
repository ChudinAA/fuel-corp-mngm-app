
import { FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Supplier, Base, Warehouse } from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { formatNumber } from "../utils";

interface OptBasisWarehouseSectionProps {
  selectedSupplier: Supplier | undefined;
  selectedBasis: string;
  setSelectedBasis: (value: string) => void;
  wholesaleBases: Base[];
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  finalKg: number;
  isEditing: boolean;
  initialWarehouseBalance: number;
}

export function OptBasisWarehouseSection({
  selectedSupplier,
  selectedBasis,
  setSelectedBasis,
  wholesaleBases,
  isWarehouseSupplier,
  supplierWarehouse,
  finalKg,
  isEditing,
  initialWarehouseBalance,
}: OptBasisWarehouseSectionProps) {
  const getWarehouseStatus = (): { status: "ok" | "warning" | "error"; message: string } => {
    if (!isWarehouseSupplier) {
      return { status: "ok", message: "Объем не со склада" };
    }

    if (!supplierWarehouse || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    // При редактировании используем начальный остаток (до вычета текущей сделки)
    const availableBalance = isEditing ? initialWarehouseBalance : parseFloat(supplierWarehouse.currentBalance || "0");
    const remaining = availableBalance - finalKg;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${formatNumber(remaining)} кг` };
    } else {
      return { status: "error", message: `Недостаточно! Доступно: ${formatNumber(availableBalance)} кг` };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {selectedSupplier && selectedSupplier.baseIds && selectedSupplier.baseIds.length > 1 ? (
        <FormItem>
          <FormLabel className="flex items-center gap-2">Базис</FormLabel>
          <Select 
            value={selectedBasis} 
            onValueChange={(value) => {
              const base = wholesaleBases?.find(b => b.name === value);
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
                const base = wholesaleBases?.find(b => b.id === baseId);
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
        <CalculatedField 
          label="Базис" 
          value={selectedBasis || "—"}
        />
      )}

      <CalculatedField 
        label="Объем на складе" 
        value={warehouseStatus.message}
        status={warehouseStatus.status}
      />
    </div>
  );
}
