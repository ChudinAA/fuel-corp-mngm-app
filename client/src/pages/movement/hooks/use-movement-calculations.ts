import { useWarehouseBalance } from "@/hooks/use-warehouse-balance";
import { useEffect, useMemo } from "react";
import {
  MOVEMENT_TYPE,
  PRODUCT_TYPE,
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  DELIVERY_ENTITY_TYPE,
  ProductType,
} from "@shared/constants";
import type { AllSupplier } from "../types";
import { useContractVolume } from "@/pages/shared/hooks/use-contract-volume";
import type { UseFormReturn } from "react-hook-form";
import type { MovementFormData } from "../schemas";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";
import { parsePriceCompositeId } from "@/pages/shared/utils/price-utils";
import { usePriceLookup } from "@/pages/shared/hooks/use-price-lookup";
import {
  pricePerKilogramToPerTonne,
} from "@shared/units";
import {
  calculateMovementMassTonnes,
  calculateMovementPricePerTonne,
  movementTonnesRateToLegacyKgRate,
  movementTonnesToLegacyKg,
  type MovementPriceUnit,
} from "../unit-calculations";

interface UseMovementCalculationsProps {
  form?: UseFormReturn<MovementFormData>;
  watchMovementType: string;
  watchProductType: string;
  nomenclatureId?: string;
  watchSupplierId: string;
  watchBasisId?: string;
  watchFromWarehouseId: string;
  watchToWarehouseId: string;
  watchCarrierId: string;
  watchMovementDate: Date;
  watchLiters: string | undefined;
  watchDensity: string | undefined;
  watchTonnes: string | undefined;
  inputMode: "liters" | "tonnes";
  warehouses: any[];
  suppliers: AllSupplier[];
  deliveryCosts: any[];
  selectedPurchasePriceId: string;
  setSelectedPurchasePriceId: (id: string) => void;
  initialQuantityTonnes: number;
  initialPurchaseAmount?: number;
}

export type VatAdjustment =
  | { type: "deduct"; description: string; rawTotal: number; adjustedTotal: number }
  | { type: "add"; description: string; rawTotal: number; adjustedTotal: number }
  | null;

