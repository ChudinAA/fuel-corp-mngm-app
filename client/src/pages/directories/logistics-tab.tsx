import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Truck, Pencil, Trash2, MapPin, Car, Container, User, Building2, TruckIcon } from "lucide-react";
import { AuditHistoryButton } from "@/components/audit-history-button";
import type { 
  LogisticsCarrier,
  LogisticsDeliveryLocation,
  LogisticsVehicle,
  LogisticsTrailer,
  LogisticsDriver,
  LogisticsWarehouse
} from "@shared/schema";
import { AddLogisticsDialog, LOGISTICS_TYPES } from "./logistics-dialog";
import { useAuth } from "@/hooks/use-auth";

type LogisticsType = typeof LOGISTICS_TYPES[number]["value"];

export function LogisticsTab() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LogisticsType | "all">("all");
  const [editingItem, setEditingItem] = useState<{ type: string; data: any } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const { toast } = useToast();

  const { data: carriers, isLoading: carriersLoading } = useQuery<LogisticsCarrier[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const endpoints: Record<string, string> = {
        carrier: `/api/logistics/carriers/${id}`,
        delivery_location: `/api/logistics/delivery-locations/${id}`,
        vehicle: `/api/logistics/vehicles/${id}`,
        trailer: `/api/logistics/trailers/${id}`,
        driver: `/api/logistics/drivers/${id}`,
        warehouse: `/api/logistics/warehouses/${id}`,
      };
      const res = await apiRequest("DELETE", endpoints[type]);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/carriers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/delivery-locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/vehicles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/trailers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/drivers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logistics/warehouses"] });
      toast({ title: "Запись удалена", description: "Запись успешно удалена из справочника" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const { data: deliveryLocations, isLoading: locationsLoading } = useQuery<LogisticsDeliveryLocation[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery<LogisticsVehicle[]>({
    queryKey: ["/api/logistics/vehicles"],
  });

  const { data: trailers, isLoading: trailersLoading } = useQuery<LogisticsTrailer[]>({
    queryKey: ["/api/logistics/trailers"],
  });

  const { data: drivers, isLoading: driversLoading } = useQuery<LogisticsDriver[]>({
    queryKey: ["/api/logistics/drivers"],
  });

  const { data: warehouses, isLoading: warehousesLoading } = useQuery<LogisticsWarehouse[]>({
    queryKey: ["/api/logistics/warehouses"],
  });

  const isLoading = carriersLoading || locationsLoading || vehiclesLoading || trailersLoading || driversLoading || warehousesLoading;

  const allItems = [
    ...(carriers?.map(c => ({ ...c, type: "carrier" as const, typeName: "Перевозчик" })) || []),
    ...(deliveryLocations?.map(d => ({ ...d, type: "delivery_location" as const, typeName: "Место доставки" })) || []),
    ...(vehicles?.map(v => ({ ...v, type: "vehicle" as const, typeName: "Транспорт" })) || []),
    ...(trailers?.map(t => ({ ...t, type: "trailer" as const, typeName: "Прицеп" })) || []),
    ...(drivers?.map(d => ({ ...d, type: "driver" as const, typeName: "Водитель" })) || []),
    ...(warehouses?.map(w => ({ ...w, type: "warehouse" as const, typeName: "Склад/Базис" })) || []),
  ];

  const getItemDisplayName = (item: typeof allItems[number]): string => {
    if (item.type === "vehicle") {
      return (item as LogisticsVehicle & { type: string }).regNumber;
    }
    if (item.type === "trailer") {
      return (item as LogisticsTrailer & { type: string }).regNumber;
    }
    if (item.type === "driver") {
      return (item as LogisticsDriver & { type: string }).fullName;
    }
    return (item as { name: string }).name;
  };

  const filteredItems = allItems.filter(item => {
    const displayName = getItemDisplayName(item);
    const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getCarrierName = (carrierId: string | null | undefined) => {
    if (!carrierId) return null;
    return carriers?.find(c => c.id === carrierId)?.name || null;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "carrier":
        return <Building2 className="h-3.5 w-3.5 text-blue-400" />;
      case "delivery_location":
        return <MapPin className="h-3.5 w-3.5 text-purple-400" />;
      case "vehicle":
        return <Car className="h-3.5 w-3.5 text-green-400" />;
      case "trailer":
        return <Container className="h-3.5 w-3.5 text-amber-400" />;
      case "driver":
        return <User className="h-3.5 w-3.5 text-cyan-400" />;
      case "warehouse":
        return <TruckIcon className="h-3.5 w-3.5 text-sky-400" />;
      default:
        return <Truck className="h-3.5 w-3.5 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Справочник Логистика
        </CardTitle>
        <CardDescription>Перевозчики, транспорт, водители и точки доставки</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-logistics" 
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LogisticsType | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-logistics-type-filter">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {LOGISTICS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasPermission("directories", "create") && (
              <AddLogisticsDialog carriers={carriers || []} editItem={editingItem} onEditComplete={() => setEditingItem(null)} />
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Тип</TableHead>
                    <TableHead>Название</TableHead>
                    <TableHead>Доп. информация</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={`${item.type}-${item.id}`} data-testid={`row-logistics-${item.type}-${item.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
                            {getTypeIcon(item.type)}
                            <span>{item.typeName}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{getItemDisplayName(item)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {item.type === "vehicle" ? (item as LogisticsVehicle & { type: string }).model || "—" :
                           item.type === "trailer" ? (item as LogisticsTrailer & { type: string }).capacityKg || "—" :
                           item.type === "driver" ? (item as LogisticsDriver & { type: string }).phone || "—" :
                           item.type === "delivery_location" ? (item as LogisticsDeliveryLocation & { type: string }).address || "—" :
                           (item as LogisticsCarrier & { type: string }).inn || "—"}
                        </TableCell>
                        <TableCell>
                          {item.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <AuditHistoryButton
                              entityType={`logistics_${item.type}`}
                              entityId={item.id}
                              entityName={getItemDisplayName(item)}
                              variant="ghost"
                              size="icon"
                            />
                            {hasPermission("directories", "edit") && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                data-testid={`button-edit-${item.type}-${item.id}`}
                                onClick={() => setEditingItem({ type: item.type, data: item })}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission("directories", "delete") && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive" 
                                data-testid={`button-delete-${item.type}-${item.id}`}
                                onClick={() => {
                                  setItemToDelete({ type: item.type, id: item.id, name: getItemDisplayName(item) });
                                  setDeleteDialogOpen(true);
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMutation.mutate({ type: itemToDelete.type, id: itemToDelete.id });
          }
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить запись?"
        description="Вы уверены, что хотите удалить эту запись? Это действие нельзя отменить."
        itemName={itemToDelete?.name}
      />
    </Card>
  );
}