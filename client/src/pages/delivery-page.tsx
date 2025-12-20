import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { DeliveryCost } from "@shared/schema";

import { AddDeliveryCostDialog } from "./delivery/components/delivery-cost-dialog";
import { DeliveryStatsCards } from "./delivery/components/delivery-stats-cards";
import { DeliveryTable } from "./delivery/components/delivery-table";
import { useDeliveryStats } from "./delivery/hooks/use-delivery-stats";
import { useAuth } from "@/hooks/use-auth";

export default function DeliveryPage() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [editingDeliveryCost, setEditingDeliveryCost] = useState<DeliveryCost | null>(null);

  const { data: deliveryCosts, isLoading } = useQuery<DeliveryCost[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const { data: carriers } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: bases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases"],
  });

  const getCarrierName = (carrierId: string) => {
    const carrier = carriers?.find(c => c.id === carrierId);
    return carrier?.name || carrierId;
  };

  const filteredCosts = deliveryCosts?.filter(c => 
    c.fromLocation.toLowerCase().includes(search.toLowerCase()) ||
    c.toLocation.toLowerCase().includes(search.toLowerCase()) ||
    getCarrierName(c.carrierId).toLowerCase().includes(search.toLowerCase()) // Added carrier search
  ) || [];

  const { averageCostPerKg, activeCarriersCount } = useDeliveryStats(deliveryCosts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Доставка</h1>
          <p className="text-muted-foreground">Управление тарифами на доставку</p>
        </div>
        {hasPermission("delivery_cost", "create") && (
          <AddDeliveryCostDialog editDeliveryCost={editingDeliveryCost} onClose={() => setEditingDeliveryCost(null)} />
        )}
      </div>

      <DeliveryStatsCards 
        totalRoutes={filteredCosts.length}
        averageCostPerKg={averageCostPerKg}
        activeCarriersCount={activeCarriersCount}
      />

      <Card>
        <CardHeader>
          <CardTitle>Тарифы доставки</CardTitle>
          <CardDescription>Стоимость перевозки по маршрутам</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
              placeholder="Поиск по маршруту или перевозчику..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-delivery"
            />
            </div>

            <DeliveryTable 
              costs={filteredCosts}
              isLoading={isLoading}
              getCarrierName={getCarrierName}
              onEdit={setEditingDeliveryCost}
              bases={bases}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}