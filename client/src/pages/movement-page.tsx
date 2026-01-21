import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronLeft, ChevronRight, Search, History } from "lucide-react";
import { AuditPanel } from "@/components/audit-panel";
import type { Movement, Warehouse } from "@shared/schema";
import { MovementDialog } from "./movement/components/movement-dialog";
import { MovementTable } from "./movement/components/movement-table";
import { MOVEMENT_TYPE, PRODUCT_TYPE } from "@shared/constants";
import { useAuth } from "@/hooks/use-auth";
import { ExportButton } from "@/components/export/export-button";

export default function MovementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [isCopy, setIsCopy] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [auditPanelOpen, setAuditPanelOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const pageSize = 20;

  const { data: movementData, isLoading } = useQuery({
    queryKey: ["/api/movement", page, pageSize],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/movement?page=${page}&pageSize=${pageSize}`);
      return res.json();
    },
  });

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
    queryKey: ["/api/prices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/prices");
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

  // Фильтрация и поиск
  const filteredData = useMemo(() => {
    let result = movementData?.data || [];

    // Поиск
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((item: any) => 
        item.fromName?.toLowerCase().includes(searchLower) ||
        item.toName?.toLowerCase().includes(searchLower) ||
        item.carrierName?.toLowerCase().includes(searchLower) ||
        item.notes?.toLowerCase().includes(searchLower) ||
        item.quantityKg?.toLowerCase().includes(searchLower)
      );
    }

    // Фильтр по типу
    if (typeFilter) {
      result = result.filter((item: any) => item.movementType === typeFilter);
    }

    // Фильтр по продукту
    if (productFilter) {
      result = result.filter((item: any) => item.productType === productFilter);
    }

    return result;
  }, [movementData?.data, search, typeFilter, productFilter]);

  const data = filteredData;
  const total = movementData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

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