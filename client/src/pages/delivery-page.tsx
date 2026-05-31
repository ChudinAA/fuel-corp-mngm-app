import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, History, X } from "lucide-react";
import type { DeliveryCost } from "@shared/schema";

import { AddDeliveryCostDialog } from "./delivery/components/delivery-cost-dialog";
import { DeliveryStatsCards } from "./delivery/components/delivery-stats-cards";
import { DeliveryTable } from "./delivery/components/delivery-table";
import { useDeliveryStats } from "./delivery/hooks/use-delivery-stats";
import { AuditPanel } from "@/components/audit-panel";
import { useAuth } from "@/hooks/use-auth";
import { ExportButton } from "@/components/export/export-button";

export default function DeliveryPage() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [filterCarrierId, setFilterCarrierId] = useState<string>("all");
  const [filterFrom, setFilterFrom] = useState<string>("all");
  const [filterTo, setFilterTo] = useState<string>("all");
  const [editingDeliveryCost, setEditingDeliveryCost] = useState<DeliveryCost | null>(null);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);

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

  const uniqueFromLocations = useMemo(() => {
    if (!deliveryCosts) return [];
    return Array.from(new Set(deliveryCosts.map(c => c.fromLocation).filter(Boolean))).sort();
  }, [deliveryCosts]);

  const uniqueToLocations = useMemo(() => {
    if (!deliveryCosts) return [];
    return Array.from(new Set(deliveryCosts.map(c => c.toLocation).filter(Boolean))).sort();
  }, [deliveryCosts]);

  const uniqueCarriers = useMemo(() => {
    if (!deliveryCosts || !carriers) return [];
    const ids = Array.from(new Set(deliveryCosts.map(c => c.carrierId).filter(Boolean)));
    return ids.map(id => ({ id, name: getCarrierName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [deliveryCosts, carriers]);

  const filteredCosts = useMemo(() => {
    if (!deliveryCosts) return [];
    return deliveryCosts.filter(c => {
      if (filterCarrierId !== "all" && c.carrierId !== filterCarrierId) return false;
      if (filterFrom !== "all" && c.fromLocation !== filterFrom) return false;
      if (filterTo !== "all" && c.toLocation !== filterTo) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchesFrom = c.fromLocation?.toLowerCase().includes(s);
        const matchesTo = c.toLocation?.toLowerCase().includes(s);
        const matchesCarrier = getCarrierName(c.carrierId).toLowerCase().includes(s);
        if (!matchesFrom && !matchesTo && !matchesCarrier) return false;
      }
      return true;
    });
  }, [deliveryCosts, filterCarrierId, filterFrom, filterTo, search, carriers]);

  const hasActiveFilters = filterCarrierId !== "all" || filterFrom !== "all" || filterTo !== "all" || search !== "";

  const clearFilters = () => {
    setFilterCarrierId("all");
    setFilterFrom("all");
    setFilterTo("all");
    setSearch("");
  };

  const exportPreviewData = filteredCosts.map(c => ({
    ...c,
    carrierName: getCarrierName(c.carrierId),
  }));

  const { averageCostPerKg, activeCarriersCount } = useDeliveryStats(deliveryCosts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Доставка</h1>
          <p className="text-muted-foreground">Управление тарифами на доставку</p>
        </div>
        {hasPermission("delivery", "create") && (
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
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-delivery"
                />
              </div>

              <Select value={filterCarrierId} onValueChange={setFilterCarrierId}>
                <SelectTrigger className="w-[170px]" data-testid="select-filter-carrier">
                  <SelectValue placeholder="Перевозчик" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все перевозчики</SelectItem>
                  {uniqueCarriers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterFrom} onValueChange={setFilterFrom}>
                <SelectTrigger className="w-[170px]" data-testid="select-filter-from">
                  <SelectValue placeholder="Откуда" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все откуда</SelectItem>
                  {uniqueFromLocations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterTo} onValueChange={setFilterTo}>
                <SelectTrigger className="w-[170px]" data-testid="select-filter-to">
                  <SelectValue placeholder="Куда" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все куда</SelectItem>
                  {uniqueToLocations.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters} title="Сбросить фильтры">
                  <X className="h-4 w-4" />
                </Button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <ExportButton
                  moduleName="delivery-cost"
                  previewData={exportPreviewData}
                />
                <Button
                  variant="outline"
                  onClick={() => setAuditPanelOpen(true)}
                  title="Аудит всех тарифов доставки"
                >
                  <History className="h-4 w-4 mr-2" />
                  История
                </Button>
              </div>
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

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="delivery_cost"
        entityId=""
      />
    </div>
  );
}
