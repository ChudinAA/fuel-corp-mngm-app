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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { Price } from "@shared/schema";
import type { RefuelingFormData } from "../schemas";
import { CalculatedField } from "../calculated-field";
import { formatNumber, formatCurrency } from "../utils";
import { PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useContractVolume } from "../../shared/hooks/use-contract-volume";
import { Button } from "@/components/ui/button";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";

interface RefuelingPricingSectionProps {
  form: UseFormReturn<RefuelingFormData>;
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
  agentFee: number;
  warehouseStatus: { status: "ok" | "warning" | "error"; message: string };
  productType: string;
}

export function RefuelingPricingSection({
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
  agentFee,
  warehouseStatus,
  productType,
}: RefuelingPricingSectionProps) {
  const { hasPermission } = useAuth();

  // Логика проверки объема по договору
  const salePricePriceId = selectedSalePriceId?.split("-")[0] || null;
  const salePriceIndex = selectedSalePriceId ? parseInt(selectedSalePriceId.split("-")[1]) : null;

  const contractVolumeStatus = useContractVolume({
    priceId: salePricePriceId,
    priceIndex: salePriceIndex,
    currentQuantityKg: parseFloat(form.watch("quantityKg") || "0"),
    isEditing: !!form.getValues("id" as any),
    dealId: form.getValues("id" as any),
  });

  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
  const handlePurchasePriceCreated = (id: string) => {
    form.setValue("selectedPurchasePriceId", id);
  };

  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const handleSalePriceCreated = (id: string) => {
    form.setValue("selectedSalePriceId", id);
  };

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
        ) : !isWarehouseSupplier && productType !== PRODUCT_TYPE.SERVICE ? (
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
          <CalculatedField
            label="Покупка"
            value={
              purchasePrice !== null ? formatNumber(purchasePrice) : "Нет цены!"
            }
            suffix={purchasePrice !== null ? " ₽/кг" : ""}
            status={purchasePrice !== null ? "ok" : "error"}
          />
        )}

        <CalculatedField
          label="Сумма закупки"
          value={purchaseAmount !== null ? formatCurrency(purchaseAmount) : "—"}
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
          value={saleAmount !== null ? formatCurrency(saleAmount) : "—"}
        />
      </div>

      {agentFee > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Агентское вознаграждение: {formatCurrency(agentFee)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <CalculatedField
          label="Объем на складе"
          value={warehouseStatus.message}
          status={warehouseStatus.status}
        />

        <CalculatedField
          label="Объем по договору"
          value={contractVolumeStatus.message}
          status={contractVolumeStatus.status}
        />

        <CalculatedField
          label="Прибыль"
          value={profit !== null ? formatCurrency(profit) : "—"}
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
