
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";

interface OptFormPricingSectionProps {
  form: any;
  purchasePrices: any[];
  salePrices: any[];
  isWarehouseSupplier: boolean;
  purchasePrice: number | null;
  salePrice: number | null;
  purchaseAmount: number | null;
  saleAmount: number | null;
  deliveryCost: number | null;
  profit: number | null;
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  setSelectedPurchasePriceId: (id: string) => void;
  setSelectedSalePriceId: (id: string) => void;
}

export function OptFormPricingSection({
  form,
  purchasePrices,
  salePrices,
  isWarehouseSupplier,
  purchasePrice,
  salePrice,
  purchaseAmount,
  saleAmount,
  deliveryCost,
  profit,
  selectedPurchasePriceId,
  selectedSalePriceId,
  setSelectedPurchasePriceId,
  setSelectedSalePriceId,
}: OptFormPricingSectionProps) {
  const allPurchasePriceOptions = purchasePrices.flatMap(p => p.values || []);
  const allSalePriceOptions = salePrices.flatMap(p => p.values || []);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!isWarehouseSupplier && allPurchasePriceOptions.length > 0 ? (
          <FormField
            control={form.control}
            name="selectedPurchasePriceId"
            render={({ field }) => {
              const effectiveValue = selectedPurchasePriceId || field.value || allPurchasePriceOptions[0]?.compositeId;

              return (
                <FormItem>
                  <FormLabel>Покупка</FormLabel>
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
                      {allPurchasePriceOptions.map((option: any) => (
                        <SelectItem key={option.compositeId} value={option.compositeId}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : !isWarehouseSupplier ? (
          <CalculatedField label="Покупка" value="Нет цены!" status="error" />
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

        {allSalePriceOptions.length > 0 ? (
          <FormField
            control={form.control}
            name="selectedSalePriceId"
            render={({ field }) => {
              const effectiveValue = selectedSalePriceId || field.value || allSalePriceOptions[0]?.compositeId;

              return (
                <FormItem>
                  <FormLabel>Продажа</FormLabel>
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
                      {allSalePriceOptions.map((option: any) => (
                        <SelectItem key={option.compositeId} value={option.compositeId}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : (
          <CalculatedField label="Продажа" value="Нет цены!" status="error" />
        )}

        <CalculatedField
          label="Сумма продажи"
          value={saleAmount !== null ? formatCurrency(saleAmount) : "Ошибка"}
          status={saleAmount !== null ? "ok" : "error"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CalculatedField
          label="Доставка"
          value={deliveryCost !== null ? formatCurrency(deliveryCost) : "—"}
        />
        <CalculatedField
          label="Прибыль"
          value={profit !== null ? formatCurrency(profit) : "—"}
          status={profit !== null && profit >= 0 ? "ok" : profit !== null ? "warning" : undefined}
        />
      </div>
    </>
  );
}
