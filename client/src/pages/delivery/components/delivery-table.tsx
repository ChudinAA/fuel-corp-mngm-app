import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Truck, Pencil, Trash2, Droplets, Fuel, Warehouse, MapPin, Check, X } from "lucide-react";
import { EntityActionsMenu, EntityAction } from "@/components/entity-actions-menu";
import type { DeliveryCost } from "@shared/schema";
import { formatNumber } from "../utils";
import { BASE_TYPE, DELIVERY_ENTITY_TYPE } from "@shared/constants";
import { cn } from "@/lib/utils";

interface DeliveryTableProps {
  costs: DeliveryCost[];
  isLoading: boolean;
  getCarrierName: (carrierId: string) => string;
  onEdit: (cost: DeliveryCost) => void;
  bases?: any[];
}

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  1: "Высший",
  2: "Высокий",
  3: "Средний",
  4: "Низкий",
  5: "Минимальный",
};

const PRIORITY_VARIANTS: Record<number, string> = {
  1: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300",
  2: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300",
  3: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300",
  4: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300",
  5: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400",
};

// ─── Inline transit-days cell ─────────────────────────────────────────────────

function InlineTransitDays({
  value,
  onSave,
  pending,
}: {
  value: number | null | undefined;
  onSave: (v: number | null) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const raw = draft.trim();
    const parsed = raw === "" ? null : parseInt(raw, 10);
    onSave(parsed === null || isNaN(parsed) ? null : parsed);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          type="number"
          min="0"
          className="h-7 w-16 text-xs px-2"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
        />
        <button
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
          onMouseDown={(e) => { e.preventDefault(); commit(); }}
        >
          <Check className="h-3 w-3 text-green-600" />
        </button>
        <button
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
          onMouseDown={(e) => { e.preventDefault(); cancel(); }}
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/cell">
      <span className="text-sm tabular-nums">
        {value != null ? value : <span className="text-muted-foreground">—</span>}
      </span>
      <button
        className="opacity-0 group-hover/cell:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-opacity"
        onClick={startEdit}
        disabled={pending}
        title="Редактировать сутки пути"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Inline priority cell ─────────────────────────────────────────────────────

function InlinePriority({
  value,
  onSave,
  pending,
}: {
  value: number | null | undefined;
  onSave: (v: number | null) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Select
        open
        value={value != null ? String(value) : "none"}
        onValueChange={(v) => {
          onSave(v === "none" ? null : parseInt(v, 10));
          setEditing(false);
        }}
        onOpenChange={(open) => { if (!open) setEditing(false); }}
      >
        <SelectTrigger className="h-7 w-32 text-xs">
          <SelectValue placeholder="Выбрать" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— Не задан —</SelectItem>
          {[1, 2, 3, 4, 5].map((p) => (
            <SelectItem key={p} value={String(p)}>
              P{p} — {PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-1 group/cell">
      {value != null ? (
        <span
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
            PRIORITY_VARIANTS[value] ?? PRIORITY_VARIANTS[5],
          )}
        >
          P{value}&nbsp;<span className="opacity-70">{PRIORITY_LABELS[value]}</span>
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      )}
      <button
        className="opacity-0 group-hover/cell:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted transition-opacity"
        onClick={() => setEditing(true)}
        disabled={pending}
        title="Редактировать приоритет"
      >
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function DeliveryTable({ costs, isLoading, getCarrierName, onEdit, bases = [] }: DeliveryTableProps) {
  const { toast } = useToast();
  const { showError, ErrorModalComponent } = useErrorModal();
  const { hasPermission } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [costToDelete, setCostToDelete] = useState<DeliveryCost | null>(null);

  const getEntityIcon = (entityType: string, entityId: string) => {
    switch (entityType) {
      case DELIVERY_ENTITY_TYPE.BASE:
        const base = bases.find((b: any) => b.id === entityId);
        if (base?.baseType === BASE_TYPE.REFUELING) {
          return { icon: Fuel, color: "text-green-400", label: "Базис (Заправка)" };
        }
        return { icon: Droplets, color: "text-orange-400", label: "Базис (ОПТ)" };
      case DELIVERY_ENTITY_TYPE.WAREHOUSE:
        return { icon: Warehouse, color: "text-sky-400", label: "Склад" };
      case DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION:
        return { icon: MapPin, color: "text-purple-400", label: "Место доставки" };
      default:
        return { icon: MapPin, color: "text-gray-400", label: "Неизвестно" };
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/delivery-costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      showError("Не удалось удалить тариф");
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/delivery-costs/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
    },
    onError: () => {
      showError("Не удалось сохранить изменения");
    },
  });

  const saveField = (id: string, field: string, value: any) => {
    patchMutation.mutate({ id, data: { [field]: value } });
  };

  return (
    <>
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Перевозчик</TableHead>
            <TableHead>Маршрут</TableHead>
            <TableHead className="text-right">За кг (₽)</TableHead>
            <TableHead className="text-right">Расст. (км)</TableHead>
            <TableHead>Сутки</TableHead>
            <TableHead>Приоритет</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
            ))
          ) : costs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Нет тарифов для отображения
              </TableCell>
            </TableRow>
          ) : (
            costs.map((cost) => {
              const fromEntityIcon = getEntityIcon(cost.fromEntityType, cost.fromEntityId);
              const toEntityIcon = getEntityIcon(cost.toEntityType, cost.toEntityId);
              const FromIcon = fromEntityIcon.icon;
              const ToIcon = toEntityIcon.icon;

              return (
                <TableRow key={cost.id}>
                  <TableCell>{getCarrierName(cost.carrierId)}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <FromIcon className={`h-3.5 w-3.5 ${fromEntityIcon.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{fromEntityIcon.label}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span>{cost.fromLocation}</span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ToIcon className={`h-3.5 w-3.5 ${toEntityIcon.color}`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{toEntityIcon.label}</p>
                            </TooltipContent>
                          </Tooltip>
                          <span>{cost.toLocation}</span>
                        </div>
                      </div>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatNumber(cost.costPerKg)} ₽
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {cost.distance ? formatNumber(cost.distance) : "—"}
                  </TableCell>

                  {/* Сутки — inline editable */}
                  <TableCell>
                    <InlineTransitDays
                      value={(cost as any).transitDays}
                      pending={patchMutation.isPending}
                      onSave={(v) => saveField(cost.id, "transitDays", v)}
                    />
                  </TableCell>

                  {/* Приоритет — inline editable */}
                  <TableCell>
                    <InlinePriority
                      value={(cost as any).priority}
                      pending={patchMutation.isPending}
                      onSave={(v) => saveField(cost.id, "priority", v)}
                    />
                  </TableCell>

                  <TableCell>
                    <EntityActionsMenu
                      actions={[
                        {
                          id: "edit",
                          label: "Редактировать",
                          icon: Pencil,
                          onClick: () => onEdit(cost),
                          permission: { module: "delivery", action: "edit" },
                        },
                        {
                          id: "delete",
                          label: "Удалить",
                          icon: Trash2,
                          onClick: () => {
                            setCostToDelete(cost);
                            setDeleteDialogOpen(true);
                          },
                          variant: "destructive" as const,
                          permission: { module: "delivery", action: "delete" },
                          separatorAfter: true,
                        },
                      ]}
                      audit={{
                        entityType: "delivery",
                        entityId: cost.id,
                        entityName: `${cost.fromLocation} → ${cost.toLocation}`,
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (costToDelete) {
            deleteMutation.mutate(costToDelete.id);
          }
          setDeleteDialogOpen(false);
          setCostToDelete(null);
        }}
        title="Удалить тариф?"
        description="Вы уверены, что хотите удалить этот тариф доставки? Это действие нельзя отменить."
      />
    </div>
    <ErrorModalComponent />
    </>
  );
}
