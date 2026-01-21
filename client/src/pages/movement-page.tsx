import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import type { Movement, Warehouse } from "@shared/schema";
import { MovementDialog } from "./movement/components/movement-dialog";
import { MovementTable } from "./movement/components/movement-table";
import { useAuth } from "@/hooks/use-auth";

export default function MovementPage() {
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/warehouses");
      return res.json();
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/suppliers");
      return res.json();
    },
  });

  const { data: carriers } = useQuery({
    queryKey: ["/api/logistics/carriers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/logistics/carriers");
      return res.json();
    },
  });

  const { data: prices } = useQuery({
    queryKey: ["/api/prices/list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prices/list");
      return res.json();
    },
  });

  const { data: deliveryCosts } = useQuery({
    queryKey: ["/api/delivery-costs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/delivery-costs");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/movement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Перемещение удалено" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleEditClick = (movement: Movement) => {
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
          <h1 className="text-2xl font-semibold">Перемещение</h1>
          <p className="text-muted-foreground">Учет покупок и внутренних перемещений топлива</p>
        </div>
        {hasPermission("movement", "create") && (
          <Button onClick={handleOpenDialog} data-testid="button-add-movement">
            <Plus className="mr-2 h-4 w-4" />
            Новое перемещение
          </Button>
        )}
      </div>

      <MovementDialog
        warehouses={warehouses || []}
        suppliers={suppliers || []}
        carriers={carriers || []}
        prices={prices || []}
        deliveryCosts={deliveryCosts || []}
        editMovement={editingMovement}
        isCopy={isCopy}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список перемещений</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <MovementTable
            onEdit={handleEditClick}
            onDelete={(id) => deleteMutation.mutate(id)}
            onShowHistory={() => setAuditPanelOpen(true)}
          />
        </CardContent>
      </Card>

      <AuditPanel
        open={auditPanelOpen}
        onOpenChange={setAuditPanelOpen}
        entityType="movement"
        entityId=""
        entityName="Все перемещения (включая удаленные)"
      />
    </div>
  );
}