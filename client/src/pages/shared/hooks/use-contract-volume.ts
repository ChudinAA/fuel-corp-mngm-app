
import { useQuery } from "@tanstack/react-query";
import type { Price, Opt } from "@shared/schema";

// Temporary type definition since it might be missing or differently named
type Refueling = any;

interface UseContractVolumeProps {
  priceId: string | null;
  priceIndex: number | null;
  currentQuantityKg: number;
  isEditing: boolean;
  dealId?: string;
}

export function useContractVolume({
  priceId,
  priceIndex,
  currentQuantityKg,
  isEditing,
  dealId,
}: UseContractVolumeProps) {
  const { data: allPrices } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: optDeals } = useQuery<Opt[]>({
    queryKey: ["/api/opt"],
    select: (data: any) => data.data || data,
  });

  const { data: refuelingDeals } = useQuery<Refueling[]>({
    queryKey: ["/api/refueling"],
    select: (data: any) => data.data || data,
  });

  if (!priceId || priceIndex === null || !allPrices) {
    return { remaining: 0, status: "ok" as const, message: "—" };
  }

  const price = allPrices.find((p) => p.id === priceId);
  if (!price || !price.priceValues) {
    return { remaining: 0, status: "error" as const, message: "Цена не найдена" };
  }

  try {
    const priceValueStr = price.priceValues[priceIndex];
    if (!priceValueStr) throw new Error("Price value not found");
    
    const parsed = JSON.parse(priceValueStr);
    const totalVolume = parseFloat(parsed.volume || "0");

    if (totalVolume <= 0) {
      return { remaining: 0, status: "ok" as const, message: "Безлимит" };
    }

    // Sum quantities from OPT deals
    const optSum = (optDeals || [])
      .filter((d) => 
        d.salePriceId === priceId && 
        d.salePriceIndex === priceIndex && 
        (!isEditing || d.id !== dealId) &&
        !d.deletedAt
      )
      .reduce((sum, d) => sum + parseFloat(d.quantityKg || "0"), 0);

    // Sum quantities from Refueling deals
    const refuelingSum = (refuelingDeals || [])
      .filter((d) => 
        d.salePriceId === priceId && 
        d.salePriceIndex === priceIndex && 
        (!isEditing || d.id !== dealId) &&
        !d.deletedAt
      )
      .reduce((sum, d) => sum + parseFloat(d.quantityKg || "0"), 0);

    const usedVolume = optSum + refuelingSum;
    const remaining = totalVolume - usedVolume - currentQuantityKg;

    if (remaining >= 0) {
      return {
        remaining,
        status: "ok" as const,
        message: `ОК: ${remaining.toFixed(2)} кг`,
      };
    } else {
      return {
        remaining,
        status: "error" as const,
        message: `Превышен! Остаток: ${(totalVolume - usedVolume).toFixed(2)} кг`,
      };
    }
  } catch (e) {
    return { remaining: 0, status: "error" as const, message: "Ошибка данных" };
  }
}
