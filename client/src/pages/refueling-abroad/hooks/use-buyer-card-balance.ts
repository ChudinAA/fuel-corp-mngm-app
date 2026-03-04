import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface UseBuyerCardBalanceProps {
  buyerId: string;
  saleAmountUsd?: number | null;
  initialSaleAmountUsd?: number;
}

export function useBuyerCardBalance({
  buyerId,
  saleAmountUsd,
  initialSaleAmountUsd = 0,
}: UseBuyerCardBalanceProps) {
  const { data: buyerCards = [] } = useQuery<any[]>({
    queryKey: ["/api/storage-cards/advances", "buyer"],
    queryFn: () =>
      fetch("/api/storage-cards/advances?cardType=buyer", {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const buyerCard = useMemo(() => {
    return buyerCards.find((card: any) => card.buyerId === buyerId);
  }, [buyerCards, buyerId]);

  const currentBalance = useMemo(() => {
    if (!buyerCard) return 0;
    return parseFloat(String(buyerCard.currentBalance || "0"));
  }, [buyerCard]);

  const status = useMemo(() => {
    if (!buyerId || buyerId === "none") {
      return { status: "ok" as const, message: "—" };
    }

    if (!buyerCard) {
      return { status: "warning" as const, message: "Карта не привязана к покупателю" };
    }

    const amountToReceive = saleAmountUsd || 0;
    const availableBalance = currentBalance + initialSaleAmountUsd;
    const remainingBalance = availableBalance - amountToReceive;

    if (remainingBalance < 0) {
      return {
        status: "error" as const,
        message: `Недостаточно средств на карте: доступно ${availableBalance.toFixed(2)} $`,
      };
    }

    return {
      status: "ok" as const,
      message: `OK: ${remainingBalance.toFixed(2)} $`,
    };
  }, [buyerId, buyerCard, currentBalance, saleAmountUsd, initialSaleAmountUsd]);

  return {
    buyerCard,
    currentBalance,
    buyerBalanceStatus: status,
  };
}
