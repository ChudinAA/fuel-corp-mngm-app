import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Pencil as PencilIcon, History } from "lucide-react";
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
import { fmtTons, kgToTons } from "../utils/planning-utils";

interface ResourceSummaryRow {
  supplierId: string;
  supplierName: string;
  allocatedVolume: string;
  demand: string;
  balance: string;
}

interface WarehouseSummaryRow {
  warehouseId: string;
  warehouseName: string;
  plannedIncome: string;
  plannedExpense: string;
  balancePlan: string;
  balanceFact: string;
}

interface CustomerSummaryRow {
  customerId: string;
  customerName: string;
  volume: string;
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

export function VolumesTab({ period }: { period: PlanningPeriod }) {
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

  const { data: resources = [], isLoading: loadingResources } = useQuery<PlanningResourceRow[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
  });

  const { data: resourcesSummary = [], isLoading: loadingResourcesSummary } = useQuery<ResourceSummaryRow[]>({
    queryKey: ["/api/planning/summary/resources", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/resources?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      );
      return res.json();
    },
  });

  const { data: warehousesSummary = [], isLoading: loadingWarehouses } = useQuery<WarehouseSummaryRow[]>({
    queryKey: ["/api/planning/summary/warehouses", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/warehouses?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      );
      return res.json();
    },
  });

  const { data: customersSummary = [], isLoading: loadingCustomers } = useQuery<CustomerSummaryRow[]>({
    queryKey: ["/api/planning/summary/customers", periodFrom, periodTo],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/planning/summary/customers?periodFrom=${periodFrom}&periodTo=${periodTo}`,
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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Поставщик</TableHead>
                <TableHead>Выделенный объём (т)</TableHead>
                <TableHead>Потребность (т)</TableHead>
                <TableHead>Баланс (т)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingResources ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : resources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Нет ресурсов. Нажмите «Добавить ресурс» чтобы начать.
                  </TableCell>
                </TableRow>
              ) : (
                resources.map((res) => {
                  const summary = summaryBySupplier.get(res.supplierId);
                  const allocatedKg = summary?.allocatedVolume || "0";
                  const demandKg = summary?.demand || "0";
                  const balanceKg = summary?.balance || "0";
                  const balNum = parseFloat(balanceKg);

                  return (
                    <TableRow key={res.id} data-testid={`row-resource-${res.id}`}>
                      <TableCell className="font-medium">{res.supplierName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span data-testid={`text-allocated-volume-${res.id}`}>
                            {fmtTons(allocatedKg)}
                          </span>
                          {canAllocate && (
                            <button
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() =>
                                setAllocatedVolumeDialog({
                                  supplierId: res.supplierId,
                                  supplierName: res.supplierName,
                                })
                              }
                              title="Установить объём"
                              data-testid={`button-edit-allocated-${res.id}`}
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <FieldCommentPopover
                            entityType="planning_resource"
                            entityId={res.id}
                            fieldKey="allocatedVolume"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span>{fmtTons(demandKg)}</span>
                          <FieldCommentPopover
                            entityType="planning_resource"
                            entityId={res.id}
                            fieldKey="demand"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              balNum < 0
                                ? "text-destructive font-medium"
                                : balNum > 0
                                  ? "text-emerald-600 font-medium"
                                  : "text-muted-foreground"
                            }
                            data-testid={`text-balance-${res.id}`}
                          >
                            {balNum > 0 ? "+" : ""}{fmtTons(balanceKg)}
                          </span>
                          <FieldCommentPopover
                            entityType="planning_resource"
                            entityId={res.id}
                            fieldKey="balance"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <EntityActionsMenu
                          actions={[
                            {
                              id: "edit",
                              label: "Редактировать",
                              icon: Pencil,
                              onClick: () => {
                                setEditingResource(res);
                                setResourceDialogOpen(true);
                              },
                              permission: { module: "planning", action: "allocate" },
                            },
                            {
                              id: "delete",
                              label: "Удалить",
                              icon: Trash2,
                              variant: "destructive",
                              onClick: () => setDeleteResourceId(res.id),
                              permission: { module: "planning", action: "allocate" },
                            },
                            {
                              id: "history",
                              label: "История изменений",
                              icon: History,
                              onClick: () =>
                                setAuditOpen({ supplierId: res.supplierId, name: res.supplierName }),
                            },
                          ]}
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

      {/* Warehouses summary */}
      <Card>
        <CardHeader>
          <CardTitle>Данные по складам</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Склад</TableHead>
                <TableHead>Планируемый приход (т)</TableHead>
                <TableHead>Планируемый расход (т)</TableHead>
                <TableHead>Остаток (план, т)</TableHead>
                <TableHead>Остаток (факт, т)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingWarehouses ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : warehousesSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                warehousesSummary.map((row) => {
                  const balPlan = parseFloat(row.balancePlan);
                  const balFact = parseFloat(row.balanceFact);
                  return (
                    <TableRow key={row.warehouseId} data-testid={`row-warehouse-${row.warehouseId}`}>
                      <TableCell className="font-medium">{row.warehouseName}</TableCell>
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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Объём (т)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCustomers ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : customersSummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                customersSummary.map((row) => (
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
                  </TableRow>
                ))
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
