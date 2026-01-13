import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Plus } from "lucide-react";
import { MOVEMENT_TYPE } from "@shared/constants";
import { AddPriceDialog } from "@/pages/prices/components/add-price-dialog";

interface MovementCostSummaryProps {
  purchasePrice: number | null;
  purchaseAmount: number;
  storageCost: number;
  deliveryCost: number;
  costPerKg: number;
  watchMovementType: string;
}

export function MovementCostSummary({
  purchasePrice,
  purchaseAmount,
  storageCost,
  deliveryCost,
  costPerKg,
  watchMovementType,
}: MovementCostSummaryProps) {
  const { hasPermission } = useAuth();
  const [addPurchasePriceOpen, setAddPurchasePriceOpen] = useState(false);

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      <div className="flex items-end gap-1">
        <CalculatedField
          label="Цена закупки"
          value={
            purchasePrice !== null ? formatNumber(purchasePrice) : "нет цены!"
          }
          suffix={purchasePrice !== null ? " ₽/кг" : ""}
        />
        {hasPermission("prices", "create") &&
          watchMovementType === MOVEMENT_TYPE.SUPPLY && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => setAddPurchasePriceOpen(true)}
              data-testid="button-add-purchase-price-inline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
      </div>
      <CalculatedField
        label="Сумма покупки"
        value={formatCurrency(purchaseAmount)}
      />
      <CalculatedField label="Хранение" value={formatCurrency(storageCost)} />
      <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
      <CalculatedField
        label="Себестоимость"
        value={formatNumber(costPerKg)}
        suffix=" ₽/кг"
      />

      <AddPriceDialog
        isInline
        inlineOpen={addPurchasePriceOpen}
        onInlineOpenChange={setAddPurchasePriceOpen}
      />
    </div>
  );
}
