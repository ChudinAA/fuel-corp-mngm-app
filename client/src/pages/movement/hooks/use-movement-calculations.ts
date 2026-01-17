import { useMemo } from "react";
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
}: UseMovementCalculationsProps) {
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

  // Get purchase price and price ID
  const { purchasePrice, priceId, availablePrices } = useMemo((): {
    purchasePrice: number | null;
    priceId: string | null;
    availablePrices: any[];
  } => {
    const watchPurchasePriceId = (watchMovementType === MOVEMENT_TYPE.SUPPLY) ? (form?.watch ? form.watch("purchasePriceId") : null) : null;
    const watchPurchasePriceIndex = (watchMovementType === MOVEMENT_TYPE.SUPPLY) ? (form?.watch ? form.watch("purchasePriceIndex") : 0) : 0;

    // For internal movement, use average cost from source warehouse
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find(
        (w) => w.id === watchFromWarehouseId,
      );
      if (fromWarehouse) {
        const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
        const averageCost = isPvkj
          ? fromWarehouse.pvkjAverageCost
          : fromWarehouse.averageCost;
        if (averageCost) {
          return { purchasePrice: parseFloat(averageCost), priceId: null, availablePrices: [] };
        }
      }
      return { purchasePrice: null, priceId: null, availablePrices: [] };
    }

    if (!watchSupplierId || !watchMovementDate)
      return { purchasePrice: null, priceId: null, availablePrices: [] };

    const dateStr = format(watchMovementDate, "yyyy-MM-dd'T'HH:mm:ss");
    const supplier = suppliers.find((s) => s.id === watchSupplierId);
    if (!supplier) return { purchasePrice: null, priceId: null, availablePrices: [] };

    // Determine product type for price lookup
    let priceProductType: ProductType = PRODUCT_TYPE.KEROSENE;
    if (watchProductType === PRODUCT_TYPE.PVKJ) {
      priceProductType = PRODUCT_TYPE.PVKJ;
    }

    // Use selected basis or fallback to first supplier's basis
    let baseName = watchBasis;
    if (!baseName && supplier.baseIds && supplier.baseIds.length > 0) {
      const firstBase = allBases?.find((b) => b.id === supplier.baseIds[0]);
      if (firstBase) {
        baseName = firstBase.name;
      }
    }

    if (!baseName) return { purchasePrice: null, priceId: null, availablePrices: [] };

    // Find price in price table
    const matchingPrice = prices.find(
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

    if (
      matchingPrice &&
      matchingPrice.priceValues &&
      matchingPrice.priceValues.length > 0
    ) {
      try {
        const priceValues = matchingPrice.priceValues.map((v: string) => JSON.parse(v));
        
        // If we have a selected priceId and index, use it
        if (watchPurchasePriceId === matchingPrice.id) {
          const selectedPrice = priceValues[watchPurchasePriceIndex || 0];
          return {
            purchasePrice: parseFloat(selectedPrice.price || "0"),
            priceId: matchingPrice.id,
            availablePrices: priceValues
          };
        }

        const priceObj = priceValues[0];
        return {
          purchasePrice: parseFloat(priceObj.price || "0"),
          priceId: matchingPrice.id,
          availablePrices: priceValues
        };
      } catch {
        return { purchasePrice: null, priceId: null, availablePrices: [] };
      }
    }

    return { purchasePrice: null, priceId: null, availablePrices: [] };
  }, [
    watchMovementType,
    watchProductType,
    watchSupplierId,
    watchBasis,
    watchFromWarehouseId,
    watchMovementDate,
    warehouses,
    suppliers,
    prices,
    allBases,
    form
  ]);

  const purchaseAmount = useMemo(() => {
    return purchasePrice && kgNum > 0 ? purchasePrice * kgNum : 0;
  }, [purchasePrice, kgNum]);

  // Get storage cost
  const storageCost = useMemo((): number => {
    if (!watchToWarehouseId || kgNum <= 0) return 0;

    const warehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!warehouse || !warehouse.storageCost) return 0;

    const storageCostPerTon = parseFloat(warehouse.storageCost);
    // Divide by 1000 since storage cost is per ton
    return (storageCostPerTon / 1000) * kgNum;
  }, [watchToWarehouseId, kgNum, warehouses]);

  // Get delivery cost
  const deliveryCost = useMemo((): number => {
    if (!watchToWarehouseId || !watchCarrierId || kgNum <= 0) return 0;

    const toWarehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!toWarehouse) return 0;

    let fromEntityType = "";
    let fromEntityId = "";

    // For supply - get from supplier
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      if (!supplier) return 0;

      // If supplier has warehouse, use it
      if (supplier.isWarehouse) {
        fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find(
          (w) => w.supplierId === supplier.id,
        );
        if (supplierWarehouse) {
          fromEntityId = supplierWarehouse.id;
        }
      } else {
        // Use basis (first one)
        fromEntityType = DELIVERY_ENTITY_TYPE.BASE;
        if (supplier.baseIds && supplier.baseIds.length > 0) {
          fromEntityId = supplier.baseIds[0];
        }
      }
    }
    // For internal movement - get from source warehouse
    else if (
      watchMovementType === MOVEMENT_TYPE.INTERNAL &&
      watchFromWarehouseId
    ) {
      fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return 0;

    // Find delivery tariff
    const deliveryCostRecord = deliveryCosts.find(
      (dc) =>
        dc.carrierId === watchCarrierId &&
        dc.fromEntityType === fromEntityType &&
        dc.fromEntityId === fromEntityId &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.toEntityId === toWarehouse.id,
    );

    if (deliveryCostRecord && deliveryCostRecord.costPerKg) {
      return parseFloat(deliveryCostRecord.costPerKg) * kgNum;
    }

    return 0;
  }, [
    watchToWarehouseId,
    watchCarrierId,
    kgNum,
    watchMovementType,
    watchSupplierId,
    watchFromWarehouseId,
    warehouses,
    suppliers,
    deliveryCosts,
  ]);

  // Логика проверки объема по договору поставщика
  const supplierContractVolumeStatus = useContractVolume({
    priceId: priceId,
    currentQuantityKg: kgNum,
    isEditing: isEditing,
    mode: "opt",
  });

  // Calculate totals
  const totalCost = useMemo(() => {
    return purchaseAmount + storageCost + deliveryCost;
  }, [purchaseAmount, storageCost, deliveryCost]);

  const costPerKg = useMemo(() => {
    return kgNum > 0 ? totalCost / kgNum : 0;
  }, [totalCost, kgNum]);

  return {
    calculatedKg,
    kgNum,
    availablePrices,
    purchasePrice,
    priceId,
    purchaseAmount,
    storageCost,
    deliveryCost,
    totalCost,
    costPerKg,
    supplierContractVolumeStatus,
  };
}
