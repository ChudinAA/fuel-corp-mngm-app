import { useQuery } from "@tanstack/react-query";
import type { Price } from "@shared/schema";
import { formatTonnes, kilogramsToTonnes } from "@shared/units";

interface UseContractVolumeProps {
  priceId: string | null;
  currentQuantityTonnes: number;
  initialQuantityTonnes: number;
  mode: "opt" | "refueling" | "refueling-abroad";
  currentDealAmount?: number;
  initialDealAmount?: number;
}

export function calculateRemainingContractTonnes({
  totalVolumeKilograms,
  usedVolumeTonnes,
  initialQuantityTonnes,
  currentQuantityTonnes,
}: {
  totalVolumeKilograms: number;
  usedVolumeTonnes: number;
  initialQuantityTonnes: number;
  currentQuantityTonnes: number;
}): number {
  return (
    kilogramsToTonnes(totalVolumeKilograms) -
    usedVolumeTonnes +
    initialQuantityTonnes -
    currentQuantityTonnes
  );
}

export function useContractVolume({
  priceId,
  currentQuantityTonnes,
  initialQuantityTonnes,
  mode,
  currentDealAmount = 0,
  initialDealAmount = 0,
}: UseContractVolumeProps) {
  const { data: price, isLoading: isLoadingPrice } = useQuery<Price>({
    queryKey: ["/api/prices", priceId],
    enabled: !!priceId,
  });

  const { data: usedData, isLoading: isLoadingUsed } = useQuery<{
    usedVolumeTonnes?: number;
    usedVolume?: number;
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

  const formatVolume = (value: number) => `${formatTonnes(value)} т`;

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

    // The UI and API express contract mass in tonnes; the stored price volume
    // remains kg until the database cutover.
    const totalVolumeKilograms = Number.parseFloat(price.volume || "0");
    const totalVolumeTonnes = kilogramsToTonnes(totalVolumeKilograms);

    if (totalVolumeTonnes <= 0) {
      return { remaining: 0, status: "ok" as const, message: "Безлимит" };
    }

    const apiUsedVolumeTonnes = usedData?.usedVolumeTonnes;
    let usedVolumeTonnes: number;
    if (
      typeof apiUsedVolumeTonnes === "number" &&
      Number.isFinite(apiUsedVolumeTonnes)
    ) {
      usedVolumeTonnes = apiUsedVolumeTonnes;
    } else if (
      typeof usedData?.usedVolume === "number" &&
      Number.isFinite(usedData.usedVolume) &&
      (mode === "opt" || (price as any).priceUnit !== "liter")
    ) {
      // Older OPT responses used kg. Older domestic/foreign responses could
      // use liters, which cannot safely be converted without deal densities.
      usedVolumeTonnes = kilogramsToTonnes(usedData.usedVolume);
    } else {
      return {
        remaining: 0,
        status: "error" as const,
        message: "Не удалось получить использованный объём в тоннах",
      };
    }

    const availableBeforeCurrent =
      totalVolumeTonnes - usedVolumeTonnes + initialQuantityTonnes;
    const remaining = calculateRemainingContractTonnes({
      totalVolumeKilograms,
      usedVolumeTonnes,
      initialQuantityTonnes,
      currentQuantityTonnes,
    });

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
          message: `Превышен! Остаток: ${formatVolume(availableBeforeCurrent)}`,
      };
    }
  } catch (e) {
    return { remaining: 0, status: "error" as const, message: "Ошибка данных" };
  }
}
