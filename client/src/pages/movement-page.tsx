import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditPanel } from "@/components/audit-panel";
import type { Warehouse } from "@shared/schema";
import { MovementDialog } from "./movement/components/movement-dialog";
import { MovementTable } from "./movement/components/movement-table";
import type { MovementApiRecord } from "./movement/types";

export default function MovementPage() {
  const [editingMovement, setEditingMovement] =
    useState<MovementApiRecord | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();

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

  const { data: vehicles } = useQuery<any[]>({
    queryKey: ["/api/logistics/vehicles"],
  });

  const { data: trailers } = useQuery<any[]>({
    queryKey: ["/api/logistics/trailers"],
  });

  const { data: drivers } = useQuery<any[]>({
    queryKey: ["/api/logistics/drivers"],
  });

  const { data: prices } = useQuery<any[]>({
    queryKey: ["/api/prices"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/opt/contract-used"] });
      toast({ title: "Перемещение удалено" });
    },
    onError: (error: Error) => {
      showError(error.message);
    },
  });

  const handleEditClick = (movement: MovementApiRecord) => {
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

      <MovementDialog
        warehouses={warehouses || []}
        suppliers={suppliers || []}
        carriers={carriers || []}
        vehicles={vehicles || []}
        trailers={trailers || []}
        drivers={drivers || []}
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
            onCreate={handleOpenDialog}
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
      <ErrorModalComponent />
    </div>
  );
}
