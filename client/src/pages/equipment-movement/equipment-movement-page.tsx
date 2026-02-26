import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import type { EquipmentMovement, Warehouse, Equipment } from "@shared/schema";
import { EquipmentMovementDialog } from "./components/equipment-movement-dialog";
import { EquipmentMovementTable } from "./components/equipment-movement-table";
import { useAuth } from "@/hooks/use-auth";

export default function EquipmentMovementPage() {
  const [editingMovement, setEditingMovement] =
    useState<EquipmentMovement | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/equipment-movement/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-movement"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/warehouses/equipment-map"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Перемещение удалено" });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [auditEntity, setAuditEntity] = useState<{ id: string; name: string }>({
    id: "",
    name: "Все перемещения ЛИК",
  });

  const handleShowHistory = (id?: string, name?: string) => {
    setAuditEntity({
      id: id || "",
      name: name || "Все перемещения ЛИК",
    });
    setAuditPanelOpen(true);
  };

  const handleEditClick = (movement: any) => {
    setEditingMovement(movement);
    setIsCopy(!!movement && !movement.id);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingMovement(null);
    setIsCopy(false);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Перемещение ЛИК</h1>
        </div>
        {hasPermission("equipment_movement", "create") && (
          <Button onClick={handleOpenDialog} data-testid="button-add-movement">
            <Plus className="mr-2 h-4 w-4" />
            Новое перемещение
          </Button>
        )}
      </div>

      <EquipmentMovementDialog
        warehouses={warehouses || []}
        editMovement={editingMovement}
        isCopy={isCopy}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список перемещений ЛИК</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <EquipmentMovementTable
            onEdit={handleEditClick}
            onDelete={(id: string) => deleteMutation.mutate(id)}
            onShowHistory={handleShowHistory}
          />
        </CardContent>
      </Card>

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="equipment_movement"
        entityId={auditEntity.id}
        entityName={auditEntity.name}
      />
    </div>
  );
}
