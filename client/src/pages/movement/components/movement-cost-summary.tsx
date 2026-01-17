import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus } from "lucide-react";
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
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";

interface MovementCostSummaryProps {
  form: UseFormReturn<MovementFormData>;
  availablePrices: any[];
  purchasePrice: number | null;
  purchaseAmount: number;
  storageCost: number;
  deliveryCost: number;
  costPerKg: number;
  watchMovementType: string;
}

export function MovementCostSummary({
  form,
  availablePrices,
  purchasePrice,
  purchaseAmount,
  storageCost,
  deliveryCost,
  costPerKg,
  watchMovementType,
}: MovementCostSummaryProps) {
  const { hasPermission } = useAuth();
  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
      <div className="flex items-end gap-1">
        {watchMovementType === MOVEMENT_TYPE.SUPPLY && availablePrices.length > 0 ? (
          <FormField
            control={form.control}
            name="selectedPurchasePriceId"
            render={({ field }) => {
              // Автоматически выбираем первую цену, если ничего не выбрано
              if (!field.value && availablePrices.length > 0) {
                const firstPrice = availablePrices[0];
                const compositeId = `${firstPrice.priceId}-0`;
                setTimeout(() => {
                  form.setValue("selectedPurchasePriceId", compositeId);
                  form.setValue("purchasePriceId", firstPrice.priceId);
                  form.setValue("purchasePriceIndex", 0);
                  form.setValue("purchasePrice", String(firstPrice.price));
                }, 0);
              }

              return (
                <FormItem className="flex-1">
                  <FormLabel className="flex items-center gap-2">Цена закупки</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const { priceId, index } = parsePriceCompositeId(value);
                      const priceObj = availablePrices.find(
                        (p) => `${p.priceId}-${p.index}` === value
                      );
                      
                      if (priceObj) {
                        form.setValue("purchasePriceId", priceId);
                        form.setValue("purchasePriceIndex", index);
                        form.setValue("purchasePrice", String(priceObj.price));
                      }
                    }}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-purchase-price">
                        <SelectValue placeholder="Выберите цену">
                          {purchasePrice !== null ? `${formatNumber(purchasePrice)} ₽/кг` : "Выберите цену"}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availablePrices.map((p) => (
                        <SelectItem key={`${p.priceId}-${p.index}`} value={`${p.priceId}-${p.index}`}>
                          {formatNumber(p.price)} ₽/кг
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              );
            }}
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
      <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
      <CalculatedField
        label="Себестоимость"
        value={formatNumber(costPerKg)}
        suffix=" ₽/кг"
      />

      <AddPriceDialog
        isInline
        inlineOpen={addPurchasePriceOpen}
        onInlineOpenChange={setAddPurchasePriceOpen}
      />
    </div>
  );
}
