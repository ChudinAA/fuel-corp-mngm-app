
import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTonnes, kilogramsToTonnes } from "@shared/units";

interface WarehouseBalance {
  name: string;
  current: number;
}

export default function WarehouseBalancesWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<WarehouseBalance[]>({
    queryKey: ["/api/dashboard/widget/warehouse_balances"],
  });

  return (
    <BaseWidget
      title="Балансы складов"
      description="Текущее состояние"
      icon={Warehouse}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {data && data.length > 0 ? (
            data.map((wh, idx) => (
              <div key={idx} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{wh.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {formatTonnes(kilogramsToTonnes(wh.current))} т
                  </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет данных о складах
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
