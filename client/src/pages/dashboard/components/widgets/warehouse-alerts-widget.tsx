
import { useQuery } from "@tanstack/react-query";
import { Warehouse, AlertTriangle } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseAlertsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/widget/warehouse_alerts"],
  });

  const hasAlerts = (data?.value ?? 0) > 0;

  return (
    <BaseWidget
      title="Оповещения складов"
      description="Требуют внимания"
      icon={Warehouse}
      isEditMode={isEditMode}
      onRemove={onRemove}
      className={hasAlerts ? "border-l-4 border-l-yellow-500" : ""}
    >
      {isLoading ? (
        <Skeleton className="h-12 w-24" />
      ) : (
        <div className="flex items-center gap-4 h-full">
          {hasAlerts && <AlertTriangle className="h-8 w-8 text-yellow-500" />}
          <span className={`text-3xl font-semibold ${hasAlerts ? 'text-yellow-600' : ''}`}>
            {data?.value ?? 0}
          </span>
        </div>
      )}
    </BaseWidget>
  );
}
