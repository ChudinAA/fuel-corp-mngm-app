
import type { DeliveryCost } from "@shared/schema";

export function useDeliveryStats(deliveryCosts: DeliveryCost[] | undefined) {
  const averageCostPerKg = deliveryCosts && deliveryCosts.length > 0
    ? deliveryCosts.reduce((sum, cost) => sum + parseFloat(cost.costPerKg.toString()), 0) / deliveryCosts.length
    : 0;

  const activeCarriersCount = deliveryCosts
    ? new Set(deliveryCosts.map(cost => cost.carrierId)).size
    : 0;

  return {
    averageCostPerKg,
    activeCarriersCount,
  };
}
