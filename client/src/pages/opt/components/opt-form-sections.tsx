import { Combobox } from "@/components/ui/combobox";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  FormMessage,
} from "@/components/ui/form";
import { Plus } from "lucide-react";
import { BaseTypeBadge } from "@/components/base-type-badge";
import type { UseFormReturn } from "react-hook-form";
import type {
  Base,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  Price,
} from "@shared/schema";
import { CalculatedField } from "./calculated-field";
import { formatCurrency, formatNumber } from "../utils";
import type { OptFormData } from "../schemas";
import { AddLogisticsDialog } from "@/pages/directories/logistics-dialog";
import { AddDeliveryCostDialog } from "@/pages/delivery/components/delivery-cost-dialog";
import { useAuth } from "@/hooks/use-auth";

interface VolumeInputSectionProps {
  form: UseFormReturn<OptFormData>;
  inputMode: "liters" | "kg";
  setInputMode: (mode: "liters" | "kg") => void;
  calculatedKg: string;
}

export function VolumeInputSection({
  form,
  inputMode,
  setInputMode,
  calculatedKg,
}: VolumeInputSectionProps) {
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");

  const inputMode = form.watch("inputMode");

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Объем топлива</CardTitle>
          <FormField
            control={form.control}
            name="inputMode"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                  Литры/Плотность
                </Label>
                <Switch
                  checked={field.value === "kg"}
                  onCheckedChange={(checked) => {
                    const mode = checked ? "kg" : "liters";
                    field.onChange(mode);
                    setInputMode(mode);
                  }}
                  data-testid="switch-input-mode"
                />
                <Label className="text-sm text-muted-foreground">КГ</Label>
              </div>
            )}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="quantityLiters"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">Литры</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0.00"
                    data-testid="input-liters"
                    disabled={inputMode === "kg"}
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
                <FormLabel className="flex items-center gap-2">
                  Плотность
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    placeholder="0.8000"
                    data-testid="input-density"
                    disabled={inputMode === "kg"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {inputMode === "liters" ? (
            <CalculatedField
              label="КГ (расчет)"
              value={
                watchLiters && watchDensity ? formatNumber(calculatedKg) : "—"
              }
              suffix={watchLiters && watchDensity ? " кг" : ""}
            />
          ) : (
            <FormField
              control={form.control}
              name="quantityKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Количество (КГ)
                  </FormLabel>
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
  bases?: Base[];
  deliveryCost: number | null;
}

export function LogisticsSection({
  form,
  carriers,
  deliveryLocations,
  bases,
  deliveryCost,
}: LogisticsSectionProps) {
  const { hasPermission } = useAuth();

  const [addDeliveryLocationOpen, setAddDeliveryLocationOpen] = useState(false);
  const [addCarrierOpen, setAddCarrierOpen] = useState(false);
  const [addDeliveryCostOpen, setAddDeliveryCostOpen] = useState(false);

  const handleDeliveryLocationCreated = (id: string, type: string) => {
    if (type === "delivery_location") {
      form.setValue("deliveryLocationId", id);
    }
  };

  const handleCarrierCreated = (id: string, type: string) => {
    if (type === "carrier") {
      form.setValue("carrierId", id);
    }
  };

  const getBase = (baseId: string) => {
    const base = bases?.find((b) => b.id === baseId);
    return base;
  };

  const watchDeliveryLocationId = form.watch("deliveryLocationId");
  const selectedLocation = deliveryLocations?.find(
    (l) => l.id === watchDeliveryLocationId,
  );
  const selectedLocationBase = selectedLocation
    ? getBase(selectedLocation.baseId || "")
    : null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-6">
          <CardTitle className="text-lg">Логистика</CardTitle>
          {selectedLocationBase && (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-1 duration-200">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {selectedLocationBase.name}
              </span>
              <BaseTypeBadge
                type={selectedLocationBase.baseType}
                short={true}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="deliveryLocationId"
            render={({ field }) => (
              <FormItem className="col-span-1 min-w-0">
                <FormLabel className="flex items-center gap-2">
                  Точка поставки
                </FormLabel>
                <div className="flex gap-1 items-center w-full">
                  <FormControl>
                    <div className="flex-1 min-w-0">
                      <Combobox
                        options={(deliveryLocations || []).map((location) => {
                          const base = getBase(location.baseId || "");
                          return {
                            value: location.id,
                            label: location.name,
                            render: (
                              <div className="flex items-center w-full gap-1">
                                <span className="truncate">{location.name}</span>
                                {base && (
                                  <div className="flex items-center gap-1 opacity-60 scale-90 origin-right">
                                    <BaseTypeBadge
                                      type={base.baseType}
                                      short={true}
                                    />
                                    <span className="text-[13px] whitespace-nowrap truncate">
                                      {base.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )
                          };
                        })}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите место"
                        className="w-full"
                        dataTestId="select-delivery-location"
                      />
                    </div>
                  </FormControl>
                  {hasPermission("directories", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddDeliveryLocationOpen(true)}
                      data-testid="button-add-delivery-location-inline"
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
                        options={carriers?.map((carrier) => ({
                          value: carrier.id,
                          label: carrier.name
                        })) || []}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите перевозчика"
                        className="w-full"
                        dataTestId="select-carrier"
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

          <CalculatedField
            label="Доставка"
            value={deliveryCost !== null ? formatCurrency(deliveryCost) : "—"}
          />
        </div>
      </CardContent>

      <AddLogisticsDialog
        carriers={carriers || []}
        isInline
        inlineOpen={addDeliveryLocationOpen}
        onInlineOpenChange={setAddDeliveryLocationOpen}
        onCreated={handleDeliveryLocationCreated}
        defaultType="delivery_location"
      />

      <AddLogisticsDialog
        carriers={carriers || []}
        isInline
        inlineOpen={addCarrierOpen}
        onInlineOpenChange={setAddCarrierOpen}
        onCreated={handleCarrierCreated}
        defaultType="carrier"
      />

      <AddDeliveryCostDialog
        editDeliveryCost={null}
        isInline
        inlineOpen={addDeliveryCostOpen}
        onInlineOpenChange={setAddDeliveryCostOpen}
      />
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
  onSalePriceSelect,
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
              <Select
                value={
                  selectedPurchasePriceId || matchingPurchasePrices[0]?.id || ""
                }
                onValueChange={onPurchasePriceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите цену" />
                </SelectTrigger>
                <SelectContent>
                  {matchingPurchasePrices.map((p) => (
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
              value={
                purchasePrice !== null
                  ? formatNumber(purchasePrice)
                  : "нет цены!"
              }
              suffix={purchasePrice !== null ? " ₽/кг" : ""}
            />
          )}
          {matchingSalePrices.length > 1 ? (
            <div className="space-y-2">
              <Label>Цена продажи</Label>
              <Select
                value={selectedSalePriceId || matchingSalePrices[0]?.id || ""}
                onValueChange={onSalePriceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите цену" />
                </SelectTrigger>
                <SelectContent>
                  {matchingSalePrices.map((p) => (
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
