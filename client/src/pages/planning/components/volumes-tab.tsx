import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, History, ChevronDown, ChevronRight, Building2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EntityActionsMenu } from "@/components/entity-actions-menu";
import { AuditPanel } from "@/components/audit-panel";
import type { PlanningPeriod } from "../planning-page";
import { ResourceDialog } from "./resource-dialog";
import { AllocatedVolumeDialog } from "./allocated-volume-dialog";
import { FieldCommentPopover } from "./field-comment-popover";
import { TopLevelResourceDetail } from "./top-level-resource-detail";
import { WarehouseSupplyTagsBadges, WarehouseSupplyTagsDialog } from "./warehouse-supply-tags-dialog";
import { fmtTons } from "../utils/planning-utils";

interface ResourceSummaryRow {
  supplierId: string | null;
  supplierName: string;
  allocatedVolume: string;
  demand: string;
  balance: string;
  topLevelVolume: string;
  isUnassigned?: boolean;
}

interface WarehouseSummaryRow {
  warehouseId: string;
  warehouseName: string;
  plannedIncome: string;
  plannedExpense: string;
  balancePlan: string;
  balanceFact: string;
}

interface CustomerWarehouseVolume {
  warehouseId: string;
  warehouseName: string;
  volume: string;
}

interface CustomerSummaryRow {
  customerId: string;
  customerName: string;
  volume: string;
  warehouses: CustomerWarehouseVolume[];
}

interface PlanningResourceRow {
  id: string;
  supplierId: string;
  supplierName: string;
  notes?: string | null;
}

function fmtPeriod(period: PlanningPeriod) {
  return {
    periodFrom: format(period.from, "yyyy-MM-dd"),
    periodTo: format(period.to, "yyyy-MM-dd"),
  };
}

