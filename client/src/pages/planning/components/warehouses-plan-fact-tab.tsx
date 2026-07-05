import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { PlanningPeriod } from "../planning-page";
import { WarehousePlanPanel } from "./warehouse-plan-panel";

interface Warehouse {
  id: string;
  name: string;
  deletedAt?: string | null;
}

export function WarehousesPlanFactTab({ period }: { period: PlanningPeriod }) {
  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/warehouses");
      return res.json();
    },
  });

  const [activeWarehouseId, setActiveWarehouseId] = useState<string>("");

  useEffect(() => {
    if (!activeWarehouseId && warehouses.length > 0) {
      setActiveWarehouseId(warehouses[0].id);
    }
  }, [warehouses, activeWarehouseId]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Загрузка складов...</div>;
  }

  if (warehouses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Склады не найдены
      </div>
    );
  }

  return (
    <Tabs value={activeWarehouseId} onValueChange={setActiveWarehouseId}>
      <TabsList className="flex-wrap h-auto">
        {warehouses.map((wh) => (
          <TabsTrigger key={wh.id} value={wh.id} data-testid={`tab-warehouse-${wh.id}`}>
            <span className="flex items-center gap-2">
              {wh.name}
              {wh.deletedAt && (
                <Badge variant="secondary" className="text-xs">
                  Удалён
                </Badge>
              )}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {warehouses.map((wh) => (
        <TabsContent key={wh.id} value={wh.id} className="mt-4">
          <WarehousePlanPanel warehouseId={wh.id} period={period} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
