import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { EntityActionsMenu, type EntityAction } from "@/components/entity-actions-menu";
import { useAuth } from "@/hooks/use-auth";

interface RailwayStation {
  id: string;
  name: string;
  code?: string;
  isActive?: boolean;
}

interface StationFormData {
  name: string;
  code: string;
}

function StationDialog({
  open,
  onClose,
  station,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  station?: RailwayStation | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<StationFormData>({
    name: station?.name || "",
    code: station?.code || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: station?.name || "",
        code: station?.code || "",
      });
    }
  }, [open, station]);

  const mutation = useMutation({
    mutationFn: async (data: StationFormData) => {
      if (station) {
        return apiRequest("PATCH", `/api/railway/stations/${station.id}`, data);
      }
      return apiRequest("POST", "/api/railway/stations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/railway/stations"] });
      toast({ title: station ? "Станция обновлена" : "Станция создана" });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: "Введите название станции", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{station ? "Редактировать станцию" : "Новая ЖД станция"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              data-testid="input-station-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Например: Москва-Товарная"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Код станции (макс. 6 символов)</Label>
            <Input
              id="code"
              data-testid="input-station-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.slice(0, 6) })}
              placeholder="Например: 060001"
              maxLength={6}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" data-testid="button-save-station" disabled={mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RailwayStationsTab() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<RailwayStation | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  const { data: stations = [], isLoading } = useQuery<RailwayStation[]>({
    queryKey: ["/api/railway/stations", search],
    queryFn: async () => {
      const url = search ? `/api/railway/stations?search=${encodeURIComponent(search)}` : "/api/railway/stations";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/railway/stations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/railway/stations"] });
      toast({ title: "Станция удалена" });
      setDeleteOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>ЖД Станции</CardTitle>
            <CardDescription>Справочник железнодорожных станций</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
                data-testid="input-search-stations"
              />
            </div>
            {hasPermission("directories", "create") && (
              <Button
                onClick={() => { setEditingStation(null); setDialogOpen(true); }}
                data-testid="button-add-station"
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Код</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                stations.map((station) => (
                  <TableRow key={station.id} data-testid={`row-station-${station.id}`}>
                    <TableCell className="font-medium">{station.name}</TableCell>
                    <TableCell className="text-muted-foreground">{station.code || "—"}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => { setEditingStation(station); setDialogOpen(true); },
                            permission: { module: "directories", action: "edit" },
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => { setToDelete({ id: station.id, name: station.name }); setDeleteOpen(true); },
                            permission: { module: "directories", action: "delete" },
                            separatorAfter: true,
                          },
                        ] satisfies EntityAction[]}
                        audit={{ entityType: "railway_stations", entityId: station.id, entityName: station.name }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <StationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        station={editingStation}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/railway/stations"] })}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id); }}
        title="Удалить станцию"
        description={`Вы уверены, что хотите удалить станцию "${toDelete?.name}"?`}
      />

    </Card>
  );
}
