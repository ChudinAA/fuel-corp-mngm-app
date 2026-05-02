import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { MOVEMENT_TYPE } from "@shared/constants";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import type { VatAdjustment } from "../hooks/use-movement-calculations";

interface MovementCostSummaryProps {
  form: UseFormReturn<MovementFormData>;
  availablePrices: any[];
  purchasePrice: number | null;
  purchaseAmount: number;
  storageCost: number;
  warehouseServicesCost?: number;
  deliveryCost: number;
  costPerKg: number;
  watchMovementType: string;
  selectedPurchasePriceId: string;
  setSelectedPurchasePriceId: (id: string) => void;
  vatAdjustment?: VatAdjustment;
  rawTotalCost?: number;
}

export function MovementCostSummary({
  form,
  availablePrices,
  purchasePrice,
  purchaseAmount,
  storageCost,
  warehouseServicesCost = 0,
  deliveryCost,
  costPerKg,
  watchMovementType,
  selectedPurchasePriceId,
  setSelectedPurchasePriceId,
  vatAdjustment,
  rawTotalCost,
}: MovementCostSummaryProps) {
  const { hasPermission } = useAuth();
  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);

  const hasServices = warehouseServicesCost > 0;
  const colCount = hasServices ? 6 : 5;
  const gridClass = hasServices
    ? "grid gap-2 md:grid-cols-2 lg:grid-cols-6"
    : "grid gap-2 md:grid-cols-2 lg:grid-cols-5";

  const costLabel = vatAdjustment
    ? vatAdjustment.type === "deduct"
      ? "Себест-ть (−НДС)"
      : "Себест-ть (+НДС)"
    : "Себест-ть";

  return (
    <div className="space-y-3">
      <div className={gridClass}>
        <div className="flex items-end gap-1">
          {watchMovementType === MOVEMENT_TYPE.SUPPLY && availablePrices.length > 0 ? (
            <FormField
              control={form.control}
              name="selectedPurchasePriceId"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Цена закупки</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      setSelectedPurchasePriceId(value);
                      field.onChange(value);
                    }}
                    value={selectedPurchasePriceId}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-purchase-price">
                        <SelectValue placeholder="Выберите цену">
                          {purchasePrice !== null
                            ? `${formatNumber(purchasePrice)} ₽/кг`
                            : "Выберите цену"}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePrices.map((p) => (
                        <SelectItem
                          key={`${p.priceId}-${p.index}`}
                          value={`${p.priceId}-${p.index}`}
                        >
                          {formatNumber(p.price)} ₽/кг
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          ) : (
            <CalculatedField
              label="Цена закупки"
              value={
                purchasePrice !== null ? formatNumber(purchasePrice) : "нет цены!"
              }
              suffix={purchasePrice !== null ? " ₽/кг" : ""}
            />
          )}
          {hasPermission("prices", "create") &&
            watchMovementType === MOVEMENT_TYPE.SUPPLY && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setAddPurchasePriceOpen(true)}
                data-testid="button-add-purchase-price-inline"
                className={availablePrices.length > 0 ? "mb-0" : ""}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
        </div>

        <CalculatedField
          label="Сумма покупки"
          value={formatCurrency(purchaseAmount)}
        />
        <CalculatedField label="Хранение" value={formatCurrency(storageCost)} />
        {hasServices && (
          <CalculatedField
            label="Услуги склада"
            value={formatCurrency(warehouseServicesCost)}
          />
        )}
        <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
        <CalculatedField
          label={costLabel}
          value={formatNumber(costPerKg)}
          suffix=" ₽/кг"
        />
      </div>

      {/* VAT Adjustment Info Block */}
      {vatAdjustment && (
        <div
          className={`rounded-md border p-3 space-y-1.5 ${
            vatAdjustment.type === "deduct"
              ? "border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700"
              : "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700"
          }`}
          data-testid="vat-adjustment-info"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={`h-4 w-4 mt-0.5 shrink-0 ${
                vatAdjustment.type === "deduct"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-blue-600 dark:text-blue-400"
              }`}
            />
            <p
              className={`text-sm font-medium ${
                vatAdjustment.type === "deduct"
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-blue-800 dark:text-blue-200"
              }`}
            >
              {vatAdjustment.description}
            </p>
          </div>
          <div className="ml-6 space-y-0.5 text-sm">
            {vatAdjustment.type === "deduct" ? (
              <>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>Себестоимость без вычета НДС:</span>
                  <span className="font-medium">
                    {formatCurrency(vatAdjustment.rawTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
                  <span>После вычета НДС 20%:</span>
                  <span className="font-semibold">
                    {formatCurrency(vatAdjustment.adjustedTotal)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>Себестоимость без НДС:</span>
                  <span className="font-medium">
                    {formatCurrency(vatAdjustment.rawTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-blue-800 dark:text-blue-200">
                  <span>С добавлением НДС 20%:</span>
                  <span className="font-semibold">
                    {formatCurrency(vatAdjustment.adjustedTotal)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AddPriceDialog
        isInline
        inlineOpen={addPurchasePriceOpen}
        onInlineOpenChange={setAddPurchasePriceOpen}
      />
    </div>
  );
}
