
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

    let fromEntityType = "";
    let fromEntityId = "";

    // For supply - get from supplier
    if (watchMovementType === MOVEMENT_TYPE.SUPPLY && watchSupplierId) {
      const supplier = suppliers.find(s => s.id === watchSupplierId);
      if (!supplier) return carriers || [];

      // If supplier has warehouse, use it
      if (supplier.isWarehouse) {
        fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
        const supplierWarehouse = warehouses.find(w => w.supplierId === supplier.id);
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
    else if (watchMovementType === MOVEMENT_TYPE.INTERNAL && watchFromWarehouseId) {
      fromEntityType = DELIVERY_ENTITY_TYPE.WAREHOUSE;
      fromEntityId = watchFromWarehouseId;
    }

    if (!fromEntityId) return carriers || [];

    // Filter carriers that have tariff for this route
    const availableCarrierIds = new Set(
      deliveryCosts
        .filter(dc =>
          dc.fromEntityType === fromEntityType &&
          dc.fromEntityId === fromEntityId &&
          dc.toEntityType === DELIVERY_ENTITY_TYPE.WAREHOUSE &&
          dc.toEntityId === toWarehouse.id
        )
        .map(dc => dc.carrierId)
    );

    return carriers?.filter(c => availableCarrierIds.has(c.id)) || [];
  }, [watchMovementType, watchSupplierId, watchFromWarehouseId, watchToWarehouseId, warehouses, suppliers, carriers, deliveryCosts]);
}
