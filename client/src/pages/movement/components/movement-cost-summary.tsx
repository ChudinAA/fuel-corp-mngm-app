
import { CalculatedField } from "./calculated-field";
import { formatNumber, formatCurrency } from "../utils";

interface MovementCostSummaryProps {
  purchasePrice: number | null;
  purchaseAmount: number;
  storageCost: number;
  deliveryCost: number;
  costPerKg: number;
}

export function MovementCostSummary({ 
  purchasePrice, 
  purchaseAmount, 
  storageCost, 
  deliveryCost, 
  costPerKg 
}: MovementCostSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <CalculatedField 
        label="Цена закупки" 
        value={purchasePrice !== null ? formatNumber(purchasePrice) : "нет цены!"} 
        suffix={purchasePrice !== null ? " ₽/кг" : ""} 
      />
      <CalculatedField label="Сумма покупки" value={formatCurrency(purchaseAmount)} />
      <CalculatedField label="Хранение" value={formatCurrency(storageCost)} />
      <CalculatedField label="Доставка" value={formatCurrency(deliveryCost)} />
      <CalculatedField label="Себестоимость" value={formatNumber(costPerKg)} suffix=" ₽/кг" />
    </div>
  );
}
