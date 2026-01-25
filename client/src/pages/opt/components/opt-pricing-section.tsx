import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseFormReturn } from "react-hook-form";
import type { Price, Warehouse } from "@shared/schema";
import type { OptFormData } from "../schemas";
import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import { useAuth } from "@/hooks/use-auth";

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
  profit: number | null;
  supplierWarehouse: Warehouse | undefined;
  finalKg: number;
  isEditing: boolean;
  contractVolumeStatus: { status: "ok" | "warning" | "error"; message: string };
  supplierContractVolumeStatus: {
    status: "ok" | "warning" | "error";
    message: string;
  };
  warehouseBalanceAtDate: number | null;
  isWarehouseBalanceLoading?: boolean;
  warehousePriceAtDate?: number | null;
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
  profit,
  supplierWarehouse,
  finalKg,
  isEditing,
  contractVolumeStatus,
  supplierContractVolumeStatus,
  warehouseBalanceAtDate,
  isWarehouseBalanceLoading,
  warehousePriceAtDate,
}: OptPricingSectionProps) {
  const { hasPermission } = useAuth();

  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
  const handlePurchasePriceCreated = (id: string) => {
    form.setValue("selectedPurchasePriceId", id);
  };

  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const handleSalePriceCreated = (id: string) => {
    form.setValue("selectedSalePriceId", id);
  };

  const getWarehouseStatus = (): {
    status: "ok" | "warning" | "error";
    message: string;
  } => {
    if (!isWarehouseSupplier) {
      return { status: "ok", message: "Объем не со склада" };
    }

    if (!supplierWarehouse || finalKg <= 0) {
      return { status: "ok", message: "—" };
    }

    const availableBalance = warehouseBalanceAtDate !== null ? warehouseBalanceAtDate : 0;
    const remaining = availableBalance - finalKg;

    if (remaining >= 0) {
      return { status: "ok", message: `ОК: ${formatNumber(remaining)} кг` };
    } else {
      return {
        status: "error",
        message: `Недостаточно! Доступно: ${formatNumber(availableBalance)} кг`,
      };
    }
  };

  const warehouseStatus = getWarehouseStatus();

  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        {!isWarehouseSupplier && purchasePrices.length > 0 ? (
          <FormField
            control={form.control}
            name="selectedPurchasePriceId"
            render={({ field }) => {
              const firstPriceId =
                purchasePrices.length > 0
                  ? `${purchasePrices[0].id}-0`
                  : undefined;
              const effectiveValue =
                selectedPurchasePriceId || field.value || firstPriceId;

              if (!selectedPurchasePriceId && !field.value && firstPriceId) {
                setSelectedPurchasePriceId(firstPriceId);
                field.onChange(firstPriceId);
              }

              return (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Покупка
                  </FormLabel>
                  <div className="flex gap-1">
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedPurchasePriceId(value);
                      }}
                      value={effectiveValue}
                    >
                      <FormControl>
                        <SelectTrigger
                          data-testid="select-purchase-price"
                          className="flex-1"
                        >
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
                                <SelectItem
                                  key={`${price.id}-${idx}`}
                                  value={`${price.id}-${idx}`}
                                >
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
                    {hasPermission("prices", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setAddPurchasePriceOpen(true)}
                        data-testid="button-add-purchase-price-inline"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : !isWarehouseSupplier ? (
          <div className="flex items-end gap-1">
            <CalculatedField label="Покупка" value="Нет цены!" status="error" />
            {hasPermission("prices", "create") && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setAddPurchasePriceOpen(true)}
                data-testid="button-add-purchase-price-inline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <CalculatedField
              label="Покупка"
              value={
                purchasePrice !== null ? formatNumber(purchasePrice) : "Нет цены!"
              }
              suffix={purchasePrice !== null ? " ₽/кг" : ""}
              status={purchasePrice !== null ? "ok" : "error"}
            />
            {isWarehouseSupplier && (
              <span className="text-[10px] text-muted-foreground px-1 leading-none">
                {isWarehouseBalanceLoading ? "Загрузка цены..." : warehousePriceAtDate !== null ? "Цена со склада на дату" : "Цена не найдена"}
              </span>
            )}
          </div>
        )}

        <CalculatedField
          label="Сумма закупки"
          value={
            purchaseAmount !== null ? formatCurrency(purchaseAmount) : "Ошибка"
          }
          status={purchaseAmount !== null ? "ok" : "error"}
        />

        {salePrices.length > 0 ? (
          <FormField
            control={form.control}
            name="selectedSalePriceId"
            render={({ field }) => {
              const firstPriceId =
                salePrices.length > 0 ? `${salePrices[0].id}-0` : undefined;
              const effectiveValue =
                selectedSalePriceId || field.value || firstPriceId;

              if (!selectedSalePriceId && !field.value && firstPriceId) {
                setSelectedSalePriceId(firstPriceId);
                field.onChange(firstPriceId);
              }

              return (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Продажа
                  </FormLabel>
                  <div className="flex gap-1">
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedSalePriceId(value);
                      }}
                      value={effectiveValue}
                    >
                      <FormControl>
                        <SelectTrigger
                          data-testid="select-sale-price"
                          className="flex-1"
                        >
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
                                <SelectItem
                                  key={`${price.id}-${idx}`}
                                  value={`${price.id}-${idx}`}
                                >
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
                    {hasPermission("prices", "create") && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => setAddSalePriceOpen(true)}
                        data-testid="button-add-sale-price-inline"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : (
          <div className="flex items-end gap-1">
            <CalculatedField label="Продажа" value="Нет цены!" status="error" />
            {hasPermission("prices", "create") && (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setAddSalePriceOpen(true)}
                data-testid="button-add-sale-price-inline"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <CalculatedField
          label="Сумма продажи"
          value={saleAmount !== null ? formatCurrency(saleAmount) : "Ошибка"}
          status={saleAmount !== null ? "ok" : "error"}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <CalculatedField
          label="Объем на складе"
          value={isWarehouseBalanceLoading ? "Загрузка..." : warehouseStatus.message}
          status={isWarehouseBalanceLoading ? "ok" : warehouseStatus.status}
        />

        <CalculatedField
          label="Доступн. об-м Поставщика"
          value={
            isWarehouseSupplier ? "ОК" : supplierContractVolumeStatus.message
          }
          status={
            isWarehouseSupplier ? "ok" : supplierContractVolumeStatus.status
          }
        />

        <CalculatedField
          label="Доступн. об-м Покупателя"
          value={contractVolumeStatus.message}
          status={contractVolumeStatus.status}
        />

        <CalculatedField
          label="Прибыль"
          value={profit !== null ? formatCurrency(profit) : "—"}
          status={
            profit !== null && profit >= 0
              ? "ok"
              : profit !== null
                ? "warning"
                : undefined
          }
        />
      </div>

      <AddPriceDialog
        isInline
        inlineOpen={addPurchasePriceOpen}
        onInlineOpenChange={setAddPurchasePriceOpen}
        onCreated={handlePurchasePriceCreated}
      />

      <AddPriceDialog
        isInline
        inlineOpen={addSalePriceOpen}
        onInlineOpenChange={setAddSalePriceOpen}
        onCreated={handleSalePriceCreated}
      />
    </>
  );
}
