import { useQuery } from "@tanstack/react-query";
import type { Price } from "@shared/schema";

interface UseContractVolumeProps {
  priceId: string | null;
  priceIndex: number | null;
  currentQuantityKg: number;
  isEditing: boolean;
  mode: "opt" | "refueling";
}

export function useContractVolume({
  priceId,
  priceIndex,
  currentQuantityKg,
  isEditing,
  mode,
}: UseContractVolumeProps) {
  const { data: price, isLoading: isLoadingPrice } = useQuery<Price>({
    queryKey: ["/api/prices", priceId],
    enabled: !!priceId,
  });

  const { data: usedData, isLoading: isLoadingUsed } = useQuery<{ usedVolume: number }>({
    queryKey: [`/api/${mode}/contract-used`, priceId],
    enabled: !!priceId,
  });

  if (!priceId || priceIndex === null) {
    return { remaining: 0, status: "ok" as const, message: "—" };
  }

  if (isLoadingPrice || isLoadingUsed) {
    return { remaining: 0, status: "ok" as const, message: "Загрузка..." };
  }

  if (!price || !price.priceValues) {
    return { remaining: 0, status: "error" as const, message: "Цена не найдена" };
  }

  try {
    const totalVolume = parseFloat(price.volume || "0");

    if (totalVolume <= 0) {
      return { remaining: 0, status: "ok" as const, message: "Безлимит" };
    }

    const usedVolume = usedData?.usedVolume || 0;
    
    // Remaining = Total - UsedVolume - (if NEW then currentQuantityKg)
    // When editing, usedVolume already contains the current deal volume in the DB.
    // So if isEditing, we just compare totalVolume vs usedVolume (which reflects saved state).
    // If the user is MANIPULATING the quantity field while editing, they expect real-time feedback.
    // We'd need the ORIGINAL quantity of this deal to properly show "Total - (UsedByOthers) - CurrentInput".
    
    const remaining = totalVolume - usedVolume - (isEditing ? 0 : currentQuantityKg);
    
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
        message: `Превышен! Остаток: ${(totalVolume - usedVolume + (isEditing ? currentQuantityKg : 0)).toFixed(2)} кг`,
      };
    }
  } catch (e) {
    return { remaining: 0, status: "error" as const, message: "Ошибка данных" };
  }
}
