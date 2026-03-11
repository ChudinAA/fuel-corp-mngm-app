import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Truck, History, Plane, Warehouse } from "lucide-react";
import { ExportButton } from "@/components/export/export-button";
import { AuditPanel } from "@/components/audit-panel";
import type { Warehouse as WarehouseType, Equipment } from "@shared/schema";
import { WarehouseCard } from "../warehouses/components/warehouse-card";
import { WarehouseDetailsDialog } from "../warehouses/components/warehouse-details-dialog";
import { AddWarehouseDialog } from "../warehouses/components/add-warehouse-dialog";
import { EquipmentCard } from "./components/equipment-card";
import { EquipmentDetailsDialog } from "./components/equipment-details-dialog";
import { AddEquipmentDialog } from "./components/add-equipment-dialog";
import { useAuth } from "@/hooks/use-auth";
import { EQUIPMENT_TYPE } from "@shared/constants";

export default function EquipmentsPage() {
  const [search, setSearch] = useState("");
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingEquipment, setViewingEquipment] = useState<Equipment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [isWarehouseDialogOpen, setIsWarehouseDialogOpen] = useState(false);
  const [viewingWarehouse, setViewingWarehouse] = useState<WarehouseType | null>(null);
  const [isWarehouseDetailsOpen, setIsWarehouseDetailsOpen] = useState(false);

  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { hasPermission } = useAuth();

  const { data: warehouses, isLoading: warehousesLoading } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: allEquipments = [], isLoading: equipmentsLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/warehouses-equipment"],
    refetchInterval: 10000,
  });

  const likWarehouses =
    warehouses?.filter((w) => w.equipmentType === EQUIPMENT_TYPE.LIK) || [];

  const searchLower = search.toLowerCase();

  const filteredLikWarehouses = likWarehouses.filter((w) =>
    w.name.toLowerCase().includes(searchLower),
  );

  const filteredEquipments = allEquipments
    .filter((e) => e.name.toLowerCase().includes(searchLower))
    .sort((a, b) => {
      const balA = parseFloat(a.currentBalance || "0");
      const balB = parseFloat(b.currentBalance || "0");
      return balB - balA;
    });

  const handleEditEquipment = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (equipment: Equipment) => {
    setViewingEquipment(equipment);
    setIsDetailsDialogOpen(true);
  };

  const handleEditWarehouse = (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    setIsWarehouseDialogOpen(true);
  };

  const handleViewWarehouseDetails = (warehouse: WarehouseType) => {
    setViewingWarehouse(warehouse);
    setIsWarehouseDetailsOpen(true);
  };

  const isLoading = warehousesLoading || equipmentsLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Средства Заправки</h1>
          <p className="text-muted-foreground">
            Управление парком СЗ
          </p>
        </div>
        {hasPermission("equipment", "create") && (
          <Button
            onClick={() => setIsDialogOpen(true)}
            data-testid="button-add-equipment"
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить СЗ
          </Button>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-refueling"
            />
          </div>
          <Button variant="outline" onClick={() => setAuditPanelOpen(true)}>
            <History className="h-4 w-4 mr-2" />
            История изменений
          </Button>
          <ExportButton moduleName="equipment" />
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {filteredLikWarehouses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Plane className="h-4 w-4 text-green-400" />
                  Базовые склады
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredLikWarehouses.map((warehouse) => (
                    <WarehouseCard
                      key={warehouse.id}
                      warehouse={warehouse}
                      onEdit={handleEditWarehouse}
                      onViewDetails={handleViewWarehouseDetails}
                      isBase
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredEquipments.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Truck className="h-4 w-4 text-orange-400" />
                  Средства заправки
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredEquipments.map((eq) => (
                    <EquipmentCard
                      key={eq.id}
                      equipment={eq}
                      isLinked={true}
                      onEdit={handleEditEquipment}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              </div>
            ) : (
              filteredLikWarehouses.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Нет данных для отображения</p>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        )}
      </div>

      <AddEquipmentDialog
        equipmentToEdit={editingEquipment}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingEquipment(null);
        }}
        likWarehouses={likWarehouses}
      />

      {viewingEquipment && (
        <EquipmentDetailsDialog
          equipment={viewingEquipment}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        />
      )}

      <AddWarehouseDialog
        warehouseToEdit={editingWarehouse}
        onSave={() => {
          setIsWarehouseDialogOpen(false);
          setEditingWarehouse(null);
        }}
        open={isWarehouseDialogOpen}
        onOpenChange={(open) => {
          setIsWarehouseDialogOpen(open);
          if (!open) setEditingWarehouse(null);
        }}
      />

      {viewingWarehouse && (
        <WarehouseDetailsDialog
          warehouse={viewingWarehouse}
          open={isWarehouseDetailsOpen}
          onOpenChange={setIsWarehouseDetailsOpen}
        />
      )}

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="equipment"
        entityId=""
        entityName="Все средства заправки"
      />
    </div>
  );
}
