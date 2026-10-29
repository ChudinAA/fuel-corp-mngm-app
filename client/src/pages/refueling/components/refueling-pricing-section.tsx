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
import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { Price, Supplier } from "@shared/schema";
import type { RefuelingFormData } from "../schemas";
import { CalculatedField } from "../calculated-field";
import { formatNumber, formatPrice, formatCurrency } from "../utils";
import { formatPricePerTonne } from "@shared/units";
import {
  formatRefuelingPriceOption,
  type RefuelingPriceUnit,
} from "../unit-calculations";
import { EQUIPMENT_TYPE, PRODUCT_TYPE, COUNTERPARTY_TYPE, COUNTERPARTY_ROLE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ContractHint, getSelectedPriceContract } from "@/pages/shared/components/contract-hint";
import { getPriceRateOptions } from "@/pages/shared/utils/price-rate";

const OTHER_SERVICE_TYPE_LABELS: Record<string, string> = {
  royalty_per_ton: "Роялти",
  percent_of_amount: "% от суммы",
  fixed: "Фиксир.",
};

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
  purchasePriceUnit: RefuelingPriceUnit;
  salePriceUnit: RefuelingPriceUnit;
  purchasePricePerTonne: number | null;
  salePricePerTonne: number | null;
  purchaseAmount: number | null;
  saleAmount: number | null;
  profit: number | null;
  isRechargeActive?: boolean;
  agentFee: number;
  agentFeeRatePerTonne: number;
  otherServiceFee?: number;
  /** Флаг: настроена ли "Прочая услуга" (для немедленного отображения) */
  hasOtherService?: boolean;
  /** Название прочей услуги */
  otherServiceName?: string | null;
  /** Тип прочей услуги */
  otherServiceType?: string | null;
  /** Кол-во для fixed-типа */
  otherServiceQuantity?: string | null;
  warehouseStatus: { status: "ok" | "warning" | "error"; message: string };
  contractVolumeStatus: { status: "ok" | "warning" | "error"; message: string };
  supplierContractVolumeStatus: {
    status: "ok" | "warning" | "error";
    message: string;
  };
  productType: string;
  selectedSupplier: Supplier | undefined;
  equipmentType?: string;
  /** Включено ли агентское вознаграждение в экономику сделки */
  isAgentFeeEnabled?: boolean;
  /** Включена ли прочая услуга в экономику сделки */
  isOtherServiceEnabled?: boolean;
  /** Обработчик смены флага включения агентского */
  onAgentFeeEnabledChange?: (v: boolean) => void;
  /** Обработчик смены флага включения прочей услуги */
  onOtherServiceEnabledChange?: (v: boolean) => void;
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
  purchasePriceUnit,
  salePriceUnit,
  purchasePricePerTonne,
  salePricePerTonne,
  purchaseAmount,
  saleAmount,
  profit,
  isRechargeActive = false,
  agentFee,
  agentFeeRatePerTonne,
  otherServiceFee = 0,
  hasOtherService = false,
  otherServiceName,
  otherServiceType,
  otherServiceQuantity,
  warehouseStatus,
  contractVolumeStatus,
  supplierContractVolumeStatus,
  productType,
  selectedSupplier,
  equipmentType = "common",
  isAgentFeeEnabled = true,
  isOtherServiceEnabled = true,
  onAgentFeeEnabledChange,
  onOtherServiceEnabledChange,
}: RefuelingPricingSectionProps) {
  const inputMode = form.watch("inputMode");
  const density = form.watch("density");
  const { hasPermission } = useAuth();

  const watchSupplierId = form.watch("supplierId");
  const watchBuyerId = form.watch("buyerId");
  const watchBasisId = form.watch("basisId");
  const watchBasis = form.watch("basis");
  const rechargedFeeLabels = [
    isAgentFeeEnabled && agentFee > 0 ? "агентское вознаграждение" : null,
    isOtherServiceEnabled && otherServiceFee > 0 ? "прочие услуги" : null,
  ].filter((label): label is string => Boolean(label));

  const basisServicePrice = selectedSupplier?.basisPrices?.find(
    (bp) => bp.basisId === watchBasisId
  )?.servicePricePerTonne ?? null;

  const basisPvkjPrice = selectedSupplier?.basisPrices?.find(
    (bp) => bp.basisId === watchBasisId
  )?.pvkjPricePerTonne ?? null;

  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
  const handlePurchasePriceCreated = (id: string) => {
    form.setValue("selectedPurchasePriceId", id);
  };

  const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);
  const handleSalePriceCreated = (id: string) => {
    form.setValue("selectedSalePriceId", id);
  };

  useEffect(() => {
    if (purchasePrices.length > 0 && !selectedPurchasePriceId) {
      const firstId = `${purchasePrices[0].id}-0`;
      setSelectedPurchasePriceId(firstId);
      form.setValue("selectedPurchasePriceId", firstId);
    }
  }, [purchasePrices, selectedPurchasePriceId]);

  useEffect(() => {
    if (salePrices.length > 0 && !selectedSalePriceId) {
      const firstId = `${salePrices[0].id}-0`;
      setSelectedSalePriceId(firstId);
      form.setValue("selectedSalePriceId", firstId);
    }
  }, [salePrices, selectedSalePriceId]);

  // Метка типа прочей услуги
  const otherServiceTypeLabel = otherServiceType ? (OTHER_SERVICE_TYPE_LABELS[otherServiceType] ?? otherServiceType) : null;

  // Описание прочей услуги (тип + название + кол-во + цена за штуку для fixed)
  const otherServiceDescription = (() => {
    const parts: string[] = [];
    if (otherServiceTypeLabel) parts.push(otherServiceTypeLabel);
    if (otherServiceName) parts.push(otherServiceName);
    if (otherServiceType === "fixed" && otherServiceQuantity && parseFloat(otherServiceQuantity) > 1) {
      const qty = parseFloat(otherServiceQuantity);
      const pricePerUnit = otherServiceFee > 0 ? otherServiceFee / qty : 0;
      parts.push(`× ${qty} шт.`);
      if (pricePerUnit > 0) parts.push(`(${formatCurrency(pricePerUnit)} ₽/шт.)`);
    }
    return parts.join(" · ");
  })();

  return (
    <>
      {productType === PRODUCT_TYPE.PVKJ && (
        <div className="mb-4 flex items-center justify-between rounded-md border p-3 bg-accent/5">
          <div className="flex items-center gap-4">
            {basisPvkjPrice && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground leading-none mb-1">
                  Цена, установленная поставщиком
                </span>
                <span className="text-sm font-medium">
                  {formatPricePerTonne(Number(basisPvkjPrice))} ₽/т
                </span>
              </div>
            )}
            <FormField
              control={form.control}
              name="isPvkjRecharge"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-reprice-pvkj"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Перевыставить услугу</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
      {productType === PRODUCT_TYPE.SERVICE && (
        <div className="mb-4 flex items-center justify-between rounded-md border p-3 bg-accent/5">
          <div className="flex items-center gap-4">
            {basisServicePrice && (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground leading-none mb-1">
                  Цена, установленная поставщиком
                </span>
                <span className="text-sm font-medium">
                  {formatPricePerTonne(Number(basisServicePrice))} ₽/т
                </span>
              </div>
            )}
            <FormField
              control={form.control}
              name="isPriceRecharge"
              render={({ field }) => {
                const setSalePriceZeroVal = form.watch("setSalePriceZero");
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          if (v) form.setValue("setSalePriceZero", false);
                        }}
                        disabled={!!setSalePriceZeroVal}
                        data-testid="checkbox-reprice-service"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className={setSalePriceZeroVal ? "text-muted-foreground" : ""}>Перевыставить услугу</FormLabel>
                    </div>
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="setSalePriceZero"
              render={({ field }) => {
                const isPriceRechargeVal = form.watch("isPriceRecharge");
                return (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          if (v) form.setValue("isPriceRecharge", false);
                        }}
                        disabled={!!isPriceRechargeVal}
                        data-testid="checkbox-set-sale-price-zero"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className={isPriceRechargeVal ? "text-muted-foreground" : ""}>Выставить цену продажи 0</FormLabel>
                    </div>
                  </FormItem>
                );
              }}
            />
          </div>
        </div>
      )}
      <div className="grid items-start gap-3 md:grid-cols-4">
        {!isWarehouseSupplier &&
        purchasePrices.length > 0 &&
        !(basisServicePrice && productType === PRODUCT_TYPE.SERVICE) &&
        !(basisPvkjPrice && productType === PRODUCT_TYPE.PVKJ) ? (
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
              const selectedContract = getSelectedPriceContract(purchasePrices, effectiveValue);

              return (
                <FormItem className="space-y-1">
                  <FormLabel className="flex h-4 items-center text-xs leading-4 text-muted-foreground">
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
                        {purchasePrices.map((price) =>
                          getPriceRateOptions(price).map(({ value, unit }, idx) =>
                            value === null ? null : (
                              <SelectItem
                                key={`${price.id}-${idx}`}
                                value={`${price.id}-${idx}`}
                              >
                                {formatRefuelingPriceOption(
                                  value,
                                  inputMode,
                                  density,
                                  "₽",
                                  unit,
                                )}
                              </SelectItem>
                            ),
                          ),
                        )}
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
                  <ContractHint contractNumber={selectedContract?.contractNumber} contractName={(selectedContract as any)?.contractName} />
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : basisServicePrice &&
          productType === PRODUCT_TYPE.SERVICE ? (
          <CalculatedField
            label="Покупка"
            value={
              purchasePricePerTonne !== null
                ? formatPricePerTonne(purchasePricePerTonne)
                : "—"
            }
            suffix={purchasePricePerTonne !== null ? " ₽/т" : ""}
            status="ok"
          />
        ) : basisPvkjPrice &&
          productType === PRODUCT_TYPE.PVKJ ? (
          <CalculatedField
            label="Покупка"
            value={
              purchasePricePerTonne !== null
                ? formatPricePerTonne(purchasePricePerTonne)
                : "—"
            }
            suffix={purchasePricePerTonne !== null ? " ₽/т" : ""}
            status="ok"
          />
        ) : !isWarehouseSupplier && productType !== PRODUCT_TYPE.SERVICE ? (
          purchasePricePerTonne !== null ? (
            <CalculatedField
              label="Покупка"
              value={formatPricePerTonne(purchasePricePerTonne)}
              suffix=" ₽/т"
              status="ok"
            />
          ) : (
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
          )
        ) : (
          <CalculatedField
            label="Покупка"
            value={
              purchasePricePerTonne !== null
                ? formatPricePerTonne(purchasePricePerTonne)
                : "Нет цены!"
            }
            suffix={purchasePricePerTonne !== null ? " ₽/т" : ""}
            status={purchasePricePerTonne !== null ? "ok" : "error"}
          />
        )}

        <CalculatedField
          label="Сумма закупки"
          value={purchaseAmount !== null ? formatCurrency(purchaseAmount) : "—"}
          status={purchaseAmount !== null ? "ok" : "error"}
        />
        {salePrices.length > 0 && !form.watch("isPriceRecharge") && !form.watch("isPvkjRecharge") ? (
          <FormField
            control={form.control}
            name="selectedSalePriceId"
            render={({ field }) => {
              const firstPriceId =
                salePrices.length > 0 ? `${salePrices[0].id}-0` : undefined;
              const effectiveValue =
                selectedSalePriceId || field.value || firstPriceId;
              const selectedContract = getSelectedPriceContract(salePrices, effectiveValue);

              if (!selectedSalePriceId && !field.value && firstPriceId) {
                setSelectedSalePriceId(firstPriceId);
                field.onChange(firstPriceId);
              }

              return (
                <FormItem className="space-y-1">
                  <FormLabel className="flex h-4 items-center text-xs leading-4 text-muted-foreground">
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
                        {salePrices.map((price) =>
                          getPriceRateOptions(price).map(({ value, unit }, idx) =>
                            value === null ? null : (
                              <SelectItem
                                key={`${price.id}-${idx}`}
                                value={`${price.id}-${idx}`}
                              >
                                {formatRefuelingPriceOption(
                                  value,
                                  inputMode,
                                  density,
                                  "₽",
                                  unit,
                                )}
                              </SelectItem>
                            ),
                          ),
                        )}
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
                  <ContractHint contractNumber={selectedContract?.contractNumber} contractName={(selectedContract as any)?.contractName} />
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ) : (form.watch("isPriceRecharge") && productType === PRODUCT_TYPE.SERVICE) ||
            (form.watch("isPvkjRecharge") && productType === PRODUCT_TYPE.PVKJ) ? (
          <CalculatedField
            label="Продажа"
            value={
              salePricePerTonne !== null
                ? formatPricePerTonne(salePricePerTonne)
                : "—"
            }
            suffix={salePricePerTonne !== null ? " ₽/т" : ""}
            status="ok"
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

        <div className="space-y-1">
          <CalculatedField
            label="Сумма продажи"
            value={saleAmount !== null ? formatCurrency(saleAmount) : "—"}
            status={saleAmount !== null ? "ok" : "error"}
          />
          {isRechargeActive && rechargedFeeLabels.length > 0 && (
            <p className="text-xs text-muted-foreground">
              В сумму включены перевыставленные расходы: {rechargedFeeLabels.join(", ")}.
            </p>
          )}
        </div>
      </div>

      {/* Агентское вознаграждение */}
      {agentFeeRatePerTonne > 0 && (
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isAgentFeeEnabled}
              onCheckedChange={(v) => onAgentFeeEnabledChange?.(!!v)}
              data-testid="checkbox-agent-fee-enabled"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm">
                Агентское вознаграждение:{" "}
                {formatPricePerTonne(agentFeeRatePerTonne)} ₽/т
              </span>
              {agentFee > 0 && (
                <span className={`ml-2 text-sm ${isAgentFeeEnabled ? "text-muted-foreground" : "text-muted-foreground line-through"}`}>
                  = {formatCurrency(agentFee)} ₽
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Прочие услуги */}
      {hasOtherService && (
        <div className="rounded-md border p-3">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isOtherServiceEnabled}
              onCheckedChange={(v) => onOtherServiceEnabledChange?.(!!v)}
              data-testid="checkbox-other-service-enabled"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">
                {otherServiceDescription || "Прочие услуги"}
              </span>
              {otherServiceFee > 0 && (
                <span className={`ml-2 text-sm ${isOtherServiceEnabled ? "text-muted-foreground" : "text-muted-foreground line-through"}`}>
                  = {formatCurrency(otherServiceFee)} ₽
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-4">
        <CalculatedField
          label={
            equipmentType === EQUIPMENT_TYPE.LIK
              ? "Объем на СЗ"
              : "Объем на складе"
          }
          value={warehouseStatus.message}
          status={warehouseStatus.status}
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
        inlineDefaults={{
          counterpartyType: equipmentType === EQUIPMENT_TYPE.LIK
            ? COUNTERPARTY_TYPE.REFUELING
            : COUNTERPARTY_TYPE.REFUELING,
          counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
          counterpartyId: watchSupplierId || "",
          basisId: watchBasisId || undefined,
          basis: watchBasis || "",
          productType: (productType as any) || PRODUCT_TYPE.KEROSENE,
          nomenclatureId: form.getValues("nomenclatureId") || undefined,
        }}
      />

      <AddPriceDialog
        isInline
        inlineOpen={addSalePriceOpen}
        onInlineOpenChange={setAddSalePriceOpen}
        onCreated={handleSalePriceCreated}
        inlineDefaults={{
          counterpartyType: COUNTERPARTY_TYPE.REFUELING,
          counterpartyRole: COUNTERPARTY_ROLE.BUYER,
          counterpartyId: watchBuyerId || "",
          basisId: watchBasisId || undefined,
          basis: watchBasis || "",
          productType: (productType as any) || PRODUCT_TYPE.KEROSENE,
          nomenclatureId: form.getValues("nomenclatureId") || undefined,
        }}
      />
    </>
  );
}
