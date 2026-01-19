import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export interface DuplicateCheckConfig {
  type: "opt" | "refueling";
  getFields: () => {
    date: Date;
    supplierId: string;
    buyerId: string;
    basis?: string | null;
    deliveryLocationId?: string | null;
    quantityKg: number;
  };
}

export function useDuplicateCheck({ type, getFields }: DuplicateCheckConfig) {
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const checkDuplicate = async (onConfirm: () => void, onCancel?: () => void) => {
    const fields = getFields();
    const endpoint = type === "opt" ? "/api/opt/check-duplicate" : "/api/refueling/check-duplicate";
    
    const payload: any = {
      supplierId: fields.supplierId,
      buyerId: fields.buyerId,
      basis: fields.basis,
      quantityKg: fields.quantityKg,
    };

    if (type === "opt") {
      payload.dealDate = format(fields.date, "yyyy-MM-dd");
      payload.deliveryLocationId = fields.deliveryLocationId;
    } else {
      payload.refuelingDate = format(fields.date, "yyyy-MM-dd");
    }

    try {
      const res = await apiRequest("POST", endpoint, payload);
      const { isDuplicate } = await res.json();

      if (isDuplicate) {
        setPendingAction(() => onConfirm);
        setShowDuplicateDialog(true);
      } else {
        onConfirm();
      }
    } catch (error) {
      console.error("Error checking duplicate:", error);
      onConfirm(); // Continue even if check fails
    }
  };

  const handleConfirm = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
    setShowDuplicateDialog(false);
  };

  const handleCancel = () => {
    setPendingAction(null);
    setShowDuplicateDialog(false);
  };

  return {
    showDuplicateDialog,
    setShowDuplicateDialog,
    checkDuplicate,
    handleConfirm,
    handleCancel,
  };
}
