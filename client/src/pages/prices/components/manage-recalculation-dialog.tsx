import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Package, Plane, Truck, Car, Download, AlertTriangle, CheckCircle, Clock, XCircle, SkipForward } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";

interface RecalculationTask {
  id: string;
  priceId: string;
  dealType: string;
  dealId: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ManageRecalculationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceId: string;
  oldPriceDisplay: string;
  newPriceDisplay: string;
  counterpartyName: string;
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  opt: "ОПТ",
  refueling: "Заправка ВС",
  movement: "Движение",
  transportation: "Перевозка",
};

const DEAL_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  opt: Package,
  refueling: Plane,
  movement: Truck,
  transportation: Car,
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; className: string }> = {
  pending: { label: "Ожидает", icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  processing: { label: "Обрабатывается", icon: Loader2, className: "text-blue-600 dark:text-blue-400" },
  done: { label: "Выполнено", icon: CheckCircle, className: "text-green-600 dark:text-green-400" },
  skipped: { label: "Пропущено", icon: SkipForward, className: "text-muted-foreground" },
  failed: { label: "Ошибка", icon: XCircle, className: "text-destructive" },
};

export function ManageRecalculationDialog({
  open,
  onOpenChange,
  priceId,
  oldPriceDisplay,
  newPriceDisplay,
  counterpartyName,
}: ManageRecalculationDialogProps) {
  const { toast } = useToast();
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);

  const { data: tasks, isLoading, refetch } = useQuery<RecalculationTask[]>({
    queryKey: [`/api/prices/${priceId}/recalculation-tasks`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/prices/${priceId}/recalculation-tasks`);
      return res.json();
    },
    enabled: open && !!priceId,
    refetchInterval: 3000,
    staleTime: 0,
  });

  // Initialize pending task checkboxes as checked
  if (tasks && !initialized) {
    const pendingIds = new Set(
      tasks.filter((t) => t.status === "pending" || t.status === "skipped").map((t) => t.id),
    );
    setSelectedTaskIds(pendingIds);
    setInitialized(true);
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setInitialized(false);
      setSelectedTaskIds(new Set());
    }
    onOpenChange(v);
  };

  const editableTasks = tasks?.filter((t) => t.status === "pending" || t.status === "skipped") || [];
  const allSelected = editableTasks.length > 0 && editableTasks.every((t) => selectedTaskIds.has(t.id));
  const someSelected = editableTasks.some((t) => selectedTaskIds.has(t.id)) && !allSelected;

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(editableTasks.map((t) => t.id)));
    }
  };

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prices/${priceId}/execute-recalculation`, {
        selectedTaskIds: Array.from(selectedTaskIds),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка запуска пересчёта");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/prices/${priceId}/recalculation-tasks`] });
      toast({ title: "Пересчёт запущен", description: "Выбранные сделки добавлены в очередь пересчёта" });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/prices/${priceId}/reject-recalculation`, {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Ошибка отката");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices/list"] });
      toast({
        title: "Изменение цены отклонено",
        description: "Цена восстановлена до предыдущего значения",
      });
      handleOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const pendingCount = tasks?.filter((t) => t.status === "pending" || t.status === "processing").length || 0;
  const doneCount = tasks?.filter((t) => t.status === "done").length || 0;
  const skippedCount = tasks?.filter((t) => t.status === "skipped").length || 0;
  const failedCount = tasks?.filter((t) => t.status === "failed").length || 0;
  const totalCount = tasks?.length || 0;

  const handleExportCsv = () => {
    if (!tasks || tasks.length === 0) return;
    const rows = tasks.map((t) => [
      DEAL_TYPE_LABELS[t.dealType] || t.dealType,
      t.dealId,
      STATUS_CONFIG[t.status]?.label || t.status,
      t.createdAt ? t.createdAt.slice(0, 10) : "",
      t.completedAt ? t.completedAt.slice(0, 10) : "",
      t.errorMessage || "",
    ]);
    const header = ["Тип сделки", "ID сделки", "Статус", "Создано", "Завершено", "Ошибка"];
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `price_recalculation_${priceId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Управление пересчётом цены</DialogTitle>
            <DialogDescription>
              Контрагент: <span className="font-medium text-foreground">{counterpartyName}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Price comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Старая цена</p>
              <p className="text-lg font-semibold text-muted-foreground line-through">{oldPriceDisplay}</p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Новая цена</p>
              <p className="text-lg font-semibold">{newPriceDisplay}</p>
            </div>
          </div>

          {/* Stats */}
          {tasks && tasks.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" /> Ожидает: {pendingCount}
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" /> Выполнено: {doneCount}
              </Badge>
              {skippedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <SkipForward className="h-3 w-3" /> Пропущено: {skippedCount}
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-destructive">
                  <XCircle className="h-3 w-3" /> Ошибок: {failedCount}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">Всего: {totalCount}</Badge>
            </div>
          )}

          {/* Tasks table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Задач пересчёта нет
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={allSelected}
                        data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                        onCheckedChange={toggleAll}
                        disabled={editableTasks.length === 0}
                        data-testid="checkbox-select-all-tasks"
                      />
                    </TableHead>
                    <TableHead>Тип сделки</TableHead>
                    <TableHead>ID сделки</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Создано</TableHead>
                    <TableHead>Завершено</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const Icon = DEAL_TYPE_ICONS[task.dealType] || Package;
                    const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.icon;
                    const isEditable = task.status === "pending" || task.status === "skipped";
                    return (
                      <TableRow
                        key={task.id}
                        className={isEditable ? "cursor-pointer" : ""}
                        onClick={() => isEditable && toggleTask(task.id)}
                        data-testid={`row-task-${task.id}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedTaskIds.has(task.id)}
                            onCheckedChange={() => isEditable && toggleTask(task.id)}
                            onClick={(e) => e.stopPropagation()}
                            disabled={!isEditable}
                            data-testid={`checkbox-task-${task.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs">{DEAL_TYPE_LABELS[task.dealType] || task.dealType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {task.dealId.slice(0, 8)}…
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 text-xs ${statusCfg.className}`}>
                            <StatusIcon className={`h-3.5 w-3.5 ${task.status === "processing" ? "animate-spin" : ""}`} />
                            {statusCfg.label}
                          </div>
                          {task.errorMessage && (
                            <p className="text-[10px] text-destructive mt-0.5 max-w-[200px] truncate" title={task.errorMessage}>
                              {task.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{task.createdAt ? task.createdAt.slice(0, 10) : "—"}</TableCell>
                        <TableCell className="text-xs">{task.completedAt ? task.completedAt.slice(0, 10) : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={!tasks || tasks.length === 0}
              data-testid="button-export-recalc-tasks"
            >
              <Download className="h-4 w-4 mr-2" />
              Экспорт CSV
            </Button>
            <Button
              variant="destructive"
              onClick={() => setRejectConfirmOpen(true)}
              disabled={rejectMutation.isPending}
              data-testid="button-reject-price-change"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Отказ изменения цены
            </Button>
            <Button
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending || selectedTaskIds.size === 0}
              data-testid="button-execute-recalculation"
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Запуск...
                </>
              ) : (
                `Подтвердить пересчёт (${selectedTaskIds.size})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={rejectConfirmOpen}
        onOpenChange={setRejectConfirmOpen}
        title="Отклонить изменение цены?"
        description="Цена будет восстановлена до предыдущего значения, а все задачи пересчёта будут удалены. Это действие нельзя отменить."
        onConfirm={() => {
          setRejectConfirmOpen(false);
          rejectMutation.mutate();
        }}
      />

    </>
  );
}
