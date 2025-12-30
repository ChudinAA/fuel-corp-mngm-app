
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

export default function OptStatsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/widget/opt_stats"],
  });

  return (
    <BaseWidget
      title="Оптовые сделки сегодня"
      description="Всего сделок за день"
      icon={ShoppingCart}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <Skeleton className="h-12 w-24" />
      ) : (
        <div className="flex flex-col justify-center h-full">
          <span className="text-3xl font-semibold">{data?.value ?? 0}</span>
        </div>
      )}
    </BaseWidget>
  );
}
