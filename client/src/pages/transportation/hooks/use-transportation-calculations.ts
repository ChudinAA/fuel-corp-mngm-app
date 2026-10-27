import { useMemo } from "react";
import type { DeliveryCost, Price } from "@shared/schema";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";
import { usePriceExtraction } from "@/pages/shared/hooks/use-price-extraction";
import {
  calculateTransportationAmount,
  calculateTransportationMassTonnes,
  calculateTransportationPricePerTonne,
  transportationTonnesToLegacyKg,
  type TransportationInputMode,
  type TransportationPriceUnit,
} from "../unit-calculations";

interface UseTransportationCalculationsProps {
  inputMode: TransportationInputMode;
  quantityLiters: string;
  density: string;
  quantityTonnes: string;
  basisId: string;
  purchasePrices: Price[];
  salePrices: Price[];
  selectedPurchasePriceId: string;
  selectedSalePriceId: string;
  deliveryCosts: DeliveryCost[] | undefined;
  carrierId: string;
  deliveryLocationId: string;
  isAviaService: boolean;
  productType: string;
}

export function useTransportationCalculations({
  inputMode,
  quantityLiters,
  density,
  quantityTonnes,
  basisId,
  purchasePrices,
  salePrices,
  selectedPurchasePriceId,
  selectedSalePriceId,
  deliveryCosts,
  carrierId,
  deliveryLocationId,
  isAviaService,
  productType,
}: UseTransportationCalculationsProps) {
  const finalTonnes = calculateTransportationMassTonnes(
    inputMode,
    inputMode === "liters" ? quantityLiters : quantityTonnes,
    density,
  );
  const safeTonnes = finalTonnes ?? 0;
  const finalKg = transportationTonnesToLegacyKg(safeTonnes);
  const calculatedKg =
    finalTonnes !== null && finalTonnes > 0 ? String(finalKg) : "";

  const { salePrice: extractedSalePrice } =
    usePriceExtraction({
      purchasePrices,
      salePrices,
      selectedPurchasePriceId,
      selectedSalePriceId,
      isWarehouseSupplier: false,
      supplierWarehouse: undefined,
      productType,
    });

  const salePrice = extractedSalePrice;
  const selectedSalePrice = salePrices.find(
    (price) =>
      selectedSalePriceId === price.id ||
      selectedSalePriceId.startsWith(`${price.id}-`),
  );
  const salePriceUnitValue = selectedSalePrice?.priceUnit;
  const salePriceUnit: TransportationPriceUnit =
    salePriceUnitValue === "liter" || salePriceUnitValue === "tonne"
      ? salePriceUnitValue
      : "kg";
  const salePricePerTonne = calculateTransportationPricePerTonne(
    salePrice,
    salePriceUnit,
    density,
  );

  const matchedDeliveryCost = useMemo(() => {
    if (isAviaService) return null;
    if (!deliveryLocationId || !carrierId || !deliveryCosts) {
      return null;
    }

    const cost = deliveryCosts.find((dc) => {
      const matchesCarrier = dc.carrierId === carrierId;
      const matchesDestination =
        dc.toEntityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION &&
        dc.toEntityId === deliveryLocationId;
      const matchesSource =
        basisId &&
        dc.fromEntityType === DELIVERY_ENTITY_TYPE.BASE &&
        dc.fromEntityId === basisId;
      return matchesCarrier && matchesDestination && matchesSource && dc.isActive;
    });

    if (cost?.costPerKg) {
      return cost;
    }
    return null;
  }, [isAviaService, deliveryLocationId, carrierId, deliveryCosts, basisId]);

  const deliveryTariffPerTonne = matchedDeliveryCost
    ? calculateTransportationPricePerTonne(
        matchedDeliveryCost.costPerKg,
        "kg",
      )
    : null;
  const deliveryCost =
    deliveryTariffPerTonne !== null && finalTonnes !== null && finalTonnes > 0
      ? calculateTransportationAmount(deliveryTariffPerTonne, finalTonnes)
      : null;

  const deliveryTariff = useMemo(() => {
    if (deliveryCost === null || finalKg <= 0) return null;
    return deliveryCost / finalKg;
  }, [deliveryCost, finalKg]);

  const saleAmount = useMemo(() => {
    if (salePricePerTonne !== null && finalTonnes !== null && finalTonnes > 0) {
      return calculateTransportationAmount(salePricePerTonne, finalTonnes);
    }
    return null;
  }, [salePricePerTonne, finalTonnes]);

  const profit = useMemo(() => {
    if (isAviaService) {
      // АвиаСервис keeps the service amount as profit without external delivery cost.
      return saleAmount;
    } else {
      if (saleAmount !== null && deliveryCost !== null) {
        return saleAmount - deliveryCost;
      }
      return null;
    }
  }, [isAviaService, saleAmount, deliveryCost]);

  return {
    calculatedKg,
    finalKg,
    finalTonnes,
    salePrice,
    salePriceUnit,
    salePricePerTonne,
    deliveryCost,
    matchedDeliveryCost,
    deliveryTariff,
    deliveryTariffPerTonne,
    saleAmount,
    profit,
  };
}
