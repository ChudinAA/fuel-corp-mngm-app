
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

interface WeekStats {
  optDealsWeek: number;
  refuelingsWeek: number;
  volumeSoldWeek: number;
  profitWeek: number;
}

export default function WeekStatsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<WeekStats>({
    queryKey: ["/api/dashboard/widget/week_stats"],
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
      title="Статистика за неделю"
      description="Последние 7 дней"
      icon={TrendingUp}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Оптовые сделки:</span>
            <span className="font-semibold">{data?.optDealsWeek ?? 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Заправки:</span>
            <span className="font-semibold">{data?.refuelingsWeek ?? 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Объем продаж:</span>
            <span className="font-semibold">
              {(data?.volumeSoldWeek ?? 0).toLocaleString('ru-RU')} кг
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">Прибыль:</span>
            <span className="font-semibold text-green-600">
              {formatCurrency(data?.profitWeek ?? 0)}
            </span>
          </div>
        </div>
      )}
    </BaseWidget>
  );
}
