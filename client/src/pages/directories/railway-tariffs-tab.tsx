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
import { Combobox } from "@/components/ui/combobox";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { EntityActionsMenu, type EntityAction } from "@/components/entity-actions-menu";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight } from "lucide-react";

interface RailwayStation {
  id: string;
  name: string;
  code?: string | null;
}

interface RailwayTariff {
  id: string;
  zoneName?: string | null;
  fromStationId?: string | null;
  toStationId?: string | null;
  fromStation?: RailwayStation | null;
  toStation?: RailwayStation | null;
  pricePerTon: string;
  isActive?: boolean;
}

interface TariffFormData {
  fromStationId: string;
  toStationId: string;
  pricePerTon: string;
}

function TariffDialog({
  open,
  onClose,
  tariff,
  stations,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tariff?: RailwayTariff | null;
  stations: RailwayStation[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<TariffFormData>({
    fromStationId: tariff?.fromStationId || "",
    toStationId: tariff?.toStationId || "",
    pricePerTon: tariff?.pricePerTon || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        fromStationId: tariff?.fromStationId || "",
        toStationId: tariff?.toStationId || "",
        pricePerTon: tariff?.pricePerTon || "",
      });
    }
  }, [open, tariff]);

  const mutation = useMutation({
    mutationFn: async (data: TariffFormData) => {
      const payload = {
        fromStationId: data.fromStationId || null,
        toStationId: data.toStationId || null,
        pricePerTon: data.pricePerTon,
      };
      if (tariff) {
        return apiRequest("PATCH", `/api/railway/tariffs/${tariff.id}`, payload);
      }
      return apiRequest("POST", "/api/railway/tariffs", payload);
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
    if (!form.fromStationId || !form.toStationId) {
      toast({ title: "Выберите станции отправления и назначения", variant: "destructive" });
      return;
    }
    if (!form.pricePerTon || isNaN(Number(form.pricePerTon))) {
      toast({ title: "Введите корректный тариф", variant: "destructive" });
      return;
    }
    mutation.mutate(form);
  };

  const stationOptions = stations.map((s) => ({
    value: s.id,
    label: s.name,
    render: (
      <div>
        <span>{s.name}</span>
        {s.code && <span className="ml-2 text-xs text-muted-foreground">{s.code}</span>}
      </div>
    ),
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tariff ? "Редактировать тариф" : "Новый тариф ЖД доставки"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Станция отправления *</Label>
            <Combobox
              options={stationOptions}
              value={form.fromStationId}
              onValueChange={(v) => setForm({ ...form, fromStationId: v })}
              placeholder="Выберите станцию"
              dataTestId="select-from-station"
            />
          </div>
          <div className="space-y-2">
            <Label>Станция назначения *</Label>
            <Combobox
              options={stationOptions}
              value={form.toStationId}
              onValueChange={(v) => setForm({ ...form, toStationId: v })}
              placeholder="Выберите станцию"
              dataTestId="select-to-station"
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

function getTariffLabel(tariff: RailwayTariff): string {
  if (tariff.fromStation && tariff.toStation) {
    return `${tariff.fromStation.name} → ${tariff.toStation.name}`;
  }
  return tariff.zoneName || "—";
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

  const { data: stations = [] } = useQuery<RailwayStation[]>({
    queryKey: ["/api/railway/stations"],
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

  const formatTariffPrice = (price: string) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(Number(price));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Тарифы ЖД доставки</CardTitle>
            <CardDescription>Тарифы на перевозку по парам станций</CardDescription>
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
                <TableHead>Станция отправления</TableHead>
                <TableHead className="w-6"></TableHead>
                <TableHead>Станция назначения</TableHead>
                <TableHead>Тариф (руб/тн)</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tariffs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Нет данных
                  </TableCell>
                </TableRow>
              ) : (
                tariffs.map((tariff) => {
                  const label = getTariffLabel(tariff);
                  return (
                    <TableRow key={tariff.id} data-testid={`row-tariff-${tariff.id}`}>
                      <TableCell className="font-medium">
                        {tariff.fromStation ? (
                          <div>
                            <div>{tariff.fromStation.name}</div>
                            {tariff.fromStation.code && (
                              <div className="text-xs text-muted-foreground">{tariff.fromStation.code}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{tariff.zoneName || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tariff.fromStation && tariff.toStation && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        {tariff.toStation ? (
                          <div>
                            <div>{tariff.toStation.name}</div>
                            {tariff.toStation.code && (
                              <div className="text-xs text-muted-foreground">{tariff.toStation.code}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatTariffPrice(tariff.pricePerTon)}</TableCell>
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
                              onClick: () => { setToDelete({ id: tariff.id, name: label }); setDeleteOpen(true); },
                              permission: { module: "directories", action: "delete" },
                              separatorAfter: true,
                            },
                          ] satisfies EntityAction[]}
                          audit={{ entityType: "railway_tariffs", entityId: tariff.id, entityName: label }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <TariffDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        tariff={editingTariff}
        stations={stations}
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
