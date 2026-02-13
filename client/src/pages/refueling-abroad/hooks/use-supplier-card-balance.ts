import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { StorageCard } from "@shared/schema";

interface UseSupplierCardBalanceProps {
  supplierId: string;
  storageCardId?: string | null;
  purchaseAmountUsd: number | null;
  initialPurchaseAmountUsd?: number;
}

export function useSupplierCardBalance({
  supplierId,
  storageCardId,
  purchaseAmountUsd,
  initialPurchaseAmountUsd = 0,
}: UseSupplierCardBalanceProps) {
  const { data: storageCards = [] } = useQuery<StorageCard[]>({
    queryKey: ["/api/storage-cards"],
  });

  const supplierCard = useMemo(() => {
    if (storageCardId) {
      return storageCards.find((card) => card.id === storageCardId);
    }
    return storageCards.find((card) => card.supplierId === supplierId);
  }, [storageCards, supplierId, storageCardId]);

  const currentBalance = useMemo(() => {
    if (!supplierCard) return 0;
    return parseFloat(String(supplierCard.currentBalance || "0"));
  }, [supplierCard]);

  const status = useMemo(() => {
    if (!supplierId || supplierId === "none") {
      return { status: "idle", message: "" };
    }

    if (!supplierCard) {
      return { status: "warning", message: "Карта хранения не привязана к поставщику" };
    }

    const amountToSpend = purchaseAmountUsd || 0;
    const availableBalance = currentBalance + initialPurchaseAmountUsd;
    const remainingBalance = availableBalance - amountToSpend;

    if (remainingBalance < 0) {
      return {
        status: "error",
        message: `Недостаточно средств на карте: доступно ${availableBalance.toFixed(2)} $, требуется ${amountToSpend.toFixed(2)} $`,
      };
    }

    return {
      status: "success",
      message: `Доступно: ${remainingBalance.toFixed(2)} $`,
    };
  }, [supplierId, supplierCard, currentBalance, purchaseAmountUsd, initialPurchaseAmountUsd]);

  return {
    supplierCard,
    currentBalance,
    supplierBalanceStatus: status,
  };
}
