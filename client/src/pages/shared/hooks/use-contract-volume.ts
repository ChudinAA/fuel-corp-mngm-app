import { useQuery } from "@tanstack/react-query";
import type { Price } from "@shared/schema";
import { formatTonnes } from "@shared/units";

interface UseContractVolumeProps {
  priceId: string | null;
  currentQuantityKg: number;
  initialQuantityKg: number;
  mode: "opt" | "refueling" | "refueling-abroad";
  currentDealAmount?: number;
  initialDealAmount?: number;
  displayUnit?: "kg" | "tonnes" | "liters";
}

export function useContractVolume({
  priceId,
  currentQuantityKg,
  initialQuantityKg,
  mode,
  currentDealAmount = 0,
  initialDealAmount = 0,
  displayUnit = "kg",
}: UseContractVolumeProps) {
  const { data: price, isLoading: isLoadingPrice } = useQuery<Price>({
    queryKey: ["/api/prices", priceId],
    enabled: !!priceId,
  });

  const { data: usedData, isLoading: isLoadingUsed } = useQuery<{
    usedVolume: number;
  }>({
    queryKey: [`/api/${mode}/contract-used`, priceId],
    enabled: !!priceId && (price as any)?.limitType !== "amount",
  });

  const { data: usedAmountData, isLoading: isLoadingUsedAmount } = useQuery<{
    usedAmount: number;
  }>({
    queryKey: [`/api/${mode}/contract-used-amount`, priceId],
    enabled: !!priceId && (price as any)?.limitType === "amount",
  });

  const formatVolume = (value: number) => {
    if (displayUnit === "tonnes") {
      return `${formatTonnes(value / 1_000)} т`;
    }
    const formatted = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${formatted} ${displayUnit === "liters" ? "л" : "кг"}`;
  };

  if (!priceId) {
    return { remaining: 0, status: "ok" as const, message: "—" };
  }

  if (isLoadingPrice || isLoadingUsed || isLoadingUsedAmount) {
    return { remaining: 0, status: "ok" as const, message: "Загрузка..." };
  }

  if (!price || !price.priceValues) {
    return {
      remaining: 0,
      status: "error" as const,
      message: "Цена не найдена",
    };
  }

  // Если ограничения по договору отключены — показываем "Нет лимита"
  if ((price as any).contractLimitEnabled === false) {
    return { remaining: Infinity, status: "ok" as const, message: "Нет лимита" };
  }

  try {
    const limitType = (price as any).limitType || "volume";

    if (limitType === "amount") {
      const maxAmount = parseFloat((price as any).maxDealAmount || "0");

      if (maxAmount <= 0) {
        return { remaining: 0, status: "ok" as const, message: "Безлимит" };
      }

      const usedAmount = usedAmountData?.usedAmount || 0;
      const remaining = maxAmount - usedAmount + (initialDealAmount - currentDealAmount);

      if (remaining >= 0) {
        return {
          remaining,
          status: "ok" as const,
          message: `ОК: ${remaining.toFixed(2)} ₽`,
        };
      } else {
        return {
          remaining,
          status: "error" as const,
          message: `Превышен! Остаток: ${(maxAmount - usedAmount + initialDealAmount).toFixed(2)} ₽`,
        };
      }
    }

    const totalVolume = parseFloat(price.volume || "0");

    if (totalVolume <= 0) {
      return { remaining: 0, status: "ok" as const, message: "Безлимит" };
    }

    const usedVolume = usedData?.usedVolume || 0;

    const remaining =
      totalVolume - usedVolume + (initialQuantityKg - currentQuantityKg);

    if (remaining >= 0) {
      return {
        remaining,
        status: "ok" as const,
        message: `ОК: ${formatVolume(remaining)}`,
      };
    } else {
      return {
        remaining,
        status: "error" as const,
        message: `Превышен! Остаток: ${formatVolume(totalVolume - usedVolume + initialQuantityKg)}`,
      };
    }
  } catch (e) {
    return { remaining: 0, status: "error" as const, message: "Ошибка данных" };
  }
}
