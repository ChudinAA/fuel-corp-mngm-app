import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import type { Movement, Warehouse, DirectoryWholesale, DirectoryLogistics } from "@shared/schema";
import { MovementDialog } from "./movement/components/movement-dialog";
import { MovementTable } from "./movement/components/movement-table";

export default function MovementPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingMovement, setEditingMovement] = useState<Movement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const pageSize = 10;

  const { data: warehouses } = useQuery<Warehouse[]>({ queryKey: ["/api/warehouses"] });
  const { data: suppliers } = useQuery<DirectoryWholesale[]>({ queryKey: ["/api/directories/wholesale", "supplier"] });
  const { data: carriers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "carrier"] });
  const { data: vehicles } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "vehicle"] });
  const { data: trailers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "trailer"] });
  const { data: drivers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "driver"] });

  const { data: movements, isLoading } = useQuery<{ data: Movement[]; total: number }>({
    queryKey: ["/api/movement", page, search],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/movement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Перемещение удалено", description: "Запись успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const data = movements?.data || [];
  const total = movements?.total || 0;
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
        suppliers={suppliers || []}
        carriers={carriers || []}
        vehicles={vehicles || []}
        trailers={trailers || []}
        drivers={drivers || []}
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
                <p className="text-sm text-muted-foreground">Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm">{page} / {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}