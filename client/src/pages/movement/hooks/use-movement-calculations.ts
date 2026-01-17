import { useEffect, useMemo } from "react";
import {
  MOVEMENT_TYPE,
  PRODUCT_TYPE,
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  DELIVERY_ENTITY_TYPE,
  ProductType,
} from "@shared/constants";
import { format } from "date-fns";
import { calculateKgFromLiters } from "../utils";
import type { AllSupplier } from "../types";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";

interface UseMovementCalculationsProps {
  form?: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchProductType: string;
  watchSupplierId: string;
  watchBasis?: string;
  watchFromWarehouseId: string;
  watchToWarehouseId: string;
  watchCarrierId: string;
  watchMovementDate: Date;
  watchLiters: string | undefined;
  watchDensity: string | undefined;
  watchKg: string | undefined;
  inputMode: "liters" | "kg";
  warehouses: any[];
  suppliers: AllSupplier[];
  prices: any[];
  deliveryCosts: any[];
  allBases?: any[];
  isEditing: boolean;
  selectedPurchasePriceId: string;
  setSelectedPurchasePriceId: (id: string) => void;
}

export function useMovementCalculations({
  form,
  watchMovementType,
  watchProductType,
  watchSupplierId,
  watchBasis,
  watchFromWarehouseId,
  watchToWarehouseId,
  watchCarrierId,
  watchMovementDate,
  watchLiters,
  watchDensity,
  watchKg,
  inputMode,
  warehouses,
  suppliers,
  prices,
  deliveryCosts,
  allBases,
  isEditing,
  selectedPurchasePriceId,
  setSelectedPurchasePriceId,
}: UseMovementCalculationsProps) {
  const watchSelectedPurchasePriceId = selectedPurchasePriceId || form?.watch("selectedPurchasePriceId") || "";

  // Calculate quantity in kg
  const calculatedKg = useMemo(() => {
    if (inputMode === "liters" && watchLiters && watchDensity) {
      return calculateKgFromLiters(
        parseFloat(watchLiters),
        parseFloat(watchDensity),
      );
    }
    return watchKg && watchKg !== "" ? parseFloat(watchKg) : 0;
  }, [inputMode, watchLiters, watchDensity, watchKg]);

  const kgNum = calculatedKg || 0;

  const { data: historicalBalance } = useWarehouseBalance(
    watchFromWarehouseId || undefined,
    watchMovementDate
  );

  // Find matching prices for supplier
  const availablePurchasePrices = useMemo(() => {
    if (watchMovementType !== MOVEMENT_TYPE.SUPPLY || !watchSupplierId || !watchMovementDate) return [];

    const dateStr = format(watchMovementDate, "yyyy-MM-dd'T'HH:mm:ss");
    const supplier = suppliers.find((s) => s.id === watchSupplierId);
    if (!supplier) return [];

    let priceProductType: ProductType = PRODUCT_TYPE.KEROSENE;
    if (watchProductType === PRODUCT_TYPE.PVKJ) {
      priceProductType = PRODUCT_TYPE.PVKJ;
    }

    let baseName = watchBasis;
    if (!baseName && supplier.baseIds && supplier.baseIds.length > 0) {
      const firstBase = allBases?.find((b) => b.id === supplier.baseIds[0]);
      if (firstBase) baseName = firstBase.name;
    }

    if (!baseName) return [];

    return prices.filter(
      (p) =>
        p.counterpartyId === watchSupplierId &&
        p.counterpartyType === COUNTERPARTY_TYPE.WHOLESALE &&
        p.counterpartyRole === COUNTERPARTY_ROLE.SUPPLIER &&
        p.productType === priceProductType &&
        p.basis === baseName &&
        p.dateFrom <= dateStr &&
        p.dateTo >= dateStr &&
        p.isActive,
    );
  }, [watchMovementType, watchSupplierId, watchMovementDate, suppliers, watchProductType, watchBasis, prices, allBases]);

  // Extract actual price value using shared hook
  const { purchasePrice, purchasePriceId, purchasePriceIndex } = usePriceExtraction({
    purchasePrices: availablePurchasePrices,
    salePrices: [],
    selectedPurchasePriceId: watchSelectedPurchasePriceId,
    selectedSalePriceId: "",
    isWarehouseSupplier: false,
    supplierWarehouse: undefined,
  });

  // Автоматическая установка выбранной цены, если она не установлена
  useEffect(() => {
    if (form && watchMovementType === MOVEMENT_TYPE.SUPPLY && !selectedPurchasePriceId && availablePurchasePrices.length > 0) {
      const firstPrice = availablePurchasePrices[0];
      const priceValues = firstPrice.priceValues || [];
      if (priceValues.length > 0) {
        const compositeId = `${firstPrice.id}-0`;
        setSelectedPurchasePriceId(compositeId);
        form.setValue("selectedPurchasePriceId", compositeId);
      }
    }
  }, [watchMovementType, watchSupplierId, watchBasis, watchProductType, watchMovementDate, availablePurchasePrices.length]);

  // Handle internal movement price (average cost)
  const finalPurchasePrice = useMemo(() => {
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find((w) => w.id === watchFromWarehouseId);
      if (fromWarehouse) {
        const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
        const averageCost = isPvkj ? fromWarehouse.pvkjAverageCost : fromWarehouse.averageCost;
        return averageCost ? parseFloat(averageCost) : null;
      }
    }
    return purchasePrice;
  }, [watchMovementType, watchFromWarehouseId, warehouses, watchProductType, purchasePrice]);

  const purchaseAmount = useMemo(() => {
    return finalPurchasePrice && kgNum > 0 ? finalPurchasePrice * kgNum : 0;
  }, [finalPurchasePrice, kgNum]);

  // Get storage cost
  const storageCost = useMemo((): number => {
    if (!watchToWarehouseId || kgNum <= 0) return 0;

    const warehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!warehouse || !warehouse.storageCost) return 0;

    const storageCostPerTon = parseFloat(warehouse.storageCost);
    return (storageCostPerTon / 1000) * kgNum;
  }, [watchToWarehouseId, kgNum, warehouses]);

  // Get delivery cost
  const deliveryCost = useMemo((): number => {
    if (!watchToWarehouseId || !watchCarrierId || kgNum <= 0) return 0;

    const toWarehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!toWarehouse) return 0;

    let fromEntityType = "";
    let fromEntityId = "";

    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      if (!supplier) return 0;

      if (supplier.isWarehouse) {
        fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find((w) => w.supplierId === supplier.id);
        if (supplierWarehouse) fromEntityId = supplierWarehouse.id;
      } else {
        fromEntityType = DELIVERY_ENTITY_TYPE.BASE;
        if (supplier.baseIds && supplier.baseIds.length > 0) fromEntityId = supplier.baseIds[0];
      }
    } else if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return 0;

    const deliveryCostRecord = deliveryCosts.find(
      (dc) =>
        dc.carrierId === watchCarrierId &&
        dc.fromEntityType === fromEntityType &&
        dc.fromEntityId === fromEntityId &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.toEntityId === toWarehouse.id,
    );

    return deliveryCostRecord && deliveryCostRecord.costPerKg ? parseFloat(deliveryCostRecord.costPerKg) * kgNum : 0;
  }, [watchToWarehouseId, watchCarrierId, kgNum, watchMovementType, watchSupplierId, watchFromWarehouseId, warehouses, suppliers, deliveryCosts]);

  const { priceId } = parsePriceCompositeId(watchSelectedPurchasePriceId);

  const supplierContractVolumeStatus = useContractVolume({
    priceId: priceId || null,
    currentQuantityKg: kgNum,
    isEditing: isEditing,
    mode: "opt",
  });

  const totalCost = useMemo(() => purchaseAmount + storageCost + deliveryCost, [purchaseAmount, storageCost, deliveryCost]);
  const costPerKg = useMemo(() => (kgNum > 0 ? totalCost / kgNum : 0), [totalCost, kgNum]);

  const availablePrices = useMemo(() => {
    return availablePurchasePrices.flatMap(p => {
      try {
        const values = p.priceValues?.map((v: string) => JSON.parse(v)) || [];
        return values.map((v: any, idx: number) => ({ ...v, priceId: p.id, index: idx }));
      } catch {
        return [];
      }
    });
  }, [availablePurchasePrices]);

  return {
    calculatedKg,
    kgNum,
    availablePrices,
    purchasePrice: finalPurchasePrice,
    purchasePriceId,
    purchasePriceIndex,
    purchaseAmount,
    storageCost,
    deliveryCost,
    totalCost,
    costPerKg,
    supplierContractVolumeStatus,
  };
}
