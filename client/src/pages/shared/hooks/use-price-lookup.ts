import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Price } from "@shared/schema";

interface PriceLookupParams {
  counterpartyId: string;
  counterpartyRole: string;
  counterpartyType: string;
  basisId?: string | null;
  productType?: string;
  date: Date | null;
  enabled?: boolean;
}

export function usePriceLookup({
  counterpartyId,
  counterpartyRole,
  counterpartyType,
  basisId,
  productType,
  date,
  enabled = true,
}: PriceLookupParams) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<Price[]>({
    queryKey: [
      "/api/prices/find-active",
      counterpartyId,
      counterpartyRole,
      counterpartyType,
      basisId,
      productType,
      dateStr,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("counterpartyId", counterpartyId);
      params.append("counterpartyRole", counterpartyRole);
      params.append("counterpartyType", counterpartyType);
      params.append("date", dateStr);
      if (basisId) params.append("basisId", basisId);
      if (productType) params.append("productType", productType);

      const res = await fetch(`/api/prices/find-active?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch prices");
      return res.json();
    },
    enabled:
      enabled &&
      !!counterpartyId &&
      !!counterpartyRole &&
      !!counterpartyType &&
      !!dateStr,
  });
}
