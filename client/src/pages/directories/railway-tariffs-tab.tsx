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

interface RailwayTariff {
  id: string;
  zoneName: string;
  pricePerTon: string;
  isActive?: boolean;
}

interface TariffFormData {
  zoneName: string;
  pricePerTon: string;
}

function TariffDialog({
  open,
  onClose,
  tariff,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tariff?: RailwayTariff | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<TariffFormData>({
    zoneName: tariff?.zoneName || "",
    pricePerTon: tariff?.pricePerTon || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        zoneName: tariff?.zoneName || "",
        pricePerTon: tariff?.pricePerTon || "",
      });
    }
  }, [open, tariff]);

  const mutation = useMutation({
    mutationFn: async (data: TariffFormData) => {
      if (tariff) {
        return apiRequest("PATCH", `/api/railway/tariffs/${tariff.id}`, data);
      }
      return apiRequest("POST", "/api/railway/tariffs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/railway/tariffs"] });
      toast({ title: tariff ? "Тариф обновлён" : "Тариф создан" });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.zoneName.trim()) {
      toast({ title: "Введите название зоны", variant: "destructive" });
      return;
    }
    if (!form.pricePerTon || isNaN(Number(form.pricePerTon))) {
      toast({ title: "Введите корректный тариф", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tariff ? "Редактировать тариф" : "Новый тариф ЖД доставки"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zoneName">Зона / Название *</Label>
            <Input
              id="zoneName"
              data-testid="input-tariff-zone"
              value={form.zoneName}
              onChange={(e) => setForm({ ...form, zoneName: e.target.value })}
              placeholder="Например: Зона 1 — Москва"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricePerTon">Тариф (руб/тн) *</Label>
            <Input
              id="pricePerTon"
              type="number"
              step="0.01"
              data-testid="input-tariff-price"
              value={form.pricePerTon}
              onChange={(e) => setForm({ ...form, pricePerTon: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" data-testid="button-save-tariff" disabled={mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RailwayTariffsTab() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<RailwayTariff | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  const { data: tariffs = [], isLoading } = useQuery<RailwayTariff[]>({
    queryKey: ["/api/railway/tariffs", search],
    queryFn: async () => {
      const url = search ? `/api/railway/tariffs?search=${encodeURIComponent(search)}` : "/api/railway/tariffs";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Ошибка загрузки");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/railway/tariffs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/railway/tariffs"] });
      toast({ title: "Тариф удалён" });
      setDeleteOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const formatPrice = (price: string) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(Number(price));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Тарифы ЖД доставки</CardTitle>
            <CardDescription>Зоны и тарифы на цистерны по железной дороге</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
                data-testid="input-search-tariffs"
              />
            </div>
            {hasPermission("directories", "create") && (
              <Button
                onClick={() => { setEditingTariff(null); setDialogOpen(true); }}
                data-testid="button-add-tariff"
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
                <TableHead>Зона / Название</TableHead>
                <TableHead>Тариф (руб/тн)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                tariffs.map((tariff) => (
                  <TableRow key={tariff.id} data-testid={`row-tariff-${tariff.id}`}>
                    <TableCell className="font-medium">{tariff.zoneName}</TableCell>
                    <TableCell>{formatPrice(tariff.pricePerTon)}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        actions={[
                          {
                            id: "edit",
                            label: "Редактировать",
                            icon: Pencil,
                            onClick: () => { setEditingTariff(tariff); setDialogOpen(true); },
                            permission: { module: "directories", action: "edit" },
                          },
                          {
                            id: "delete",
                            label: "Удалить",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => { setToDelete({ id: tariff.id, name: tariff.zoneName }); setDeleteOpen(true); },
                            permission: { module: "directories", action: "delete" },
                            separatorAfter: true,
                          },
                        ] satisfies EntityAction[]}
                        audit={{ entityType: "railway_tariffs", entityId: tariff.id, entityName: tariff.zoneName }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TariffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tariff={editingTariff}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/railway/tariffs"] })}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => { if (toDelete) deleteMutation.mutate(toDelete.id); }}
        title="Удалить тариф"
        description={`Вы уверены, что хотите удалить тариф "${toDelete?.name}"?`}
      />

    </Card>
  );
}
