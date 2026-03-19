import { useMemo } from "react";
import type {
  Base,
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  DeliveryCost,
  Price,
} from "@shared/schema";
import {
  COUNTERPARTY_TYPE,
  COUNTERPARTY_ROLE,
  PRODUCT_TYPE,
} from "@shared/constants";
import { usePriceLookup } from "@/pages/shared/hooks/use-price-lookup";
import { AVIA_SERVICE_CARRIER_NAME } from "../constants";

interface UseTransportationFiltersProps {
  supplierId: string;
  buyerId: string;
  dealDate: Date | null;
  basisId: string;
  customerBasisId: string;
  carrierId: string;
  productType: string;
  allBases: Base[] | undefined;
  carriers: LogisticsCarrier[] | undefined;
  deliveryLocations: LogisticsDeliveryLocation[] | undefined;
  deliveryCosts: DeliveryCost[] | undefined;
}

export function useTransportationFilters({
  supplierId,
  buyerId,
  dealDate,
  basisId,
  customerBasisId,
  carrierId,
  productType,
  allBases,
  carriers,
  deliveryLocations,
  deliveryCosts,
}: UseTransportationFiltersProps) {
  const aviaServiceCarrier = useMemo(
    () => carriers?.find((c) => c.name === AVIA_SERVICE_CARRIER_NAME),
    [carriers],
  );

  const isAviaService = useMemo(
    () => !!carrierId && carrierId === aviaServiceCarrier?.id,
    [carrierId, aviaServiceCarrier],
  );

  const purchaseLookup = usePriceLookup({
    counterpartyId: supplierId,
    counterpartyRole: COUNTERPARTY_ROLE.SUPPLIER,
    counterpartyType: COUNTERPARTY_TYPE.TRANSPORTATION,
    basisId: customerBasisId,
    loadingBasisId: basisId,
    productType: productType || PRODUCT_TYPE.KEROSENE,
    date: dealDate || undefined,
    enabled: !!supplierId && !!basisId && !!customerBasisId && !!dealDate && isAviaService,
  });

  const saleLookup = usePriceLookup({
    counterpartyId: buyerId,
    counterpartyRole: COUNTERPARTY_ROLE.BUYER,
    counterpartyType: COUNTERPARTY_TYPE.TRANSPORTATION,
    basisId: customerBasisId,
    loadingBasisId: basisId,
    productType: productType || PRODUCT_TYPE.KEROSENE,
    date: dealDate || undefined,
    enabled: !!buyerId && !!customerBasisId && !!dealDate,
  });

  const purchasePrices = useMemo(
    () => purchaseLookup.data || [],
    [purchaseLookup.data],
  );

  const salePrices = useMemo(
    () => saleLookup.data || [],
    [saleLookup.data],
  );

  const allBasesSorted = useMemo(
    () => allBases || [],
    [allBases],
  );

  return {
    purchasePrices,
    salePrices,
    allBases: allBasesSorted,
    aviaServiceCarrier,
    isAviaService,
    carriers: carriers || [],
    deliveryLocations: deliveryLocations || [],
  };
}
