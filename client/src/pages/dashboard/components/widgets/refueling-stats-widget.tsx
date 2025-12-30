
import { useQuery } from "@tanstack/react-query";
import { Plane } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";

export default function RefuelingStatsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<{ value: number }>({
    queryKey: ["/api/dashboard/widget/refueling_stats"],
  });

  return (
    <BaseWidget
      title="Заправки ВС сегодня"
      description="Выполнено заправок"
      icon={Plane}
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
