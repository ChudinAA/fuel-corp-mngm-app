import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { LogisticsCarrier, LogisticsDeliveryLocation, Price } from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { formatCurrency, formatNumber } from "../utils";
import type { OptFormData } from "../schemas";

interface VolumeInputSectionProps {
  form: UseFormReturn<OptFormData>;
  inputMode: "liters" | "kg";
  setInputMode: (mode: "liters" | "kg") => void;
  calculatedKg: string;
}

export function VolumeInputSection({ form, inputMode, setInputMode, calculatedKg }: VolumeInputSectionProps) {
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
            <Switch
              checked={inputMode === "kg"}
              onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
              data-testid="switch-input-mode"
            />
            <Label className="text-sm text-muted-foreground">КГ</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {inputMode === "liters" ? (
            <>
              <FormField
                control={form.control}
                name="quantityLiters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Литры</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0.00"
                        data-testid="input-liters"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="density"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Плотность</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.0001"
                        placeholder="0.8000"
                        data-testid="input-density"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <CalculatedField 
                label="КГ (расчет)" 
                value={watchLiters && watchDensity ? formatNumber(calculatedKg) : "—"}
                suffix={watchLiters && watchDensity ? " кг" : ""}
              />
            </>
          ) : (
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem className="md:col-span-3">
                  <FormLabel>Количество (КГ)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      data-testid="input-kg"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LogisticsSectionProps {
  form: UseFormReturn<OptFormData>;
  carriers?: LogisticsCarrier[];
  deliveryLocations?: LogisticsDeliveryLocation[];
}

export function LogisticsSection({ 
  form, 
  carriers, 
  deliveryLocations, 
}: LogisticsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Логистика</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="carrierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Перевозчик</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-carrier">
                      <SelectValue placeholder="Выберите перевозчика" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {carriers?.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        {carrier.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="deliveryLocationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Место доставки</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-delivery-location">
                      <SelectValue placeholder="Выберите место" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {deliveryLocations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PricingSection({ 
  purchasePrice, 
  salePrice, 
  purchaseAmount, 
  saleAmount, 
  deliveryTariff, 
  deliveryCost,
  profit,
  matchingPurchasePrices,
  matchingSalePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  onPurchasePriceSelect,
  onSalePriceSelect
}: { 
  purchasePrice: number | null;
  salePrice: number | null;
  purchaseAmount: number;
  saleAmount: number;
  deliveryTariff: number;
  deliveryCost: number;
  profit: number;
  matchingPurchasePrices: Price[];
  matchingSalePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  onPurchasePriceSelect: (id: string) => void;
  onSalePriceSelect: (id: string) => void;
}) {
  const getPriceLabel = (price: Price) => {
    if (!price.priceValues || price.priceValues.length === 0) return "Нет цены";
    const priceObj = JSON.parse(price.priceValues[0]);
    return `${priceObj.price} ₽/кг (${price.dateFrom} - ${price.dateTo})`;
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Ценообразование</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {matchingPurchasePrices.length > 1 ? (
            <div className="space-y-2">
              <Label>Цена закупки</Label>
              <Select value={selectedPurchasePriceId || matchingPurchasePrices[0]?.id || ""} onValueChange={onPurchasePriceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите цену" />
                </SelectTrigger>
                <SelectContent>
                  {matchingPurchasePrices.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {getPriceLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <CalculatedField 
              label="Цена закупки" 
              value={purchasePrice !== null ? formatNumber(purchasePrice) : "нет цены!"} 
              suffix={purchasePrice !== null ? " ₽/кг" : ""} 
            />
          )}
          {matchingSalePrices.length > 1 ? (
            <div className="space-y-2">
              <Label>Цена продажи</Label>
              <Select value={selectedSalePriceId || matchingSalePrices[0]?.id || ""} onValueChange={onSalePriceSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите цену" />
                </SelectTrigger>
                <SelectContent>
                  {matchingSalePrices.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {getPriceLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <CalculatedField 
              label="Цена продажи" 
              value={salePrice !== null ? formatNumber(salePrice) : "нет цены!"} 
              suffix={salePrice !== null ? " ₽/кг" : ""} 
            />
          )}
          <CalculatedField 
            label="Количество закупки" 
            value={formatNumber(purchaseAmount)} 
            suffix=" кг"
          />
          <CalculatedField 
            label="Количество продажи" 
            value={formatNumber(saleAmount)} 
            suffix=" кг"
          />
          <CalculatedField 
            label="Тариф доставки" 
            value={formatCurrency(deliveryTariff)} 
            suffix=" ₽"
          />
          <CalculatedField 
            label="Стоимость доставки" 
            value={formatCurrency(deliveryCost)} 
            suffix=" ₽"
          />
          <CalculatedField 
            label="Прибыль" 
            value={formatCurrency(profit)} 
            suffix=" ₽"
          />
        </div>
      </CardContent>
    </Card>
  );
}