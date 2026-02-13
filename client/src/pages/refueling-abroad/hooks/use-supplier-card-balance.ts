import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StorageCard } from "@shared/schema";

interface UseSupplierCardBalanceProps {
  supplierId: string;
  purchaseAmountUsd: number | null;
  initialPurchaseAmountUsd?: number;
}

export function useSupplierCardBalance({
  supplierId,
  purchaseAmountUsd,
  initialPurchaseAmountUsd = 0,
}: UseSupplierCardBalanceProps) {
  const { data: storageCards = [] } = useQuery<StorageCard[]>({
    queryKey: ["/api/storage-cards"],
  });

  const supplierCard = useMemo(() => {
    return storageCards.find((card) => card.supplierId === supplierId);
  }, [storageCards, supplierId]);

  const currentBalance = useMemo(() => {
    if (!supplierCard) return 0;
    return parseFloat(String(supplierCard.currentBalance || "0"));
  }, [supplierCard]);

  const status = useMemo(() => {
    let status: "ok" | "error" | "warning" = "ok";
    if (!supplierId || supplierId === "none") {
      return { status: status, message: "—" };
    }

    if (!supplierCard) {
      status = "warning";
      return { status: status, message: "Карта не привязана к поставщику" };
    }

    const amountToSpend = purchaseAmountUsd || 0;
    const availableBalance = currentBalance + initialPurchaseAmountUsd;
    const remainingBalance = availableBalance - amountToSpend;

    if (remainingBalance < 0) {
      status = "error";
      return {
        status: status,
        message: `Недостаточно средств на карте: доступно ${availableBalance.toFixed(2)} $`,
      };
    }

    return {
      status: status,
      message: `OK: ${remainingBalance.toFixed(2)} $`,
    };
  }, [
    supplierId,
    supplierCard,
    currentBalance,
    purchaseAmountUsd,
    initialPurchaseAmountUsd,
  ]);

  return {
    supplierCard,
    currentBalance,
    supplierBalanceStatus: status,
  };
}
