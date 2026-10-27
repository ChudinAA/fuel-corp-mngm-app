
import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

export default function WarehouseAlertsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<{ value: number; enabled: boolean }>({
    queryKey: ["/api/dashboard/widget/warehouse_alerts"],
  });

  return (
    <BaseWidget
      title="Оповещения складов"
      description="Проверка вместимости отключена"
      icon={Warehouse}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <Skeleton className="h-12 w-24" />
      ) : (
        <div className="flex items-center h-full">
          <span className="text-sm text-muted-foreground">
            {data?.enabled
              ? `Требуют внимания: ${data.value}`
              : "Нет достоверных данных о физической вместимости"}
          </span>
        </div>
      )}
    </BaseWidget>
  );
}
