import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Warehouse, History, Globe } from "lucide-react";
import { ExportButton } from "@/components/export/export-button";
import { AuditPanel } from "@/components/audit-panel";
import type { Warehouse as WarehouseType } from "@shared/schema";
import { WarehouseCard } from "./warehouses/components/warehouse-card";
import { AddWarehouseDialog } from "./warehouses/components/add-warehouse-dialog";
import { WarehouseDetailsDialog } from "./warehouses/components/warehouse-details-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StorageCardsPage from "./storage-cards/storage-cards-page";

export default function WarehousesPage() {
  const [activeTab, setActiveTab] = useState("warehouses");
  const [search, setSearch] = useState("");
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingWarehouse, setViewingWarehouse] =
    useState<WarehouseType | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { hasPermission } = useAuth();

  const { data: warehouses, isLoading } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
    refetchInterval: 10000,
  });

  const filteredWarehouses =
    warehouses?.filter((w) => {
      const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    }) || [];

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
          <p className="text-muted-foreground">
            Управление складами и остатками
          </p>
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
        <ExportButton moduleName="warehouses" />
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
            <p className="text-muted-foreground">Нет складов для отображения</p>
            <p className="text-sm text-muted-foreground mt-1">
              Добавьте первый склад для начала работы
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWarehouses.map((warehouse) => (
            <WarehouseCard
              key={warehouse.id}
              warehouse={warehouse}
              onEdit={handleEdit}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

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
