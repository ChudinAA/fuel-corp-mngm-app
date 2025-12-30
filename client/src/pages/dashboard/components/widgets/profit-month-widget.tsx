
import { useQuery } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfitMonthWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/widget/profit_month"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <BaseWidget
      title="Прибыль за месяц"
      description="Общая прибыль"
      icon={DollarSign}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <Skeleton className="h-12 w-32" />
      ) : (
        <div className="flex flex-col justify-center h-full">
          <span className="text-3xl font-semibold">{formatCurrency(data?.value ?? 0)}</span>
        </div>
      )}
    </BaseWidget>
  );
}
