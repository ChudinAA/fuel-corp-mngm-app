
import type { DeliveryCost } from "@shared/schema";
import { pricePerKilogramToPerTonne } from "@shared/units";

export function useDeliveryStats(deliveryCosts: DeliveryCost[] | undefined) {
  const averageCostPerTonne = deliveryCosts && deliveryCosts.length > 0
    ? deliveryCosts.reduce(
        (sum, cost) =>
          sum + pricePerKilogramToPerTonne(Number(cost.costPerKg)),
        0,
      ) / deliveryCosts.length
    : 0;

  const activeCarriersCount = deliveryCosts
    ? new Set(deliveryCosts.map(cost => cost.carrierId)).size
    : 0;

  return {
    averageCostPerTonne,
    activeCarriersCount,
  };
}
