import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { format } from "date-fns";
import { X, Plus } from "lucide-react";
import type { Supplier, Base, Warehouse, Price } from "@shared/schema";
import {
  PRODUCT_TYPE,
  BASE_TYPE,
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  EQUIPMENT_TYPE,
} from "@shared/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useRefuelingFilters } from "../hooks/use-refueling-filters";
import { useRefuelingCalculations } from "../hooks/use-refueling-calculations";
import { CalculatedField } from "../calculated-field";
import { formatNumber, formatPrice, formatCurrency } from "../utils";
import { extractPriceIdsForSubmit } from "@/pages/shared/utils/price-utils";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";
import { PRODUCT_TYPES } from "../constants";

const OTHER_SERVICE_TYPE_LABELS: Record<string, string> = {
  royalty_per_ton: "Роялти",
  percent_of_amount: "% от суммы",
  fixed: "Фиксир.",
};

export interface AdditionalProductPayload {
  productType: string;
  isPriceRecharge: boolean;
  isPvkjRecharge: boolean;
  setSalePriceZero: boolean;
  purchasePrice: number | null;
  purchasePriceId: string | null;
  purchasePriceIndex: number;
  salePrice: number | null;
  salePriceId: string | null;
  salePriceIndex: number;
  purchaseAmount: number | null;
  saleAmount: number | null;
  agentFee: number | null;
  agentFeeRate: number | null;
  isAgentFeeEnabled: boolean;
  otherServiceFee: number | null;
  otherServiceName: string | null;
  otherServiceType: string | null;
  otherServiceQuantity: number | null;
  isOtherServiceEnabled: boolean;
  profit: number | null;
}

export interface AdditionalProductSectionHandle {
  getPayload: () => AdditionalProductPayload;
  validate: (isDraft: boolean) => string | null;
}

interface AdditionalProductSectionProps {
  productType: string;
  onRemove: () => void;
  // Common shared values from parent form
  supplierId: string;
  buyerId: string;
  refuelingDate: Date;
  basisId: string;
  customerBasisId: string;
  selectedBasis: string;
  selectedBasisId: string;
  selectedSupplier: Supplier | undefined;
  isWarehouseSupplier: boolean;
  supplierWarehouse: Warehouse | undefined;
  equipmentType: string;
  selectedEquipmentId: string;
  equipmentBalance: number;
  inputMode: "liters" | "kg";
  quantityLiters: string;
  density: string;
  quantityKg: string;
  // Filter data
  suppliers: Supplier[];
  allBases: Base[];
  warehouses: Warehouse[] | undefined;
}

export const AdditionalProductSection = forwardRef<
  AdditionalProductSectionHandle,
  AdditionalProductSectionProps
