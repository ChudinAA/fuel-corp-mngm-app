import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, History, ArrowRight, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuditPanel } from "@/components/audit-panel";
import { RouteEditDialog } from "./route-edit-dialog";

interface RoutesTabProps {
  periodFrom: string;
  periodTo: string;
}

export function RoutesTab({ periodFrom, periodTo }: RoutesTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: routes = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/delivery"],
    queryFn: () => apiRequest("/api/delivery"),
  });

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const aviaserviceCarrier = carriers.find((c: any) =>
    c.name?.toLowerCase().includes("авиасервис")
  );
  const starovoitovCarrier = carriers.find((c: any) =>
    c.name?.toLowerCase().includes("старовойтов")
  );

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/delivery/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/delivery"] });
      toast({ title: "Маршрут обновлён" });
      setEditDialogOpen(false);
    },
    onError: () => toast({ title: "Ошибка обновления", variant: "destructive" }),
  });

  const filteredRoutes = routes.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.fromLocation?.toLowerCase().includes(q) ||
      r.toLocation?.toLowerCase().includes(q) ||
      r.carrier?.name?.toLowerCase().includes(q)
    );
  });

  const groupedByRoute = new Map<string, any[]>();
  filteredRoutes.forEach((r: any) => {
    const key = `${r.fromEntityId}:${r.toEntityId}`;
    if (!groupedByRoute.has(key)) groupedByRoute.set(key, []);
    groupedByRoute.get(key)!.push(r);
  });

  const uniqueRoutes: any[] = [];
  groupedByRoute.forEach((group) => {
    const base = group[0];
    const aviaserviceRate = aviaserviceCarrier
      ? group.find((r: any) => r.carrierId === aviaserviceCarrier.id)?.costPerKg
      : null;
    const starovoitovRate = starovoitovCarrier
      ? group.find((r: any) => r.carrierId === starovoitovCarrier.id)?.costPerKg
      : null;
    const otherCarriers = group.filter(
      (r: any) =>
        r.carrierId !== aviaserviceCarrier?.id &&
        r.carrierId !== starovoitovCarrier?.id
    );
    uniqueRoutes.push({
      ...base,
      aviaserviceRate,
      starovoitovRate,
      otherCarriers,
      allRecords: group,
    });
  });

  const getPriorityColor = (priority: number | null) => {
    if (!priority) return "secondary";
    if (priority === 1) return "destructive";
    if (priority === 2) return "outline";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Маршруты из справочника Доставка с добавленными столбцами для планирования логистики
        </p>
        <Input
          placeholder="Поиск маршрута..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
          data-testid="input-search-routes"
        />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Маршрут</TableHead>
              <TableHead>Расст., км</TableHead>
              <TableHead>Сутки пути</TableHead>
              <TableHead>АвиаСервис (₽/кг)</TableHead>
              <TableHead>Старовойтов (₽/кг)</TableHead>
              <TableHead>Остальные перевозчики</TableHead>
              <TableHead>Приоритет</TableHead>
              <TableHead className="sticky right-0 bg-background z-10">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : uniqueRoutes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Нет маршрутов
                </TableCell>
              </TableRow>
            ) : (
              uniqueRoutes.map((route: any) => (
                <TableRow key={`${route.fromEntityId}:${route.toEntityId}`} data-testid={`row-route-${route.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-medium">{route.fromLocation}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium">{route.toLocation}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {route.distance ? (
                      <span>{parseFloat(route.distance).toLocaleString("ru")}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.transitDays != null ? (
                      <span>{route.transitDays}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.aviaserviceRate != null ? (
                      <span className="tabular-nums">
                        {parseFloat(route.aviaserviceRate).toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.starovoitovRate != null ? (
                      <span className="tabular-nums">
                        {parseFloat(route.starovoitovRate).toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.otherCarriers?.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {route.otherCarriers.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-1 text-xs">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            <span>{r.carrier?.name || "—"}</span>
                            <span className="text-muted-foreground">
                              {parseFloat(r.costPerKg).toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {route.priority != null ? (
                      <Badge variant={getPriorityColor(route.priority) as any} className="text-xs">
                        {route.priority}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="sticky right-0 bg-background z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`menu-route-${route.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingRoute(route);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAuditEntityId(route.id);
                            setAuditOpen(true);
                          }}
                        >
                          <History className="h-4 w-4 mr-2" />
                          История изменений
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingRoute && (
        <RouteEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          route={editingRoute}
          onSave={(id, data) => updateMutation.mutate({ id, data })}
          isPending={updateMutation.isPending}
        />
      )}

      {auditEntityId && (
        <AuditPanel
          open={auditOpen}
          onOpenChange={setAuditOpen}
          entityType="delivery_cost"
          entityId={auditEntityId}
        />
      )}
    </div>
  );
}
