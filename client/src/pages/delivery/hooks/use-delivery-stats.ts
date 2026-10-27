
import type { DeliveryCostApiRecord } from "../types";

export function useDeliveryStats(
  deliveryCosts: DeliveryCostApiRecord[] | undefined,
) {
  const averageCostPerTonne = deliveryCosts && deliveryCosts.length > 0
    ? deliveryCosts.reduce(
        (sum, cost) =>
          sum + Number(cost.costPerTonne),
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