>(
  (
    {
      productType,
      onRemove,
      supplierId,
      buyerId,
      refuelingDate,
      basisId,
      customerBasisId,
      selectedBasis,
      selectedBasisId,
      selectedSupplier,
      isWarehouseSupplier,
      supplierWarehouse,
      equipmentType,
      selectedEquipmentId,
      equipmentBalance,
      inputMode,
      quantityLiters,
      density,
      quantityKg,
      suppliers,
      allBases,
      warehouses,
    },
    ref,
  ) => {
    const { hasPermission } = useAuth();

    const [selectedPurchasePriceId, setSelectedPurchasePriceId] =
      useState<string>("");
    const [selectedSalePriceId, setSelectedSalePriceId] = useState<string>("");
    const [isPriceRecharge, setIsPriceRecharge] = useState(false);
    const [isPvkjRecharge, setIsPvkjRecharge] = useState(false);
    const [setSalePriceZero, setSetSalePriceZero] = useState(false);
    const [isAgentFeeEnabled, setIsAgentFeeEnabled] = useState(true);
    const [isOtherServiceEnabled, setIsOtherServiceEnabled] = useState(true);

    const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);
    const [addSalePriceOpen, setAddSalePriceOpen] = useState(false);

    // Get prices filtered for this product type
    const { purchasePrices, salePrices } = useRefuelingFilters({
      supplierId,
      buyerId,
      refuelingDate,
      basisId: basisId || undefined,
      customerBasisId: customerBasisId || undefined,
      productType,
      baseType: BASE_TYPE.REFUELING,
      counterpartyType: COUNTERPARTY_TYPE.REFUELING,
      suppliers,
      allBases,
      equipmentType,
      warehouses,
    });

    // Auto-select first purchase price
    useEffect(() => {
      if (supplierId && purchasePrices.length > 0 && !isWarehouseSupplier) {
        const firstId = `${purchasePrices[0].id}-0`;
        setSelectedPurchasePriceId(firstId);
      }
    }, [supplierId, purchasePrices, isWarehouseSupplier]);

    // Auto-select first sale price
    useEffect(() => {
      if (buyerId && salePrices.length > 0) {
        const firstId = `${salePrices[0].id}-0`;
        setSelectedSalePriceId(firstId);
      } else if (buyerId && salePrices.length === 0) {
        setSelectedSalePriceId("");
      }
    }, [buyerId, salePrices]);

    // Reset recharge flags when product type doesn't match
    useEffect(() => {
      if (productType !== PRODUCT_TYPE.SERVICE) setIsPriceRecharge(false);
      if (productType !== PRODUCT_TYPE.PVKJ) setIsPvkjRecharge(false);
    }, [productType]);

    // Disable services during recharge
    const isRechargeActive = isPriceRecharge || isPvkjRecharge;
    useEffect(() => {
      if (isRechargeActive) {
        setIsAgentFeeEnabled(false);
        setIsOtherServiceEnabled(false);
      }
    }, [isRechargeActive]);

    // Calculations for this product
    const {
      calculatedKg,
      purchasePrice,
      salePrice,
      purchaseAmount,
      saleAmount,
      agentFee,
      agentFeeRate,
      otherServiceFee,
      hasOtherService,
      otherServiceName,
      otherServiceType,
      otherServiceQuantity,
      profit,
      warehouseStatus,
      contractVolumeStatus,
      supplierContractVolumeStatus,
    } = useRefuelingCalculations({
      inputMode,
      quantityLiters,
      density,
      quantityKg,
      isWarehouseSupplier,
      supplierWarehouse,
      selectedBasis,
      selectedBasisId: selectedBasisId || undefined,
      purchasePrices,
      salePrices,
      selectedPurchasePriceId,
      selectedSalePriceId,
      selectedSupplier,
      productType,
      isEditing: false,
      initialQuantityKg: 0,
      initialWarehouseBalance: 0,
      refuelingDate,
      isPriceRecharge,
      isPvkjRecharge,
      setSalePriceZero,
      equipmentType,
      selectedEquipmentId,
      equipmentBalance,
      isAgentFeeEnabled,
      isOtherServiceEnabled,
    });

    const basisServicePrice =
      selectedSupplier?.basisPrices?.find(
        (bp) => bp.basisId === selectedBasisId,
      )?.servicePrice ?? null;

    const basisPvkjPrice =
      selectedSupplier?.basisPrices?.find(
        (bp) => bp.basisId === selectedBasisId,
      )?.pvkjPrice ?? null;

    const otherServiceTypeLabel = otherServiceType
      ? (OTHER_SERVICE_TYPE_LABELS[otherServiceType] ?? otherServiceType)
      : null;

    const otherServiceDescription = (() => {
      const parts: string[] = [];
      if (otherServiceTypeLabel) parts.push(otherServiceTypeLabel);
      if (otherServiceName) parts.push(otherServiceName);
      if (
        otherServiceType === "fixed" &&
        otherServiceQuantity &&
        parseFloat(otherServiceQuantity) > 1
      ) {
        const qty = parseFloat(otherServiceQuantity);
        const pricePerUnit = otherServiceFee > 0 ? otherServiceFee / qty : 0;
        parts.push(`× ${qty} шт.`);
        if (pricePerUnit > 0)
          parts.push(`(${formatCurrency(pricePerUnit)} ₽/шт.)`);
      }
      return parts.join(" · ");
    })();

    const productLabel =
      PRODUCT_TYPES.find((p) => p.value === productType)?.label ?? productType;

    useImperativeHandle(ref, () => ({
      getPayload: (): AdditionalProductPayload => {
        const { purchasePriceId, purchasePriceIndex, salePriceId, salePriceIndex } =
          extractPriceIdsForSubmit(
            selectedPurchasePriceId,
            selectedSalePriceId,
            purchasePrices,
            salePrices,
            isWarehouseSupplier,
          );
        return {
          productType,
          isPriceRecharge,
          isPvkjRecharge,
          setSalePriceZero,
          purchasePrice: purchasePrice !== null ? purchasePrice : null,
          purchasePriceId: purchasePriceId || null,
          purchasePriceIndex:
            purchasePriceIndex !== undefined ? purchasePriceIndex : 0,
          salePrice: salePrice !== null ? salePrice : null,
          salePriceId: salePriceId || null,
          salePriceIndex: salePriceIndex !== undefined ? salePriceIndex : 0,
          purchaseAmount: purchaseAmount !== null ? purchaseAmount : null,
          saleAmount: saleAmount !== null ? saleAmount : null,
          agentFee: agentFee !== null ? agentFee : null,
          agentFeeRate: agentFeeRate || null,
          isAgentFeeEnabled,
          otherServiceFee: otherServiceFee || null,
          otherServiceName: otherServiceName || null,
          otherServiceType: otherServiceType || null,
          otherServiceQuantity: otherServiceQuantity
            ? parseFloat(otherServiceQuantity)
            : null,
          isOtherServiceEnabled,
          profit: profit !== null ? profit : null,
        };
      },
      validate: (isDraft: boolean): string | null => {
        if (isDraft) return null;
        const qty = calculatedKg ? parseFloat(calculatedKg) : 0;
        if (qty <= 0) {
          return `Продукт "${productLabel}": укажите объём топлива.`;
        }
        if (
          !isWarehouseSupplier &&
          productType !== PRODUCT_TYPE.SERVICE &&
          purchasePrice === null
        ) {
          return `Продукт "${productLabel}": не указана цена покупки.`;
        }
        if (salePrice === null) {
          return `Продукт "${productLabel}": не указана цена продажи.`;
        }
        if (warehouseStatus.status === "error") {
          return `Продукт "${productLabel}": ${warehouseStatus.message}`;
        }
        if (contractVolumeStatus.status === "error") {
          return `Продукт "${productLabel}": ${contractVolumeStatus.message}`;
        }
        if (
          !isWarehouseSupplier &&
          supplierContractVolumeStatus.status === "error"
        ) {
          return `Продукт "${productLabel}": ${supplierContractVolumeStatus.message}`;
        }
        return null;
      },
    }));

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              {productLabel}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PVKJ recharge banner */}
          {productType === PRODUCT_TYPE.PVKJ && (
            <div className="mb-2 flex items-center gap-4 rounded-md border p-3 bg-accent/5">
              {basisPvkjPrice && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground leading-none mb-1">
                    Цена, установленная поставщиком
                  </span>
                  <span className="text-sm font-medium">
                    {formatPrice(basisPvkjPrice)} ₽/кг
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`pvkj-recharge-${productType}`}
                  checked={isPvkjRecharge}
                  onCheckedChange={(v) => setIsPvkjRecharge(!!v)}
                />
                <label
                  htmlFor={`pvkj-recharge-${productType}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  Перевыставить услугу
                </label>
              </div>
            </div>
          )}

          {/* Service recharge banner */}
          {productType === PRODUCT_TYPE.SERVICE && (
            <div className="mb-2 flex items-center gap-4 rounded-md border p-3 bg-accent/5">
              {basisServicePrice && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground leading-none mb-1">
                    Цена, установленная поставщиком
                  </span>
                  <span className="text-sm font-medium">
                    {formatPrice(basisServicePrice)} ₽/кг
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`price-recharge-${productType}`}
                  checked={isPriceRecharge}
                  onCheckedChange={(v) => {
                    setIsPriceRecharge(!!v);
                    if (v) setSetSalePriceZero(false);
                  }}
                  disabled={setSalePriceZero}
                />
                <label
                  htmlFor={`price-recharge-${productType}`}
                  className={`text-sm font-medium cursor-pointer ${setSalePriceZero ? "text-muted-foreground" : ""}`}
                >
                  Перевыставить услугу
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`sale-zero-${productType}`}
                  checked={setSalePriceZero}
                  onCheckedChange={(v) => {
                    setSetSalePriceZero(!!v);
                    if (v) setIsPriceRecharge(false);
                  }}
                  disabled={isPriceRecharge}
                />
                <label
                  htmlFor={`sale-zero-${productType}`}
                  className={`text-sm font-medium cursor-pointer ${isPriceRecharge ? "text-muted-foreground" : ""}`}
                >
                  Выставить цену продажи 0
                </label>
              </div>
            </div>
          )}

          {/* Price grid */}
          <div className="grid gap-3 md:grid-cols-4">
            {/* Purchase price */}
            {!isWarehouseSupplier &&
            purchasePrices.length > 0 &&
            !(basisServicePrice && productType === PRODUCT_TYPE.SERVICE) &&
            !(basisPvkjPrice && productType === PRODUCT_TYPE.PVKJ) ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Покупка</label>
                <div className="flex gap-1">
                  <Select
                    value={selectedPurchasePriceId}
                    onValueChange={setSelectedPurchasePriceId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Выберите цену" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchasePrices.map((price) =>
                        (price.priceValues || []).map((pvStr, idx) => {
                          try {
                            const parsed = JSON.parse(pvStr);
                            return (
                              <SelectItem
                                key={`${price.id}-${idx}`}
                                value={`${price.id}-${idx}`}
                              >
                                {formatPrice(parsed.price || "0")} ₽/кг
                              </SelectItem>
                            );
                          } catch {
                            return null;
                          }
                        }),
                      )}
                    </SelectContent>
                  </Select>
                  {hasPermission("prices", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddPurchasePriceOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (basisServicePrice &&
                productType === PRODUCT_TYPE.SERVICE) ||
              (basisPvkjPrice && productType === PRODUCT_TYPE.PVKJ) ? (
              <CalculatedField
                label="Покупка"
                value={
                  purchasePrice !== null ? formatPrice(purchasePrice) : "—"
                }
                suffix={purchasePrice !== null ? " ₽/кг" : ""}
                status="ok"
              />
            ) : !isWarehouseSupplier &&
              productType !== PRODUCT_TYPE.SERVICE ? (
              purchasePrice !== null ? (
                <CalculatedField
                  label="Покупка"
                  value={formatPrice(purchasePrice)}
                  suffix=" ₽/кг"
                  status="ok"
                />
              ) : (
                <div className="flex items-end gap-1">
                  <CalculatedField
                    label="Покупка"
                    value="Нет цены!"
                    status="error"
                  />
                  {hasPermission("prices", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddPurchasePriceOpen(true)}
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
                  purchasePrice !== null
                    ? formatPrice(purchasePrice)
                    : "Нет цены!"
                }
                suffix={purchasePrice !== null ? " ₽/кг" : ""}
                status={purchasePrice !== null ? "ok" : "error"}
              />
            )}

            <CalculatedField
              label="Сумма закупки"
              value={
                purchaseAmount !== null ? formatCurrency(purchaseAmount) : "—"
              }
              status={purchaseAmount !== null ? "ok" : "error"}
            />

            {/* Sale price */}
            {salePrices.length > 0 && !isPriceRecharge && !isPvkjRecharge ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Продажа</label>
                <div className="flex gap-1">
                  <Select
                    value={selectedSalePriceId}
                    onValueChange={setSelectedSalePriceId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Выберите цену" />
                    </SelectTrigger>
                    <SelectContent>
                      {salePrices.map((price) =>
                        (price.priceValues || []).map((pvStr, idx) => {
                          try {
                            const parsed = JSON.parse(pvStr);
                            return (
                              <SelectItem
                                key={`${price.id}-${idx}`}
                                value={`${price.id}-${idx}`}
                              >
                                {formatPrice(parsed.price || "0")} ₽/кг
                              </SelectItem>
                            );
                          } catch {
                            return null;
                          }
                        }),
                      )}
                    </SelectContent>
                  </Select>
                  {hasPermission("prices", "create") && (
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => setAddSalePriceOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (isPriceRecharge && productType === PRODUCT_TYPE.SERVICE) ||
              (isPvkjRecharge && productType === PRODUCT_TYPE.PVKJ) ? (
              <CalculatedField
                label="Продажа"
                value={
                  purchasePrice !== null ? formatPrice(purchasePrice) : "—"
                }
                suffix={purchasePrice !== null ? " ₽/кг" : ""}
                status="ok"
              />
            ) : (
              <div className="flex items-end gap-1">
                <CalculatedField
                  label="Продажа"
                  value="Нет цены!"
                  status="error"
                />
                {hasPermission("prices", "create") && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setAddSalePriceOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            <CalculatedField
              label="Сумма продажи"
              value={saleAmount !== null ? formatCurrency(saleAmount) : "—"}
              status={saleAmount !== null ? "ok" : "error"}
            />
          </div>

          {/* Agent fee */}
          {agentFeeRate > 0 && (
            <div
              className={`rounded-md border p-3 ${isRechargeActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={!isRechargeActive && isAgentFeeEnabled}
                  onCheckedChange={(v) => {
                    if (!isRechargeActive) setIsAgentFeeEnabled(!!v);
                  }}
                  disabled={isRechargeActive}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">
                    Агентское вознаграждение: {formatPrice(agentFeeRate)} ₽/кг
                  </span>
                  {agentFee > 0 && (
                    <span
                      className={`ml-2 text-sm ${!isRechargeActive && isAgentFeeEnabled ? "text-muted-foreground" : "text-muted-foreground line-through"}`}
                    >
                      = {formatCurrency(agentFee)} ₽
                    </span>
                  )}
                </div>
              </div>
              {isRechargeActive && (
                <p className="text-xs text-muted-foreground mt-1 pl-7">
                  Отключено при перевыставлении
                </p>
              )}
            </div>
          )}

          {/* Other services */}
          {hasOtherService && (
            <div
              className={`rounded-md border p-3 ${isRechargeActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={!isRechargeActive && isOtherServiceEnabled}
                  onCheckedChange={(v) => {
                    if (!isRechargeActive) setIsOtherServiceEnabled(!!v);
                  }}
                  disabled={isRechargeActive}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {otherServiceDescription || "Прочие услуги"}
                  </span>
                  {otherServiceFee > 0 && (
                    <span
                      className={`ml-2 text-sm ${!isRechargeActive && isOtherServiceEnabled ? "text-muted-foreground" : "text-muted-foreground line-through"}`}
                    >
                      = {formatCurrency(otherServiceFee)} ₽
                    </span>
                  )}
                </div>
              </div>
              {isRechargeActive && (
                <p className="text-xs text-muted-foreground mt-1 pl-7">
                  Отключено при перевыставлении
                </p>
              )}
            </div>
          )}

          {/* Status row */}
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
        </CardContent>

        {/* Inline price dialogs */}
        <AddPriceDialog
          isInline
          inlineOpen={addPurchasePriceOpen}
          onInlineOpenChange={setAddPurchasePriceOpen}
          onCreated={(id) => setSelectedPurchasePriceId(id)}
          inlineDefaults={{
            counterpartyType: COUNTERPARTY_TYPE.REFUELING,
            counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
            counterpartyId: supplierId || "",
            basisId: basisId || undefined,
            basis: selectedBasis || "",
            productType: productType as any,
          }}
        />
        <AddPriceDialog
          isInline
          inlineOpen={addSalePriceOpen}
          onInlineOpenChange={setAddSalePriceOpen}
          onCreated={(id) => setSelectedSalePriceId(id)}
          inlineDefaults={{
            counterpartyType: COUNTERPARTY_TYPE.REFUELING,
            counterpartyRole: COUNTERPARTY_ROLE.BUYER,
            counterpartyId: buyerId || "",
            basisId: basisId || undefined,
            basis: selectedBasis || "",
            productType: productType as any,
          }}
        />
      </Card>
    );
  },
);

AdditionalProductSection.displayName = "AdditionalProductSection";
