
import { useMemo } from "react";
import { MOVEMENT_TYPE, DELIVERY_ENTITY_TYPE } from "@shared/constants";
import type { AllSupplier } from "../types";

interface UseAvailableCarriersProps {
  watchMovementType: string;
  watchSupplierId: string;
  watchFromWarehouseId: string;
  watchToWarehouseId: string;
  warehouses: any[];
  suppliers: AllSupplier[];
  carriers: any[];
  deliveryCosts: any[];
}

export function useAvailableCarriers({
  watchMovementType,
  watchSupplierId,
  watchFromWarehouseId,
  watchToWarehouseId,
  warehouses,
  suppliers,
  carriers,
  deliveryCosts,
}: UseAvailableCarriersProps) {
  
  return useMemo(() => {
    if (!watchToWarehouseId) return carriers || [];

    const toWarehouse = warehouses.find(w => w.id === watchToWarehouseId);
    if (!toWarehouse) return carriers || [];

    const fromEntities: { type: string; id: string }[] = [];
    const toEntities: { type: string; id: string }[] = [
      { type: DELIVERY_ENTITY_TYPE.WAREHOUSE, id: toWarehouse.id }
    ];

    // Add bases for toWarehouse
    if (toWarehouse.baseIds && toWarehouse.baseIds.length > 0) {
      toWarehouse.baseIds.forEach((baseId: string) => {
        toEntities.push({ type: DELIVERY_ENTITY_TYPE.BASE, id: baseId });
      });
    }

    // For supply - get from supplier
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (!supplier) return carriers || [];

      // If supplier has warehouse, use it
      if (supplier.isWarehouse) {
        const supplierWarehouse = warehouses.find(w => w.supplierId === supplier.id);
        if (supplierWarehouse) {
          fromEntities.push({ type: DELIVERY_ENTITY_TYPE.WAREHOUSE, id: supplierWarehouse.id });
          // Add bases for supplier warehouse
          if (supplierWarehouse.baseIds && supplierWarehouse.baseIds.length > 0) {
            supplierWarehouse.baseIds.forEach((baseId: string) => {
              fromEntities.push({ type: DELIVERY_ENTITY_TYPE.BASE, id: baseId });
            });
          }
        }
      } else {
        // Use bases from supplier
        if (supplier.baseIds && supplier.baseIds.length > 0) {
          supplier.baseIds.forEach((baseId: string) => {
            fromEntities.push({ type: DELIVERY_ENTITY_TYPE.BASE, id: baseId });
          });
        }
      }
    }
    // For internal movement - get from source warehouse
    else if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      const fromWarehouse = warehouses.find(w => w.id === watchFromWarehouseId);
      if (fromWarehouse) {
        fromEntities.push({ type: DELIVERY_ENTITY_TYPE.WAREHOUSE, id: fromWarehouse.id });
        // Add bases for source warehouse
        if (fromWarehouse.baseIds && fromWarehouse.baseIds.length > 0) {
          fromWarehouse.baseIds.forEach((baseId: string) => {
            fromEntities.push({ type: DELIVERY_ENTITY_TYPE.BASE, id: baseId });
          });
        }
      }
    }

    if (fromEntities.length === 0) return carriers || [];

    // Filter carriers that have tariff for this route (any combination of from/to entities)
    const availableCarrierIds = new Set(
      deliveryCosts
        .filter(dc =>
          fromEntities.some(fe => dc.fromEntityType === fe.type && dc.fromEntityId === fe.id) &&
          toEntities.some(te => dc.toEntityType === te.type && dc.toEntityId === te.id)
        )
        .map(dc => dc.carrierId)
    );

    return carriers?.filter(c => availableCarrierIds.has(c.id)) || [];
  }, [watchMovementType, watchSupplierId, watchFromWarehouseId, watchToWarehouseId, warehouses, suppliers, carriers, deliveryCosts]);
}
