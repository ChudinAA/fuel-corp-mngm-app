import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Plus, Pencil, Trash2, ArrowRight, Truck } from "lucide-react";
import { EntityActionsMenu, type EntityAction } from "@/components/entity-actions-menu";
import { useAuth } from "@/hooks/use-auth";

interface Base {
  id: string;
  name: string;
  baseType: string;
  isActive: boolean;
}

interface BaseDeliveryTariff {
  id: string;
  fromBaseId: string | null;
  toBaseId: string | null;
  fromBase?: { id: string; name: string } | null;
  toBase?: { id: string; name: string } | null;
  pricePerTon: string;
  isActive: boolean;
}

interface TariffFormData {
  fromBaseId: string;
  toBaseId: string;
  pricePerTon: string;
}

function TariffDialog({
  open, onClose, tariff, bases, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tariff?: BaseDeliveryTariff | null;
  bases: Base[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<TariffFormData>({
    fromBaseId: tariff?.fromBaseId || "",
    toBaseId: tariff?.toBaseId || "",
    pricePerTon: tariff?.pricePerTon || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        fromBaseId: tariff?.fromBaseId || "",
        toBaseId: tariff?.toBaseId || "",
        pricePerTon: tariff?.pricePerTon || "",
      });
    }
  }, [open, tariff]);

  const mutation = useMutation({
    mutationFn: async (data: TariffFormData) => {
      const payload = {
        fromBaseId: data.fromBaseId || null,
        toBaseId: data.toBaseId || null,
        pricePerTon: data.pricePerTon,
      };
      if (tariff) {
        return apiRequest("PATCH", `/api/base-delivery-tariffs/${tariff.id}`, payload);
      }
      return apiRequest("POST", "/api/base-delivery-tariffs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-delivery-tariffs"] });
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
    if (!form.fromBaseId) {
      toast({ title: "Выберите базис отправления", variant: "destructive" });
      return;
    }
    if (!form.toBaseId) {
      toast({ title: "Выберите базис назначения", variant: "destructive" });
      return;
    }
    if (!form.pricePerTon || isNaN(Number(form.pricePerTon))) {
      toast({ title: "Введите корректный тариф", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  const activeBases = bases.filter((b) => b.isActive);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tariff ? "Редактировать тариф" : "Новый тариф доставки"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Базис отправления *</Label>
            <Select
              value={form.fromBaseId}
              onValueChange={(v) => setForm({ ...form, fromBaseId: v })}
            >
              <SelectTrigger data-testid="select-delivery-tariff-from-base">
                <SelectValue placeholder="Выберите базис..." />
              </SelectTrigger>
              <SelectContent>
                {activeBases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Базис назначения *</Label>
            <Select
              value={form.toBaseId}
              onValueChange={(v) => setForm({ ...form, toBaseId: v })}
            >
              <SelectTrigger data-testid="select-delivery-tariff-to-base">
                <SelectValue placeholder="Выберите базис..." />
              </SelectTrigger>
              <SelectContent>
                {activeBases.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pricePerTon">Тариф (руб/тн) *</Label>
            <Input
              id="pricePerTon"
              type="number"
              step="0.01"
              data-testid="input-delivery-tariff-price"
              value={form.pricePerTon}
              onChange={(e) => setForm({ ...form, pricePerTon: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" data-testid="button-save-delivery-tariff" disabled={mutation.isPending}>
              {mutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getTariffName(tariff: BaseDeliveryTariff): string {
  if (tariff.fromBase && tariff.toBase) {
    return `${tariff.fromBase.name} → ${tariff.toBase.name}`;
  }
  return "—";
}

export function BaseDeliveryTariffsTab() {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<BaseDeliveryTariff | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const { toast } = useToast();

  const { data: tariffs = [], isLoading } = useQuery<BaseDeliveryTariff[]>({
    queryKey: ["/api/base-delivery-tariffs"],
  });

  const { data: bases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/base-delivery-tariffs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/base-delivery-tariffs"] });
      toast({ title: "Тариф удалён" });
      setDeleteOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const formatPrice = (price: string) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(Number(price));

  const filteredTariffs = search
    ? tariffs.filter((t) => getTariffName(t).toLowerCase().includes(search.toLowerCase()))
    : tariffs;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Тарифы доставки (база→база)
            </CardTitle>
            <CardDescription>Тарифы на автодоставку между базисами</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-48"
                data-testid="input-search-delivery-tariffs"
              />
            </div>
            {hasPermission("directories", "create") && (
              <Button
                onClick={() => { setEditingTariff(null); setDialogOpen(true); }}
                data-testid="button-add-delivery-tariff"
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
                <TableHead>Базис отправления</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Базис назначения</TableHead>
                <TableHead>Тариф (руб/тн)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                filteredTariffs.map((tariff) => (
                  <TableRow key={tariff.id} data-testid={`row-delivery-tariff-${tariff.id}`}>
                    <TableCell className="font-medium">
                      {tariff.fromBase?.name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <ArrowRight className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      {tariff.toBase?.name || "—"}
                    </TableCell>
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
                            onClick: () => {
                              setToDelete({ id: tariff.id, name: getTariffName(tariff) });
                              setDeleteOpen(true);
                            },
                            permission: { module: "directories", action: "delete" },
                            separatorAfter: true,
                          },
                        ] satisfies EntityAction[]}
                        audit={{ entityType: "base_delivery_tariffs", entityId: tariff.id, entityName: getTariffName(tariff) }}
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
        bases={bases}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/base-delivery-tariffs"] })}
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
