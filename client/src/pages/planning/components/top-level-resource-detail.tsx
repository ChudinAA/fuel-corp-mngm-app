import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { fmtTons } from "../utils/planning-utils";
import type { PlanningPeriod } from "../planning-page";

interface TopLevelVolume {
  id: string;
  supplierId: string;
  warehouseId: string;
  warehouseName?: string;
  periodFrom: string;
  periodTo: string;
  type: string;
  volume: string;
  counterpartyId?: string | null;
  counterpartyName?: string | null;
  notes?: string | null;
}

interface Warehouse {
  id: string;
  name: string;
}

interface TopLevelResourceDetailProps {
  supplierId: string;
  supplierName: string;
  period: PlanningPeriod;
  scenarioId: string | null;
  onClose: () => void;
}

export function TopLevelResourceDetail({
  supplierId,
  supplierName,
  period,
  scenarioId,
  onClose,
}: TopLevelResourceDetailProps) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const canManage = hasPermission("planning", "allocate");

  const periodFrom = format(period.from, "yyyy-MM-dd");
  const periodTo = format(period.to, "yyyy-MM-dd");

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formWarehouseId, setFormWarehouseId] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [formVolume, setFormVolume] = useState("");
  const [formCounterpartyId, setFormCounterpartyId] = useState("");

  const { data: volumes = [], isLoading } = useQuery<TopLevelVolume[]>({
    queryKey: ["/api/planning/top-level-volumes", supplierId, periodFrom, periodTo, scenarioId],
    queryFn: async () => {
      const params = new URLSearchParams({
        supplierId,
        periodFrom,
        periodTo,
        ...(scenarioId ? { scenarioId } : {}),
      });
      return (await apiRequest("GET", `/api/planning/top-level-volumes?${params}`)).json();
    },
  });

  const { data: warehouses = [] } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
    queryFn: async () => (await apiRequest("GET", "/api/warehouses")).json(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/planning/top-level-volumes", {
        supplierId,
        warehouseId: formWarehouseId,
        periodFrom: period.from.toISOString(),
        periodTo: period.to.toISOString(),
        type: formType,
        volume: formVolume,
        counterpartyId: formCounterpartyId || null,
        scenarioId: scenarioId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Объём добавлен" });
      setAddOpen(false);
      setFormWarehouseId("");
      setFormVolume("");
      setFormCounterpartyId("");
      setFormType("income");
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/planning/top-level-volumes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/planning/top-level-volumes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/planning/summary/resources"] });
      toast({ title: "Запись удалена" });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const totalIncome = volumes.filter((v) => v.type === "income").reduce((s, v) => s + parseFloat(v.volume || "0"), 0);
  const totalExpense = volumes.filter((v) => v.type === "expense").reduce((s, v) => s + parseFloat(v.volume || "0"), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-medium">{supplierName}</p>
          <p className="text-xs text-muted-foreground">Верхнеуровневое планирование</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-600">
            <TrendingDown className="h-3 w-3" />
            Приход: {fmtTons(totalIncome.toFixed(2))} т
          </Badge>
          <Badge variant="outline" className="gap-1 text-amber-600">
            <TrendingUp className="h-3 w-3" />
            Расход: {fmtTons(totalExpense.toFixed(2))} т
          </Badge>
          {canManage && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              data-testid="button-add-top-level-volume"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Добавить
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Склад</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Объём (т)</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : volumes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                  Нет верхнеуровневых записей. Нажмите «Добавить» чтобы начать.
                </TableCell>
              </TableRow>
            ) : (
              volumes.map((v) => (
                <TableRow key={v.id} data-testid={`row-top-level-${v.id}`}>
                  <TableCell className="font-medium">{v.warehouseName || "—"}</TableCell>
                  <TableCell>
                    {v.type === "income" ? (
                      <Badge variant="outline" className="text-emerald-600 gap-1 text-xs">
                        <TrendingDown className="h-3 w-3" />
                        Приход
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 gap-1 text-xs">
                        <TrendingUp className="h-3 w-3" />
                        Расход
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{fmtTons(v.volume)} т</TableCell>
                  <TableCell className="text-muted-foreground">{v.counterpartyName || "—"}</TableCell>
                  <TableCell>
                    {canManage && (
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => setDeleteId(v.id)}
                        title="Удалить"
                        data-testid={`button-delete-top-level-${v.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить верхнеуровневый объём</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Склад</Label>
              <Select value={formWarehouseId} onValueChange={setFormWarehouseId}>
                <SelectTrigger data-testid="select-top-level-warehouse">
                  <SelectValue placeholder="Выберите склад" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Тип</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as "income" | "expense")}>
                <SelectTrigger data-testid="select-top-level-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Приход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Объём (т)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formVolume}
                onChange={(e) => setFormVolume(e.target.value)}
                placeholder="0.00"
                data-testid="input-top-level-volume"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formWarehouseId || !formVolume || createMutation.isPending}
              data-testid="button-confirm-top-level-volume"
            >
              {createMutation.isPending ? "Сохранение..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Верхнеуровневый объём будет удалён.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
