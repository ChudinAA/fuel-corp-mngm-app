import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Warehouse, History, Globe, Plane, Pin } from "lucide-react";

import { AuditPanel } from "@/components/audit-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WarehouseWithTonnes as WarehouseType } from "./warehouses/types";
import { WarehouseCard } from "./warehouses/components/warehouse-card";
import { AddWarehouseDialog } from "./warehouses/components/add-warehouse-dialog";
import { WarehouseDetailsDialog } from "./warehouses/components/warehouse-details-dialog";
import {
  RecalculationIssuesAlert,
  type RecalculationIssue,
} from "./warehouses/components/recalculation-issues-alert";
import { useAuth } from "@/hooks/use-auth";
import { EQUIPMENT_TYPE } from "@shared/constants";

export default function WarehousesPage() {
  const [search, setSearch] = useState("");
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingWarehouse, setViewingWarehouse] =
    useState<WarehouseType | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { hasPermission, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canViewWarehouses = hasPermission("warehouses", "view");
  const canViewEquipment = hasPermission("equipment", "view");

  const { data: warehouses, isLoading } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
    refetchInterval: 10000,
  });
  const {
    data: warehouseRecalculationIssues = [],
    isLoading: isLoadingWarehouseIssues,
    isError: isWarehouseIssuesError,
  } = useQuery<RecalculationIssue[]>({
    queryKey: ["/api/warehouses/recalculation-issues"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/warehouses/recalculation-issues")).json(),
    enabled: canViewWarehouses,
    refetchInterval: 10000,
  });
  const {
    data: equipmentRecalculationIssues = [],
    isLoading: isLoadingEquipmentIssues,
    isError: isEquipmentIssuesError,
  } = useQuery<RecalculationIssue[]>({
    queryKey: ["/api/warehouses-equipment/recalculation-issues"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/warehouses-equipment/recalculation-issues")).json(),
    enabled: canViewEquipment,
    refetchInterval: 10000,
  });
  const recalculationIssues = [
    ...warehouseRecalculationIssues,
    ...equipmentRecalculationIssues,
  ];
  const isLoadingRecalculationIssues =
    (canViewWarehouses && isLoadingWarehouseIssues) ||
    (canViewEquipment && isLoadingEquipmentIssues);
  const hasRecalculationIssuesError =
    (canViewWarehouses && isWarehouseIssuesError) ||
    (canViewEquipment && isEquipmentIssuesError);
  const restartRecalculationMutation = useMutation({
    mutationFn: async (issue: RecalculationIssue) => {
      const url =
        issue.recordType === "warehouse"
          ? `/api/warehouses/recalculation-issues/${issue.id}/restart`
          : `/api/warehouses-equipment/recalculation-issues/${issue.id}/restart`;
      await apiRequest("POST", url);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses/recalculation-issues"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/warehouses-equipment/recalculation-issues"],
        }),
      ]);
      toast({
        title: "Пересчёт поставлен в очередь",
        description: "Статус пересчёта обновлён.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось перезапустить пересчёт",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredWarehouses =
    warehouses?.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    }) || [];

  const pinnedWarehouses = filteredWarehouses.filter((w) => !!w.isPinned);
  const unpinnedWarehouses = filteredWarehouses.filter((w) => !w.isPinned);

  const commonWarehouses = unpinnedWarehouses.filter(
    (w) => w.equipmentType !== EQUIPMENT_TYPE.LIK,
  );
  const baseWarehouses = unpinnedWarehouses.filter(
    (w) => w.equipmentType === EQUIPMENT_TYPE.LIK,
  );

  const handleSave = () => {
    setEditingWarehouse(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (warehouse: WarehouseType) => {
    setViewingWarehouse(warehouse);
    setIsDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Склады</h1>
        </div>
        {hasPermission("warehouses", "create") && (
          <Button
            onClick={() => setIsDialogOpen(true)}
            data-testid="button-add-warehouse"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить склад
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {isLoadingRecalculationIssues && (
          <RecalculationIssuesAlert issues={[]} isLoading />
        )}
        {!isLoadingRecalculationIssues && recalculationIssues.length > 0 && (
          <RecalculationIssuesAlert
            issues={recalculationIssues}
            isAdmin={isAdmin}
            restartingIssueId={restartRecalculationMutation.isPending
              ? restartRecalculationMutation.variables?.id
              : null}
            onRestart={(issue) => restartRecalculationMutation.mutate(issue)}
          />
        )}
        {hasRecalculationIssuesError && (
          <Alert variant="destructive">
            <AlertTitle>Не удалось проверить пересчёт остатков</AlertTitle>
            <AlertDescription>
              Статус пересчёта временно недоступен. Повторите загрузку страницы
              или обратитесь к администратору.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск складов..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-warehouses"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setAuditPanelOpen(true)}
            title="Аудит всех складов"
          >
            <History className="h-4 w-4 mr-2" />
            История изменений
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Нет складов для отображения
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Добавьте первый склад для начала работы
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Pinned warehouses section */}
            {pinnedWarehouses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Pin className="h-4 w-4 fill-current" />
                  Закреплённые
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pinnedWarehouses.map((warehouse) => (
                    <WarehouseCard
                      key={warehouse.id}
                      warehouse={warehouse}
                      onEdit={handleEdit}
                      onViewDetails={handleViewDetails}
                      isBase={warehouse.equipmentType === EQUIPMENT_TYPE.LIK}
                    />
                  ))}
                </div>
              </div>
            )}

            {commonWarehouses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Warehouse className="h-4 w-4" />
                  Общие склады
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {commonWarehouses.map((warehouse) => (
                    <WarehouseCard
                      key={warehouse.id}
                      warehouse={warehouse}
                      onEdit={handleEdit}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              </div>
            )}

            {baseWarehouses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Plane className="h-4 w-4 text-green-400" />
                  Базовые склады (Обособленные подразделения)
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {baseWarehouses.map((warehouse) => (
                    <WarehouseCard
                      key={warehouse.id}
                      warehouse={warehouse}
                      onEdit={handleEdit}
                      onViewDetails={handleViewDetails}
                      isBase
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AddWarehouseDialog
        warehouseToEdit={editingWarehouse}
        onSave={handleSave}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingWarehouse(null);
        }}
      />

      {viewingWarehouse && (
        <WarehouseDetailsDialog
          warehouse={viewingWarehouse}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        />
      )}

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="warehouses"
        entityId=""
        entityName="Все склады (включая удаленные)"
      />
    </div>
  );
}
