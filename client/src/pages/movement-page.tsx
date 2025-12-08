
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import type { Movement, Warehouse } from "@shared/schema";
import { MovementDialog } from "./movement/components/movement-dialog";
import { MovementTable } from "./movement/components/movement-table";
import type { AllSupplier } from "./movement/types";

export default function MovementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const pageSize = 10;

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

  const { data: wholesaleSuppliers } = useQuery({
    queryKey: ["/api/wholesale/suppliers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/wholesale/suppliers");
      return res.json();
    },
  });

  const { data: refuelingProviders } = useQuery({
    queryKey: ["/api/refueling/providers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/refueling/providers");
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

  const { data: vehicles } = useQuery({
    queryKey: ["/api/logistics/vehicles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/logistics/vehicles");
      return res.json();
    },
  });

  const { data: trailers } = useQuery({
    queryKey: ["/api/logistics/trailers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/logistics/trailers");
      return res.json();
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["/api/logistics/drivers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/logistics/drivers");
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

  const allSuppliers: AllSupplier[] = [
    ...(wholesaleSuppliers || []).map((s: any) => ({ ...s, type: 'wholesale' as const })),
    ...(refuelingProviders || []).map((p: any) => ({ ...p, type: 'refueling' as const })),
  ];

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

  const data = movementData?.data || [];
  const total = movementData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleEditClick = (movement: Movement) => {
    setEditingMovement(movement);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMovement(null);
  };

  const handleOpenDialog = () => {
    setEditingMovement(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Перемещение</h1>
          <p className="text-muted-foreground">Учет поставок и внутренних перемещений топлива</p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-movement">
          <Plus className="mr-2 h-4 w-4" />
          Новое перемещение
        </Button>
      </div>

      <MovementDialog
        warehouses={warehouses || []}
        suppliers={allSuppliers}
        carriers={carriers || []}
        vehicles={vehicles || []}
        trailers={trailers || []}
        drivers={drivers || []}
        prices={prices || []}
        deliveryCosts={deliveryCosts || []}
        editMovement={editingMovement}
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleCloseDialog()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список перемещений</CardTitle>
          <CardDescription>История поставок и внутренних перемещений</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-movement" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>

            <div className="border rounded-lg">
              <MovementTable
                data={data}
                isLoading={isLoading}
                onEdit={handleEditClick}
                onDelete={(id) => deleteMutation.mutate(id)}
                isDeleting={deleteMutation.isPending}
              />
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Показаны {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} из {total}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