export function useMovementCalculations({
  form,
  watchMovementType,
  watchProductType,
  nomenclatureId,
  watchSupplierId,
  watchBasisId,
  watchFromWarehouseId,
  watchToWarehouseId,
  watchCarrierId,
  watchMovementDate,
  watchLiters,
  watchDensity,
  watchTonnes,
  inputMode,
  warehouses,
  suppliers,
  deliveryCosts,
  selectedPurchasePriceId,
  setSelectedPurchasePriceId,
  initialQuantityTonnes,
  initialPurchaseAmount = 0,
}: UseMovementCalculationsProps) {
  const watchSelectedPurchasePriceId =
    selectedPurchasePriceId || form?.watch("selectedPurchasePriceId") || "";

  const calculatedTonnes = useMemo(
    () =>
      calculateMovementMassTonnes(
        inputMode,
        watchTonnes,
        watchLiters,
        watchDensity,
      ),
    [inputMode, watchTonnes, watchLiters, watchDensity],
  );
  const tonnesNum = calculatedTonnes ?? 0;
  const kgNum = movementTonnesToLegacyKg(tonnesNum);
  const calculatedKg = kgNum;
  
  // Find matching prices for supplier
  const purchaseLookup = usePriceLookup({
    counterpartyId: watchSupplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: COUNTERPARTY_TYPE.WHOLESALE,
    basisId: watchBasisId,
    productType: watchProductType,
    nomenclatureId,
    date: watchMovementDate,
    enabled: !!watchSupplierId && !!watchBasisId && !!watchMovementDate,
    priceUnit: inputMode === "liters" ? "liter" : "tonne",
  });

  const availablePurchasePrices = useMemo(() => {
    return purchaseLookup.data || [];
  }, [purchaseLookup.data]);

  // Extract actual price value using shared hook
  const { purchasePrice: rawPurchasePrice } =
    usePriceExtraction({
      purchasePrices: availablePurchasePrices,
      salePrices: [],
      selectedPurchasePriceId: watchSelectedPurchasePriceId,
      selectedSalePriceId: "",
      isWarehouseSupplier: false,
      supplierWarehouse: undefined,
    });
  const { priceId, priceIndex } = parsePriceCompositeId(
    watchSelectedPurchasePriceId,
  );
  const selectedPriceRecord = availablePurchasePrices.find(
    (price) => price.id === priceId,
  );
  const purchasePriceUnit: MovementPriceUnit =
    selectedPriceRecord?.priceUnit === "liter" ||
    selectedPriceRecord?.priceUnit === "tonne"
      ? selectedPriceRecord.priceUnit
      : "kg";
  const selectedPurchasePricePerTonne = calculateMovementPricePerTonne(
    rawPurchasePrice,
    purchasePriceUnit,
    watchDensity,
  );

  // Автоматическая установка выбранной цены, если она не установлена
  useEffect(() => {
    if (
      form &&
      watchMovementType === MOVEMENT_TYPE.SUPPLY &&
      !selectedPurchasePriceId &&
      availablePurchasePrices.length > 0
    ) {
      const firstPrice = availablePurchasePrices[0];
      const priceValues = firstPrice.priceValues || [];
      if (priceValues.length > 0) {
        const compositeId = `${firstPrice.id}-0`;
        setSelectedPurchasePriceId(compositeId);
        form.setValue("selectedPurchasePriceId", compositeId);
      }
    }
  }, [
    watchMovementType,
    watchSupplierId,
    watchProductType,
    watchMovementDate,
    availablePurchasePrices.length,
  ]);

  const { data: fromWarehouseData, isLoading: isFromWarehouseLoading } = useWarehouseBalance(
    (watchMovementType === MOVEMENT_TYPE.INTERNAL) ? watchFromWarehouseId : undefined,
    watchMovementDate,
    watchProductType
  );

  const warehousePriceAtDate = useMemo(() => {
    if (isFromWarehouseLoading) return null;
    return fromWarehouseData && typeof fromWarehouseData === 'object' && 'averageCost' in fromWarehouseData 
      ? (fromWarehouseData.averageCost ? parseFloat(fromWarehouseData.averageCost) : null) 
      : null;
  }, [fromWarehouseData, isFromWarehouseLoading]);

  const finalPurchasePricePerTonne = useMemo(() => {
    if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      if (warehousePriceAtDate !== null) {
        return pricePerKilogramToPerTonne(warehousePriceAtDate);
      }
      
      const fromWarehouse = warehouses.find(
        (w) => w.id === watchFromWarehouseId,
      );
      if (fromWarehouse) {
        const isPvkj = watchProductType === PRODUCT_TYPE.PVKJ;
        const averageCost = isPvkj
          ? fromWarehouse.pvkjAverageCost
          : fromWarehouse.averageCost;
        return averageCost
          ? pricePerKilogramToPerTonne(parseFloat(averageCost))
          : null;
      }
    }
    return selectedPurchasePricePerTonne;
  }, [
    watchMovementType,
    watchFromWarehouseId,
    warehouses,
    watchProductType,
    selectedPurchasePricePerTonne,
    warehousePriceAtDate
  ]);

  const purchaseAmount = useMemo(() => {
    return finalPurchasePricePerTonne && tonnesNum > 0
      ? finalPurchasePricePerTonne * tonnesNum
      : 0;
  }, [finalPurchasePricePerTonne, tonnesNum]);

  // Get storage cost
  const storageCost = useMemo((): number => {
    if (!watchToWarehouseId || tonnesNum <= 0) return 0;

    const warehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!warehouse || !warehouse.storageCost) return 0;

    const storageCostPerTon = parseFloat(warehouse.storageCost);
    return storageCostPerTon * tonnesNum;
  }, [watchToWarehouseId, tonnesNum, warehouses]);

  // Get warehouse services cost
  const warehouseServicesCost = useMemo((): number => {
    if (!watchToWarehouseId || tonnesNum <= 0) return 0;

    const warehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!warehouse || !warehouse.services || warehouse.services.length === 0) return 0;

    let total = 0;
    for (const service of warehouse.services) {
      const value = parseFloat(service.serviceValue || "0");
      if (isNaN(value) || value <= 0) continue;

      if (service.serviceType === "royalty_per_ton") {
        total += value * tonnesNum;
      } else if (service.serviceType === "percent_of_amount") {
        total += purchaseAmount * (value / 100);
      } else if (service.serviceType === "fixed") {
        total += value;
      }
    }
    return total;
  }, [watchToWarehouseId, tonnesNum, warehouses, purchaseAmount]);

  // Get delivery cost
  const matchedDeliveryCost = useMemo(() => {
    if (!watchToWarehouseId || !watchCarrierId) return null;

    const toWarehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    if (!toWarehouse) return null;

    let fromEntityType = "";
    let fromEntityId = "";

    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find((s) => s.id === watchSupplierId);
      if (!supplier) return null;

      if (supplier.isWarehouse) {
        fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find(
          (w) => w.supplierId === supplier.id,
        );
        if (supplierWarehouse) fromEntityId = supplierWarehouse.id;
      } else {
        fromEntityType = DELIVERY_ENTITY_TYPE.BASE;
        // Используем выбранный в форме базис, иначе — первый из базисов поставщика
        if (watchBasisId) {
          fromEntityId = watchBasisId;
        } else if (supplier.baseIds && supplier.baseIds.length > 0) {
          fromEntityId = supplier.baseIds[0];
        }
      }
    } else if (
      watchMovementType === MOVEMENT_TYPE.INTERNAL &&
      watchFromWarehouseId
    ) {
      fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return null;

    // Primary lookup: use fromEntityType/fromEntityId as determined above
    const deliveryCostRecord = deliveryCosts.find(
      (dc) =>
        dc.carrierId === watchCarrierId &&
        dc.fromEntityType === fromEntityType &&
        dc.fromEntityId === fromEntityId &&
        dc.toEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
        dc.toEntityId === toWarehouse.id,
    );

    if (deliveryCostRecord && deliveryCostRecord.costPerTonne) {
      return deliveryCostRecord;
    }

    // Fallback for internal movement: if a basis (watchBasisId) is specified,
    // also try to find a BASIS→WAREHOUSE tariff
    if (
      watchMovementType === MOVEMENT_TYPE.INTERNAL &&
      watchBasisId &&
      fromEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE
    ) {
      const basisRecord = deliveryCosts.find(
        (dc) =>
          dc.carrierId === watchCarrierId &&
          dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
          dc.fromEntityId === watchBasisId &&
          dc.toEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
          dc.toEntityId === toWarehouse.id,
      );
      if (basisRecord && basisRecord.costPerTonne) {
        return basisRecord;
      }
    }

    return null;
  }, [
    watchToWarehouseId,
    watchCarrierId,
    watchMovementType,
    watchSupplierId,
    watchBasisId,
    watchFromWarehouseId,
    warehouses,
    suppliers,
    deliveryCosts,
  ]);
  const deliveryCost =
    matchedDeliveryCost && tonnesNum > 0
      ? Number.parseFloat(String(matchedDeliveryCost.costPerTonne)) * tonnesNum
      : 0;

  const purchasePriceId = priceId;
  const purchasePriceIndex = priceIndex;

  const supplierContractVolumeStatus = useContractVolume({
    priceId: priceId || null,
    currentQuantityTonnes: tonnesNum,
    initialQuantityTonnes,
    mode: "opt",
    currentDealAmount: purchaseAmount,
    initialDealAmount: initialPurchaseAmount,
  });

  // VAT adjustment logic:
  // - INTERNAL: non-export→export → deduct 20%; export→non-export → add 20%
  // - SUPPLY: destination is export warehouse → deduct 20%
  const vatAdjustment = useMemo((): VatAdjustment => {
    const rawTotal = purchaseAmount + storageCost + deliveryCost + warehouseServicesCost;

    if (watchMovementType === MOVEMENT_TYPE.SUPPLY) {
      if (!watchToWarehouseId) return null;
      const toWarehouse = warehouses.find((w) => w.id === watchToWarehouseId);
      if (!toWarehouse || !toWarehouse.isExport) return null;
      return {
        type: "deduct",
        description: "Покупка на экспортный склад — НДС 20% будет вычтен из себестоимости",
        rawTotal,
        adjustedTotal: rawTotal / 1.2,
      };
    }

    if (watchMovementType === MOVEMENT_TYPE.INTERNAL) {
      if (!watchFromWarehouseId || !watchToWarehouseId) return null;
      const fromWarehouse = warehouses.find((w) => w.id === watchFromWarehouseId);
      const toWarehouse = warehouses.find((w) => w.id === watchToWarehouseId);
      if (!fromWarehouse || !toWarehouse) return null;

      const fromIsExport = fromWarehouse.isExport ?? false;
      const toIsExport = toWarehouse.isExport ?? false;
      if (fromIsExport === toIsExport) return null;

      if (!fromIsExport && toIsExport) {
        return {
          type: "deduct",
          description: "Перемещение на экспортный склад — НДС 20% будет вычтен из себестоимости",
          rawTotal,
          adjustedTotal: rawTotal / 1.2,
        };
      } else {
        return {
          type: "add",
          description: "Перемещение с экспортного склада — НДС 20% будет добавлен к себестоимости",
          rawTotal,
          adjustedTotal: rawTotal * 1.2,
        };
      }
    }

    return null;
  }, [
    watchMovementType,
    watchFromWarehouseId,
    watchToWarehouseId,
    warehouses,
    purchaseAmount,
    storageCost,
    deliveryCost,
    warehouseServicesCost,
  ]);

  const rawTotalCost = useMemo(
    () => purchaseAmount + storageCost + deliveryCost + warehouseServicesCost,
    [purchaseAmount, storageCost, deliveryCost, warehouseServicesCost],
  );

  const totalCost = useMemo(() => {
    if (vatAdjustment) return vatAdjustment.adjustedTotal;
    return rawTotalCost;
  }, [rawTotalCost, vatAdjustment]);

  const costPerTonne = useMemo(
    () => (tonnesNum > 0 ? totalCost / tonnesNum : 0),
    [totalCost, tonnesNum],
  );
  const costPerKg = movementTonnesRateToLegacyKgRate(costPerTonne);
  const purchasePricePerKg =
    finalPurchasePricePerTonne === null
      ? null
      : movementTonnesRateToLegacyKgRate(finalPurchasePricePerTonne);

  const availablePrices = useMemo(() => {
    return availablePurchasePrices.flatMap((p) => {
      try {
        const values = p.priceValues?.map((v: string) => JSON.parse(v)) || [];
        return values.map((v: any, idx: number) => ({
          ...v,
          priceUnit: v.priceUnit || p.priceUnit || "kg",
          priceId: p.id,
          contractNumber: p.contractNumber,
          index: idx,
        }));
      } catch {
        return [];
      }
    });
  }, [availablePurchasePrices]);

  const destinationWarehouseServices = useMemo(() => {
    if (!watchToWarehouseId) return [];
    const warehouse = warehouses.find((w) => w.id === watchToWarehouseId);
    return warehouse?.services || [];
  }, [watchToWarehouseId, warehouses]);

  return {
    calculatedKg,
    calculatedTonnes,
    tonnesNum,
    kgNum,
    availablePrices,
    purchasePrice: finalPurchasePricePerTonne,
    purchasePricePerKg,
    purchasePriceId,
    purchasePriceIndex,
    purchaseAmount,
    storageCost,
    warehouseServicesCost,
    destinationWarehouseServices,
    deliveryCost,
    matchedDeliveryCost,
    totalCost,
    rawTotalCost,
    costPerKg,
    costPerTonne,
    supplierContractVolumeStatus,
    vatAdjustment,
  };
}
