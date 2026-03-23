import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { Price } from "@shared/schema";

interface PriceLookupParams {
  counterpartyId: string;
  counterpartyRole: string;
  counterpartyType: string;
  basisId?: string | null;
  loadingBasisId?: string | null;
  productType?: string;
  date: Date | null;
  enabled?: boolean;
  priceUnit?: "kg" | "liter";
}

export function usePriceLookup({
  counterpartyId,
  counterpartyRole,
  counterpartyType,
  basisId,
  loadingBasisId,
  productType,
  date,
  enabled = true,
  priceUnit,
}: PriceLookupParams) {
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  return useQuery<Price[]>({
    queryKey: [
      "/api/prices/find-active",
      counterpartyId,
      counterpartyRole,
      counterpartyType,
      basisId,
      loadingBasisId,
      productType,
      dateStr,
      priceUnit,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("counterpartyId", counterpartyId);
      params.append("counterpartyRole", counterpartyRole);
      params.append("counterpartyType", counterpartyType);
      params.append("date", dateStr);
      if (basisId) params.append("basisId", basisId);
      if (loadingBasisId) params.append("loadingBasisId", loadingBasisId);
      if (productType) params.append("productType", productType);
      if (priceUnit) params.append("priceUnit", priceUnit);

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
