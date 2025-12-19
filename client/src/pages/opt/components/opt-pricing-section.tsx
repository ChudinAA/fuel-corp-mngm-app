
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { Price } from "@shared/schema";
import type { OptFormData } from "../schemas";
import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";

interface OptPricingSectionProps {
  form: UseFormReturn<OptFormData>;
  isWarehouseSupplier: boolean;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  setSelectedPurchasePriceId: (id: string) => void;
  setSelectedSalePriceId: (id: string) => void;
  purchasePrice: number | null;
  salePrice: number | null;
  purchaseAmount: number | null;
  saleAmount: number | null;
}

export function OptPricingSection({
  form,
  isWarehouseSupplier,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  setSelectedPurchasePriceId,
  setSelectedSalePriceId,
  purchasePrice,
  salePrice,
  purchaseAmount,
  saleAmount,
}: OptPricingSectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {!isWarehouseSupplier && purchasePrices.length > 0 ? (
        <FormField
          control={form.control}
          name="selectedPurchasePriceId"
          render={({ field }) => {
            const firstPriceId = purchasePrices.length > 0 ? `${purchasePrices[0].id}-0` : undefined;
            const effectiveValue = selectedPurchasePriceId || field.value || firstPriceId;

            if (!selectedPurchasePriceId && !field.value && firstPriceId) {
              setSelectedPurchasePriceId(firstPriceId);
              field.onChange(firstPriceId);
            }

            return (
              <FormItem>
                <FormLabel className="flex items-center gap-2">Покупка</FormLabel>
                <Select 
                  onValueChange={(value) => { 
                    field.onChange(value); 
                    setSelectedPurchasePriceId(value); 
                  }} 
                  value={effectiveValue}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-purchase-price">
                      <SelectValue placeholder="Выберите цену" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {purchasePrices.map((price) => {
                      const priceValues = price.priceValues || [];
                      if (priceValues.length === 0) return null;

                      return priceValues.map((priceValueStr, idx) => {
                        try {
                          const parsed = JSON.parse(priceValueStr);
                          const priceVal = parsed.price || "0";
                          return (
                            <SelectItem key={`${price.id}-${idx}`} value={`${price.id}-${idx}`}>
                              {formatNumber(priceVal)} ₽/кг
                            </SelectItem>
                          );
                        } catch {
                          return null;
                        }
                      });
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      ) : !isWarehouseSupplier ? (
        <CalculatedField 
          label="Покупка" 
          value="Нет цены!"
          status="error"
        />
      ) : (
        <CalculatedField 
          label="Покупка" 
          value={purchasePrice !== null ? formatNumber(purchasePrice) : "Нет цены!"}
          suffix={purchasePrice !== null ? " ₽/кг" : ""}
          status={purchasePrice !== null ? "ok" : "error"}
        />
      )}

      <CalculatedField 
        label="Сумма закупки" 
        value={purchaseAmount !== null ? formatCurrency(purchaseAmount) : "Ошибка"}
        status={purchaseAmount !== null ? "ok" : "error"}
      />

      {salePrices.length > 0 ? (
        <FormField
          control={form.control}
          name="selectedSalePriceId"
          render={({ field }) => {
            const firstPriceId = salePrices.length > 0 ? `${salePrices[0].id}-0` : undefined;
            const effectiveValue = selectedSalePriceId || field.value || firstPriceId;

            if (!selectedSalePriceId && !field.value && firstPriceId) {
              setSelectedSalePriceId(firstPriceId);
              field.onChange(firstPriceId);
            }

            return (
              <FormItem>
                <FormLabel className="flex items-center gap-2">Продажа</FormLabel>
                <Select 
                  onValueChange={(value) => { 
                    field.onChange(value); 
                    setSelectedSalePriceId(value); 
                  }} 
                  value={effectiveValue}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-sale-price">
                      <SelectValue placeholder="Выберите цену" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {salePrices.map((price) => {
                      const priceValues = price.priceValues || [];
                      if (priceValues.length === 0) return null;

                      return priceValues.map((priceValueStr, idx) => {
                        try {
                          const parsed = JSON.parse(priceValueStr);
                          const priceVal = parsed.price || "0";
                          return (
                            <SelectItem key={`${price.id}-${idx}`} value={`${price.id}-${idx}`}>
                              {formatNumber(priceVal)} ₽/кг
                            </SelectItem>
                          );
                        } catch {
                          return null;
                        }
                      });
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      ) : (
        <CalculatedField 
          label="Продажа" 
          value="Нет цены!"
          status="error"
        />
      )}

      <CalculatedField 
        label="Сумма продажи" 
        value={saleAmount !== null ? formatCurrency(saleAmount) : "Ошибка"}
        status={saleAmount !== null ? "ok" : "error"}
      />
    </div>
  );
}
