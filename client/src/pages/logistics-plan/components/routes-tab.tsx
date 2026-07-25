import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreHorizontal,
  Pencil,
  History,
  ArrowRight,
  Truck,
  Check,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuditPanel } from "@/components/audit-panel";
import { RouteEditDialog } from "./route-edit-dialog";
import { cn } from "@/lib/utils";

interface RoutesTabProps {
  periodFrom: string;
  periodTo: string;
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

function PriorityBadge({ priority }: { priority: number | null | undefined }) {
  if (priority == null)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium",
        PRIORITY_VARIANTS[priority] ?? PRIORITY_VARIANTS[5],
      )}
    >
      P{priority}&nbsp;<span className="opacity-70">{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

// ─── Inline transit-days cell ─────────────────────────────────────────────────

function InlineTransitDays({
  value,
  onSave,
  pending,
}: {
  value: number | null;
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
    const parsed = draft.trim() === "" ? null : parseInt(draft, 10);
    onSave(isNaN(parsed as any) ? null : parsed);
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
      <span className="text-sm">
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
  value: number | null;
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
      <PriorityBadge priority={value} />
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

// ─── Carrier rates column ─────────────────────────────────────────────────────

function CarrierRatesCell({
  route,
  aviaserviceCarrier,
  starovoitovCarrier,
  carrierById,
}: {
  route: any;
  aviaserviceCarrier: any;
  starovoitovCarrier: any;
  carrierById: Map<string, any>;
}) {
  const formatRate = (rate: string | null | undefined) =>
    rate != null ? parseFloat(rate).toFixed(2) : "0";

  return (
    <div className="flex flex-col gap-0.5">
      {/* АвиаСервис */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded px-1 py-0.5 min-w-[24px] text-center">
          АС
        </span>
        <span className="text-xs tabular-nums">{formatRate(route.aviaserviceRate)} ₽</span>
      </div>

      {/* Старовойтов */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded px-1 py-0.5 min-w-[24px] text-center">
          СТ
        </span>
        <span className="text-xs tabular-nums">{formatRate(route.starovoitovRate)} ₽</span>
      </div>

      {/* Other carriers */}
      {route.otherCarriers?.map((r: any) => {
        const name = carrierById.get(r.carrierId)?.name ?? "—";
        const abbr = name.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 3);
        return (
          <TooltipProvider key={r.id} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default">
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 min-w-[24px] text-center">
                    {abbr}
                  </span>
                  <span className="text-xs tabular-nums">{formatRate(r.costPerKg)} ₽</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RoutesTab({ periodFrom, periodTo }: RoutesTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string | null>(null);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: routes = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/delivery-costs"],
    queryFn: () => apiRequest("GET", "/api/delivery-costs").then((r) => r.json()),
  });

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
    queryFn: () => apiRequest("GET", "/api/logistics/carriers").then((r) => r.json()),
  });

  const aviaserviceCarrier = carriers.find((c: any) =>
    c.name?.toLowerCase().includes("авиасервис"),
  );
  const starovoitovCarrier = carriers.find((c: any) =>
    c.name?.toLowerCase().includes("старовойтов"),
  );

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/delivery-costs/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Ошибка обновления", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/delivery-costs/${id}`, data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Маршрут обновлён" });
      setEditDialogOpen(false);
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Ошибка обновления", variant: "destructive" }),
  });

  // Save a field for all records in a route group
  const saveGroupField = (route: any, field: string, value: any) => {
    const ids: string[] = route.allRecords?.map((r: any) => r.id) || [route.id];
    ids.forEach((id: string) => {
      patchMutation.mutate({ id, data: { [field]: value } });
    });
  };

  const carrierById = new Map<string, any>(carriers.map((c: any) => [c.id, c]));

  const filteredRoutes = routes.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const carrierName = carrierById.get(r.carrierId)?.name ?? "";
    return (
      r.fromLocation?.toLowerCase().includes(q) ||
      r.toLocation?.toLowerCase().includes(q) ||
      carrierName.toLowerCase().includes(q)
    );
  });

  // Group by from+to entity pair
  const groupedByRoute = new Map<string, any[]>();
  filteredRoutes.forEach((r: any) => {
    const key = `${r.fromEntityId}:${r.toEntityId}`;
    if (!groupedByRoute.has(key)) groupedByRoute.set(key, []);
    groupedByRoute.get(key)!.push(r);
  });

  const uniqueRoutes: any[] = [];
  groupedByRoute.forEach((group) => {
    const base = group[0];
    const aviaserviceRate = aviaserviceCarrier
      ? group.find((r: any) => r.carrierId === aviaserviceCarrier.id)?.costPerKg
      : null;
    const starovoitovRate = starovoitovCarrier
      ? group.find((r: any) => r.carrierId === starovoitovCarrier.id)?.costPerKg
      : null;
    const otherCarriers = group.filter(
      (r: any) =>
        r.carrierId !== aviaserviceCarrier?.id &&
        r.carrierId !== starovoitovCarrier?.id,
    );
    uniqueRoutes.push({
      ...base,
      aviaserviceRate,
      starovoitovRate,
      otherCarriers,
      allRecords: group,
    });
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            Маршруты из справочника Доставка — тарифы, сутки пути и приоритет
          </p>
          <Input
            placeholder="Поиск маршрута..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
            data-testid="input-search-routes"
          />
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Маршрут</TableHead>
                <TableHead className="min-w-[80px]">Расст., км</TableHead>
                <TableHead className="min-w-[120px]">Сутки пути</TableHead>
                <TableHead className="min-w-[200px]">Тарифная ставка перевозчиков</TableHead>
                <TableHead className="min-w-[160px]">Приоритет</TableHead>
                <TableHead className="sticky right-0 bg-background z-10 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : uniqueRoutes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Нет маршрутов
                  </TableCell>
                </TableRow>
              ) : (
                uniqueRoutes.map((route: any) => (
                  <TableRow
                    key={`${route.fromEntityId}:${route.toEntityId}`}
                    data-testid={`row-route-${route.id}`}
                  >
                    {/* Route */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        <span>{route.fromLocation}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{route.toLocation}</span>
                      </div>
                    </TableCell>

                    {/* Distance */}
                    <TableCell>
                      {route.distance ? (
                        <span className="text-sm tabular-nums">
                          {parseFloat(route.distance).toLocaleString("ru")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Transit days — inline editable */}
                    <TableCell>
                      <InlineTransitDays
                        value={route.transitDays}
                        pending={patchMutation.isPending}
                        onSave={(v) => saveGroupField(route, "transitDays", v)}
                      />
                    </TableCell>

                    {/* Carrier rates — unified column */}
                    <TableCell>
                      <CarrierRatesCell
                        route={route}
                        aviaserviceCarrier={aviaserviceCarrier}
                        starovoitovCarrier={starovoitovCarrier}
                        carrierById={carrierById}
                      />
                    </TableCell>

                    {/* Priority — inline editable */}
                    <TableCell>
                      <InlinePriority
                        value={route.priority}
                        pending={patchMutation.isPending}
                        onSave={(v) => saveGroupField(route, "priority", v)}
                      />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="sticky right-0 bg-background z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`menu-route-${route.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingRoute(route);
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setAuditEntityId(route.id);
                              setAuditOpen(true);
                            }}
                          >
                            <History className="h-4 w-4 mr-2" />
                            История изменений
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {editingRoute && (
          <RouteEditDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            route={editingRoute}
            onSave={(id, data) => updateMutation.mutate({ id, data })}
            isPending={updateMutation.isPending}
          />
        )}

        {auditEntityId && (
          <AuditPanel
            open={auditOpen}
            onOpenChange={setAuditOpen}
            entityType="delivery_cost"
            entityId={auditEntityId}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