export function VolumesTab({ period, scenarioId }: { period: PlanningPeriod; scenarioId: string | null }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canAllocate = hasPermission("planning", "allocate");
  const { periodFrom, periodTo } = fmtPeriod(period);

  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<PlanningResourceRow | null>(null);
  const [deleteResourceId, setDeleteResourceId] = useState<string | null>(null);
  const [allocatedVolumeDialog, setAllocatedVolumeDialog] = useState<{
    supplierId: string;
    supplierName: string;
  } | null>(null);
  const [auditOpen, setAuditOpen] = useState<{ supplierId: string; name: string } | null>(null);
  const [expandedTopLevel, setExpandedTopLevel] = useState<string | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  const scenarioParam = scenarioId ? `&scenarioId=${scenarioId}` : "";

  const { data: resources = [], isLoading: loadingResources } = useQuery<PlanningResourceRow[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
  });

  const { data: resourcesSummary = [], isLoading: loadingResourcesSummary } = useQuery<ResourceSummaryRow[]>({
    queryKey: ["/api/planning/summary/resources", periodFrom, periodTo, scenarioId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/resources?periodFrom=${periodFrom}&periodTo=${periodTo}${scenarioParam}`,
      );
      return res.json();
    },
  });

  const { data: warehousesSummary = [], isLoading: loadingWarehouses } = useQuery<WarehouseSummaryRow[]>({
    queryKey: ["/api/planning/summary/warehouses", periodFrom, periodTo, scenarioId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/warehouses?periodFrom=${periodFrom}&periodTo=${periodTo}${scenarioParam}`,
      );
      return res.json();
    },
  });

  const { data: customersSummary = [], isLoading: loadingCustomers } = useQuery<CustomerSummaryRow[]>({
    queryKey: ["/api/planning/summary/customers", periodFrom, periodTo, scenarioId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/customers?periodFrom=${periodFrom}&periodTo=${periodTo}${scenarioParam}`,
      );
      return res.json();
    },
  });

  const summaryBySupplier = new Map(resourcesSummary.map((r) => [r.supplierId, r]));

  const handleResourceSubmit = async (values: { supplierId: string; notes?: string }) => {
    try {
      if (editingResource) {
        await apiRequest("PATCH", `/api/planning/resources/${editingResource.id}`, values);
      } else {
        await apiRequest("POST", "/api/planning/resources", values);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/planning/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: editingResource ? "Ресурс обновлён" : "Ресурс добавлен" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
      throw err;
    }
  };

  const handleDeleteResource = async () => {
    if (!deleteResourceId) return;
    try {
      await apiRequest("DELETE", `/api/planning/resources/${deleteResourceId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/planning/resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Ресурс удалён" });
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setDeleteResourceId(null);
    }
  };

  const toggleCustomer = (id: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Resources table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Ресурсы (поставщики)</CardTitle>
          {canAllocate && (
            <Button
              size="sm"
              onClick={() => {
                setEditingResource(null);
                setResourceDialogOpen(true);
              }}
              data-testid="button-add-resource"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить ресурс
            </Button>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Поставщик</TableHead>
                <TableHead>Верхнеур. план (т)</TableHead>
                <TableHead>Выделенный объём (т)</TableHead>
                <TableHead>Потребность (т)</TableHead>
                <TableHead>Баланс (т)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingResources ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : resources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Нет ресурсов. Нажмите «Добавить ресурс» чтобы начать.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {resources.map((res) => {
                    const summary = summaryBySupplier.get(res.supplierId ?? "");
                    const allocatedKg = summary?.allocatedVolume || "0";
                    const demandKg = summary?.demand || "0";
                    const balanceKg = summary?.balance || "0";
                    const topLevelKg = summary?.topLevelVolume || "0";
                    const balNum = parseFloat(balanceKg);
                    const isExpanded = expandedTopLevel === res.supplierId;

                    return (
                      <>
                        <TableRow
                          key={res.supplierId ?? "unassigned"}
                          data-testid={`row-resource-${res.supplierId ?? "unassigned"}`}
                          className={(res as any).isUnassigned ? "bg-amber-50 dark:bg-amber-950/30" : ""}
                        >
                          <TableCell className={(res as any).isUnassigned ? "font-medium text-amber-700 dark:text-amber-400" : "font-medium"}>
                            {res.supplierName}
                            {(res as any).isUnassigned && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(нераспределено)</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {!(res as any).isUnassigned ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  className="flex items-center gap-1 text-left hover:text-primary transition-colors"
                                  onClick={() =>
                                    setExpandedTopLevel(isExpanded ? null : res.supplierId)
                                  }
                                  title="Верхнеуровневый план"
                                  data-testid={`button-expand-top-level-${res.supplierId}`}
                                >
                                  {isExpanded
                                    ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  }
                                  <span className="font-medium tabular-nums">
                                    {fmtTons(topLevelKg)}
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(res as any).isUnassigned ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span data-testid={`text-allocated-volume-${res.supplierId}`}>
                                  {fmtTons(allocatedKg)}
                                </span>
                                {canAllocate && (
                                  <button
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() =>
                                      setAllocatedVolumeDialog({
                                        supplierId: res.supplierId!,
                                        supplierName: res.supplierName,
                                      })
                                    }
                                    title="Установить объём"
                                    data-testid={`button-edit-allocated-${res.supplierId}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <FieldCommentPopover
                                  entityType="planning_resource"
                                  entityId={res.supplierId!}
                                  fieldKey="allocatedVolume"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className={(res as any).isUnassigned ? "font-medium text-amber-700 dark:text-amber-400" : ""}>
                                {fmtTons((res as any).isUnassigned ? (res as any).demand : demandKg)}
                              </span>
                              {!(res as any).isUnassigned && (
                                <FieldCommentPopover
                                  entityType="planning_resource"
                                  entityId={res.supplierId!}
                                  fieldKey="demand"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  (res as any).isUnassigned
                                    ? "text-destructive font-medium"
                                    : balNum < 0
                                      ? "text-destructive font-medium"
                                      : balNum > 0
                                        ? "text-emerald-600 font-medium"
                                        : "text-muted-foreground"
                                }
                                data-testid={`text-balance-${res.supplierId ?? "unassigned"}`}
                              >
                                {(res as any).isUnassigned
                                  ? `−${fmtTons((res as any).demand)}`
                                  : `${balNum > 0 ? "+" : ""}${fmtTons(balanceKg)}`}
                              </span>
                              {!(res as any).isUnassigned && (
                                <FieldCommentPopover
                                  entityType="planning_resource"
                                  entityId={res.supplierId!}
                                  fieldKey="balance"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!(res as any).isUnassigned && (
                              <EntityActionsMenu
                                actions={[
                                  {
                                    id: "edit",
                                    label: "Редактировать",
                                    icon: Pencil,
                                    onClick: () => {
                                      setEditingResource(res as any);
                                      setResourceDialogOpen(true);
                                    },
                                    permission: { module: "planning", action: "allocate" },
                                  },
                                  {
                                    id: "delete",
                                    label: "Удалить",
                                    icon: Trash2,
                                    variant: "destructive",
                                    onClick: () => setDeleteResourceId((res as any).id),
                                    permission: { module: "planning", action: "allocate" },
                                  },
                                  {
                                    id: "history",
                                    label: "История изменений",
                                    icon: History,
                                    onClick: () =>
                                      setAuditOpen({ supplierId: res.supplierId!, name: res.supplierName }),
                                  },
                                ]}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Top-level detail expansion row */}
                        {isExpanded && !(res as any).isUnassigned && (
                          <TableRow key={`${res.supplierId}-topLevel`}>
                            <TableCell colSpan={6} className="bg-muted/30 p-4">
                              <TopLevelResourceDetail
                                supplierId={res.supplierId!}
                                supplierName={res.supplierName}
                                period={period}
                                scenarioId={scenarioId}
                                onClose={() => setExpandedTopLevel(null)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {/* Unassigned row from summary if not already in resources list */}
                  {resourcesSummary
                    .filter((s) => s.isUnassigned)
                    .map((s) => (
                      <TableRow
                        key="unassigned-summary"
                        className="bg-amber-50 dark:bg-amber-950/30"
                        data-testid="row-resource-unassigned"
                      >
                        <TableCell className="font-medium text-amber-700 dark:text-amber-400">
                          Не указан поставщик
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(нераспределено)</span>
                        </TableCell>
                        <TableCell><span className="text-muted-foreground">—</span></TableCell>
                        <TableCell><span className="text-muted-foreground">—</span></TableCell>
                        <TableCell>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {fmtTons(s.demand)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-destructive font-medium">
                            −{fmtTons(s.demand)}
                          </span>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Warehouses summary */}
      <Card>
        <CardHeader>
          <CardTitle>Данные по складам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Склад</TableHead>
                <TableHead>Планируемый приход (т)</TableHead>
                <TableHead>Планируемый расход (т)</TableHead>
                <TableHead>Остаток (план, т)</TableHead>
                <TableHead>Остаток (факт, т)</TableHead>
                <TableHead>Метки</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingWarehouses ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : warehousesSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                warehousesSummary.map((row) => {
                  const balPlan = parseFloat(row.balancePlan);
                  const balFact = parseFloat(row.balanceFact);
                  return (
                    <TableRow key={row.warehouseId} data-testid={`row-warehouse-${row.warehouseId}`}>
                      <TableCell className="font-medium">
                        <div>
                          {row.warehouseName}
                          <WarehouseSupplyTagsBadges warehouseId={row.warehouseId} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-600">{fmtTons(row.plannedIncome)}</span>
                          <FieldCommentPopover
                            entityType="warehouse_plan"
                            entityId={row.warehouseId}
                            fieldKey="plannedIncome"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-600">{fmtTons(row.plannedExpense)}</span>
                          <FieldCommentPopover
                            entityType="warehouse_plan"
                            entityId={row.warehouseId}
                            fieldKey="plannedExpense"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              balPlan < 0
                                ? "text-destructive font-medium"
                                : balPlan > 0
                                  ? "text-emerald-600 font-medium"
                                  : "text-muted-foreground"
                            }
                          >
                            {balPlan > 0 ? "+" : ""}{fmtTons(row.balancePlan)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              balFact < 0
                                ? "text-destructive font-medium"
                                : balFact > 0
                                  ? "text-emerald-600 font-medium"
                                  : "text-muted-foreground"
                            }
                          >
                            {balFact > 0 ? "+" : ""}{fmtTons(row.balanceFact)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <WarehouseSupplyTagsDialog
                          warehouseId={row.warehouseId}
                          warehouseName={row.warehouseName}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customers summary */}
      <Card>
        <CardHeader>
          <CardTitle>Данные по клиентам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Объём (т)</TableHead>
                <TableHead>Склады</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCustomers ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : customersSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                customersSummary.map((row) => {
                  const isExpanded = expandedCustomers.has(row.customerId);
                  const hasWarehouses = row.warehouses && row.warehouses.length > 0;
                  return (
                    <>
                      <TableRow key={row.customerId} data-testid={`row-customer-${row.customerId}`}>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{fmtTons(row.volume)}</span>
                            <FieldCommentPopover
                              entityType="customer_plan"
                              entityId={row.customerId}
                              fieldKey="volume"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasWarehouses ? (
                            <button
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => toggleCustomer(row.customerId)}
                              data-testid={`button-expand-customer-${row.customerId}`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              <Building2 className="h-3.5 w-3.5" />
                              {row.warehouses.length} скл.
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasWarehouses && (
                        <TableRow key={`${row.customerId}-warehouses`}>
                          <TableCell colSpan={3} className="bg-muted/20 p-3">
                            <div className="flex flex-wrap gap-2">
                              {row.warehouses.map((wh) => (
                                <div
                                  key={wh.warehouseId}
                                  className="flex items-center gap-2 border rounded-md px-3 py-1.5 text-sm"
                                >
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium">{wh.warehouseName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {fmtTons(wh.volume)} т
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ResourceDialog
        open={resourceDialogOpen}
        onOpenChange={(o) => {
          setResourceDialogOpen(o);
          if (!o) setEditingResource(null);
        }}
        existing={editingResource}
        onSubmit={handleResourceSubmit}
      />

      {allocatedVolumeDialog && (
        <AllocatedVolumeDialog
          open={!!allocatedVolumeDialog}
          onOpenChange={(o) => !o && setAllocatedVolumeDialog(null)}
          supplierId={allocatedVolumeDialog.supplierId}
          supplierName={allocatedVolumeDialog.supplierName}
          period={period}
        />
      )}

      <AlertDialog
        open={!!deleteResourceId}
        onOpenChange={(o) => !o && setDeleteResourceId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить ресурс?</AlertDialogTitle>
            <AlertDialogDescription>
              Поставщик будет удалён из списка ресурсов планирования.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResource}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-resource"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {auditOpen && (
        <AuditPanel
          open={!!auditOpen}
          onOpenChange={(o) => !o && setAuditOpen(null)}
          entityType="planning_resource"
          entityId={auditOpen.supplierId}
          entityName={auditOpen.name}
        />
      )}
    </div>
  );
}
