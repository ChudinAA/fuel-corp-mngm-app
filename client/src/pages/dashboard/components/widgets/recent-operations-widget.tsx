
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { BaseWidget } from "../base-widget";
import { WidgetProps } from "../../types";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Operation {
  type: string;
  description: string;
  time: string;
  status: string;
}

export default function RecentOperationsWidget({ isEditMode, onRemove }: WidgetProps) {
  const { data, isLoading } = useQuery<Operation[]>({
    queryKey: ["/api/dashboard/widget/recent_operations"],
  });

  return (
    <BaseWidget
      title="Последние операции"
      description="Недавние сделки и перемещения"
      icon={Activity}
      isEditMode={isEditMode}
      onRemove={onRemove}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data && data.length > 0 ? (
            data.map((op, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{op.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(op.time).toLocaleString('ru-RU')}
                  </p>
                </div>
                <Badge variant={op.status === 'success' ? 'default' : 'secondary'}>
                  {op.type}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Нет операций
            </p>
          )}
        </div>
      )}
    </BaseWidget>
  );
}
