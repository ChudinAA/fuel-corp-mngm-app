import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, parseISO, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  Plus,
  Check,
  Info,
  Loader2,
} from "lucide-react";
import { DELIVERY_ENTITY_TYPE } from "@shared/constants";
import { AddDeliveryCostDialog } from "@/pages/delivery/components/delivery-cost-dialog";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  base: "Базис",
  warehouse: "Склад",
  delivery_location: "Место доставки",
};

const ENTITY_TYPES = [
  { value: DELIVERY_ENTITY_TYPE.BASE, label: "Базис" },
  { value: DELIVERY_ENTITY_TYPE.WAREHOUSE, label: "Склад" },
  { value: DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION, label: "Место доставки" },
];

const formSchema = z.object({
  transportUnitId: z.string().optional().nullable(),
  type: z.enum(["route", "deadhead", "unavailable"]),
  fromEntityType: z.string().optional().nullable(),
  fromEntityId: z.string().optional().nullable(),
  fromEntityName: z.string().optional().nullable(),
  toEntityType: z.string().optional().nullable(),
  toEntityId: z.string().optional().nullable(),
  toEntityName: z.string().optional().nullable(),
  dateStart: z.string().min(1, "Укажите дату начала"),
  dateEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isUnplanned: z.boolean().default(false),
  selectedDeliveryCostId: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

const NONE_VALUE = "__none__";

interface RoutePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  periodFrom: string;
  periodTo: string;
  units: any[];
  routes: any[];
  unassignedDemands?: any[];
}

// ─── Entity selector component ─────────────────────────────────────────────────

function EntitySelector({
  typeValue,
  onTypeChange,
  entityId,
  onEntityChange,
  bases,
  warehouses,
  deliveryLocations,
  labelPrefix,
  disabled,
}: {
  typeValue: string | null | undefined;
  onTypeChange: (t: string | null) => void;
  entityId: string | null | undefined;
  onEntityChange: (id: string | null, name: string | null) => void;
  bases: any[];
  warehouses: any[];
  deliveryLocations: any[];
  labelPrefix: string;
  disabled?: boolean;
}) {
  const entities = useMemo(() => {
    if (typeValue === DELIVERY_ENTITY_TYPE.BASE) return bases.map((b) => ({ value: b.id, label: b.name }));
    if (typeValue === DELIVERY_ENTITY_TYPE.WAREHOUSE) return warehouses.map((w) => ({ value: w.id, label: w.name }));
    if (typeValue === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION) return deliveryLocations.map((d) => ({ value: d.id, label: d.name }));
    return [];
  }, [typeValue, bases, warehouses, deliveryLocations]);

  const getName = (id: string | null | undefined) => {
    if (!id) return null;
    return entities.find((e) => e.value === id)?.label ?? null;
  };

  return (
    <div className="space-y-2">
      <Select
        value={typeValue || ""}
        onValueChange={(v) => {
          onTypeChange(v || null);
          onEntityChange(null, null);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={`${labelPrefix} (тип)`} />
        </SelectTrigger>
        <SelectContent>
          {ENTITY_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {typeValue && (
        <Combobox
          options={[{ value: "", label: "— Выберите пункт —" }, ...entities]}
          value={entityId || ""}
          onValueChange={(v) => onEntityChange(v || null, getName(v))}
          placeholder="Выберите пункт"
          disabled={disabled}
        />
      )}
    </div>
  );
}

// ─── Tariff match panel ────────────────────────────────────────────────────────

function TariffMatchPanel({
  fromEntityType,
  fromEntityId,
  toEntityType,
  toEntityId,
  allDeliveryCosts,
  carriers,
  onSelectTariff,
  selectedId,
  onInlineCreated,
}: {
  fromEntityType: string | null | undefined;
  fromEntityId: string | null | undefined;
  toEntityType: string | null | undefined;
  toEntityId: string | null | undefined;
  allDeliveryCosts: any[];
  carriers: any[];
  onSelectTariff: (id: string | null) => void;
  selectedId: string | null | undefined;
  onInlineCreated: () => void;
}) {
  const [addTariffOpen, setAddTariffOpen] = useState(false);

  const carrierById = useMemo(() => {
    const m = new Map<string, any>();
    carriers.forEach((c) => m.set(c.id, c));
    return m;
  }, [carriers]);

  const matched = useMemo(() => {
    if (!fromEntityType || !fromEntityId || !toEntityType || !toEntityId) return [];
    return allDeliveryCosts.filter(
      (dc) =>
        dc.fromEntityType === fromEntityType &&
        dc.fromEntityId === fromEntityId &&
        dc.toEntityType === toEntityType &&
        dc.toEntityId === toEntityId,
    );
  }, [fromEntityType, fromEntityId, toEntityType, toEntityId, allDeliveryCosts]);

  const ready = !!(fromEntityType && fromEntityId && toEntityType && toEntityId);

  if (!ready) return null;

  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2 space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5">
        <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
        Тарифы по выбранному маршруту
      </p>

      {matched.length === 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <Info className="h-3 w-3 shrink-0" />
            Тарифов по этому маршруту нет. Создайте тариф:
          </p>
          {!addTariffOpen ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setAddTariffOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Добавить тариф доставки
            </Button>
          ) : (
            <AddDeliveryCostDialog
              editDeliveryCost={null}
              isInline
              inlineOpen={addTariffOpen}
              onInlineOpenChange={setAddTariffOpen}
              onCreated={() => {
                setAddTariffOpen(false);
                onInlineCreated();
              }}
              prefillFromEntityType={fromEntityType}
              prefillFromEntityId={fromEntityId}
              prefillToEntityType={toEntityType}
              prefillToEntityId={toEntityId}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {matched.map((dc: any) => {
            const carrier = carrierById.get(dc.carrierId);
            const isSelected = selectedId === dc.id;
            return (
              <button
                key={dc.id}
                type="button"
                onClick={() => onSelectTariff(isSelected ? null : dc.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                  <span className="truncate font-medium">{carrier?.name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  {dc.transitDays != null && (
                    <span>{dc.transitDays} сут.</span>
                  )}
                  {dc.costPerKg && (
                    <span className="tabular-nums">
                      {parseFloat(dc.costPerKg).toFixed(4)} ₽/кг
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

export function RoutePlanDialog({
  open,
  onOpenChange,
  day,
  periodFrom,
  periodTo,
  units,
  routes,
  unassignedDemands = [],
}: RoutePlanDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [demandsExpanded, setDemandsExpanded] = useState(true);

  // Routes that include this day (dateStart..dateEnd interval)
  const dayRoutes = routes.filter((r: any) => {
    if (!r.dateStart) return false;
    try {
      const start = parseISO(r.dateStart);
      const end = r.dateEnd ? parseISO(r.dateEnd) : start;
      return day >= start && day <= end;
    } catch {
      return false;
    }
  });

  // Unassigned demands whose deliveryDeadline falls on this day
  const dayDemands = unassignedDemands.filter((d: any) => {
    if (!d.deliveryDeadline) return false;
    try {
      return isSameDay(parseISO(d.deliveryDeadline), day);
    } catch {
      return false;
    }
  });

  // ─── Reference data ─────────────────────────────────────────────────────────

  const { data: allBases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases"],
    queryFn: () => apiRequest("GET", "/api/bases").then((r) => r.json()),
    enabled: open,
  });

  const { data: warehouses = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouses"],
    queryFn: () => apiRequest("GET", "/api/warehouses").then((r) => r.json()),
    enabled: open,
  });

  const { data: deliveryLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/delivery-locations"],
    queryFn: () => apiRequest("GET", "/api/logistics/delivery-locations").then((r) => r.json()),
    enabled: open,
  });

  const { data: allDeliveryCosts = [], refetch: refetchCosts } = useQuery<any[]>({
    queryKey: ["/api/delivery-costs"],
    queryFn: () => apiRequest("GET", "/api/delivery-costs").then((r) => r.json()),
    enabled: open,
  });

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
    queryFn: () => apiRequest("GET", "/api/logistics/carriers").then((r) => r.json()),
    enabled: open,
  });

  // ─── Form ───────────────────────────────────────────────────────────────────

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transportUnitId: null,
      type: "route",
      fromEntityType: null,
      fromEntityId: null,
      fromEntityName: null,
      toEntityType: null,
      toEntityId: null,
      toEntityName: null,
      dateStart: format(day, "yyyy-MM-dd"),
      dateEnd: null,
      notes: null,
      isUnplanned: false,
      selectedDeliveryCostId: null,
    },
  });

  // Reset form every time the dialog opens on a new day
  useEffect(() => {
    if (open) {
      form.reset({
        transportUnitId: null,
        type: "route",
        fromEntityType: null,
        fromEntityId: null,
        fromEntityName: null,
        toEntityType: null,
        toEntityId: null,
        toEntityName: null,
        dateStart: format(day, "yyyy-MM-dd"),
        dateEnd: null,
        notes: null,
        isUnplanned: false,
        selectedDeliveryCostId: null,
      });
    }
  }, [open, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchFromEntityType = form.watch("fromEntityType");
  const watchFromEntityId = form.watch("fromEntityId");
  const watchToEntityType = form.watch("toEntityType");
  const watchToEntityId = form.watch("toEntityId");
  const watchSelectedCostId = form.watch("selectedDeliveryCostId");

  // Auto-fill dateEnd from selected tariff transitDays
  useEffect(() => {
    if (!watchSelectedCostId) return;
    const dc = allDeliveryCosts.find((c: any) => c.id === watchSelectedCostId);
    if (dc?.transitDays != null) {
      const start = form.getValues("dateStart");
      if (start) {
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + dc.transitDays);
        form.setValue("dateEnd", format(endDate, "yyyy-MM-dd"));
      }
    }
  }, [watchSelectedCostId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill form from an unassigned demand
  const prefillFromDemand = (demand: any) => {
    // Try to find entity types from demand data
    if (demand.fromEntityType && demand.fromEntityId) {
      form.setValue("fromEntityType", demand.fromEntityType);
      form.setValue("fromEntityId", demand.fromEntityId);
    }
    if (demand.toEntityType && demand.toEntityId) {
      form.setValue("toEntityType", demand.toEntityType);
      form.setValue("toEntityId", demand.toEntityId);
    }
    form.setValue("fromEntityName", demand.fromEntityName || null);
    form.setValue("toEntityName", demand.toEntityName || null);
    form.setValue("isUnplanned", false);
    document.getElementById("route-plan-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/routes", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      toast({ title: "Маршрут добавлен" });
      form.reset({
        transportUnitId: null,
        type: "route",
        fromEntityType: null,
        fromEntityId: null,
        fromEntityName: null,
        toEntityType: null,
        toEntityId: null,
        toEntityName: null,
        dateStart: format(day, "yyyy-MM-dd"),
        dateEnd: null,
        notes: null,
        isUnplanned: false,
        selectedDeliveryCostId: null,
      });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Ошибка создания маршрута", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logistics-plan/routes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      toast({ title: "Маршрут удалён" });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Ошибка удаления", variant: "destructive" }),
  });

  const onSubmit = (data: FormData) => {
    // Resolve entity names from entity IDs if not already set
    const resolvedFromName =
      data.fromEntityName ||
      resolveEntityName(data.fromEntityType, data.fromEntityId, allBases, warehouses, deliveryLocations);
    const resolvedToName =
      data.toEntityName ||
      resolveEntityName(data.toEntityType, data.toEntityId, allBases, warehouses, deliveryLocations);

    createMutation.mutate({
      transportUnitId:
        data.transportUnitId && data.transportUnitId !== NONE_VALUE
          ? data.transportUnitId
          : null,
      type: data.type,
      fromEntityType: data.fromEntityType || null,
      fromEntityId: data.fromEntityId || null,
      fromEntityName: resolvedFromName || null,
      toEntityType: data.toEntityType || null,
      toEntityId: data.toEntityId || null,
      toEntityName: resolvedToName || null,
      deliveryCostId: data.selectedDeliveryCostId || null,
      dateStart: new Date(data.dateStart).toISOString(),
      dateEnd: data.dateEnd ? new Date(data.dateEnd).toISOString() : null,
      notes: data.notes || null,
      isUnplanned: data.isUnplanned,
      status: "manual",
      periodFrom,
      periodTo,
    });
  };

  const watchDateEnd = form.watch("dateEnd");
  const isLateWarning = watchDateEnd && differenceInDays(new Date(watchDateEnd), day) > 0;
  const isDeadlineWarning = watchDateEnd && differenceInDays(new Date(watchDateEnd), day) === 0;

  const getRouteStatusColor = (r: any) => {
    if (r.isLate) return "destructive";
    if (r.isDeadline) return "outline";
    if (r.isUnplanned) return "secondary";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{format(day, "EEEE, d MMMM yyyy", { locale: ru })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* ── Unassigned demands for this day ── */}
          {dayDemands.length > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
                onClick={() => setDemandsExpanded((v) => !v)}
              >
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  Нераспределённые потребности: {dayDemands.length}
                </span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 ml-1">
                  (дедлайн поставки)
                </span>
                <span className="ml-auto">
                  {demandsExpanded ? (
                    <ChevronUp className="h-4 w-4 text-amber-600" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-amber-600" />
                  )}
                </span>
              </button>

              {demandsExpanded && (
                <div className="border-t border-amber-200 dark:border-amber-700 px-3 pb-3 pt-2 flex flex-col gap-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Нажмите «Заполнить», чтобы скопировать маршрут в форму ниже.
                  </p>
                  {dayDemands.map((demand: any) => (
                    <div
                      key={demand.id}
                      className="flex items-start justify-between gap-2 rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-background px-2 py-1.5"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            {demand.type === "income" ? "Приход" : "Расход"}
                          </Badge>
                          <span className="text-muted-foreground truncate">
                            {demand.fromEntityName || "—"}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">
                            {demand.toEntityName || "—"}
                          </span>
                        </div>
                        {demand.volume && (
                          <span className="text-[10px] text-muted-foreground">
                            Объём: {parseFloat(demand.volume).toLocaleString("ru-RU")} т
                          </span>
                        )}
                        {demand.missingDataReason && (
                          <span className="text-[10px] text-red-600 dark:text-red-400 flex items-start gap-1">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                            {demand.missingDataReason}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2 shrink-0"
                        onClick={() => prefillFromDemand(demand)}
                      >
                        Заполнить
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Existing routes for this day ── */}
          {dayRoutes.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Маршруты на этот день:</p>
              <div className="flex flex-col gap-2">
                {dayRoutes.map((r: any) => {
                  const unit = units.find((u: any) => u.id === r.transportUnitId);
                  return (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded-md border p-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={getRouteStatusColor(r) as any} className="text-xs">
                            {r.type === "route" ? "Маршрут" : r.type === "deadhead" ? "Прогон" : "Недоступность"}
                          </Badge>
                          {r.status === "auto" && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">авто</Badge>
                          )}
                          {r.isLate && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />Опоздание
                            </Badge>
                          )}
                          {r.isDeadline && !r.isLate && (
                            <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 dark:text-amber-400">
                              <Clock className="h-3 w-3" />Дедлайн
                            </Badge>
                          )}
                          {r.isUnplanned && (
                            <Badge variant="secondary" className="text-xs">Внеплановый</Badge>
                          )}
                          {!r.isOptimal && (
                            <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700 dark:text-yellow-400">
                              Не оптимален
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm">
                          {r.fromEntityName || "?"} → {r.toEntityName || "?"}
                        </span>
                        {unit && (
                          <span className="text-xs text-muted-foreground">
                            ТС: {unit.vehicle?.regNumber || "—"}
                            {unit.driver?.fullName ? `, ${unit.driver.fullName}` : ""}
                          </span>
                        )}
                        {r.notes && (
                          <span className="text-xs text-muted-foreground">{r.notes}</span>
                        )}
                      </div>
                      {r.status !== "auto" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 px-2 shrink-0"
                          onClick={() => deleteMutation.mutate(r.id)}
                        >
                          Удалить
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Manual add form ── */}
          <div
            id="route-plan-form"
            className={cn((dayRoutes.length > 0 || dayDemands.length > 0) && "border-t pt-4")}
          >
            <p className="text-sm font-medium mb-3">Добавить маршрут вручную:</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">

                {/* Transport unit + type */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="transportUnitId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Транспортная единица</FormLabel>
                        <Select
                          value={field.value || NONE_VALUE}
                          onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите ТС" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_VALUE}>— Не назначена —</SelectItem>
                            {units.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.vehicle?.regNumber || "—"}
                                {u.driver?.fullName ? ` / ${u.driver.fullName}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="route">Маршрут</SelectItem>
                            <SelectItem value="deadhead">Прогон</SelectItem>
                            <SelectItem value="unavailable">Недоступность</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* From / To entity selectors */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Откуда</p>
                    <EntitySelector
                      typeValue={watchFromEntityType}
                      onTypeChange={(t) => {
                        form.setValue("fromEntityType", t);
                        form.setValue("fromEntityId", null);
                        form.setValue("fromEntityName", null);
                        form.setValue("selectedDeliveryCostId", null);
                      }}
                      entityId={watchFromEntityId}
                      onEntityChange={(id, name) => {
                        form.setValue("fromEntityId", id);
                        form.setValue("fromEntityName", name);
                        form.setValue("selectedDeliveryCostId", null);
                      }}
                      bases={allBases}
                      warehouses={warehouses}
                      deliveryLocations={deliveryLocations}
                      labelPrefix="Откуда"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Куда</p>
                    <EntitySelector
                      typeValue={watchToEntityType}
                      onTypeChange={(t) => {
                        form.setValue("toEntityType", t);
                        form.setValue("toEntityId", null);
                        form.setValue("toEntityName", null);
                        form.setValue("selectedDeliveryCostId", null);
                      }}
                      entityId={watchToEntityId}
                      onEntityChange={(id, name) => {
                        form.setValue("toEntityId", id);
                        form.setValue("toEntityName", name);
                        form.setValue("selectedDeliveryCostId", null);
                      }}
                      bases={allBases}
                      warehouses={warehouses}
                      deliveryLocations={deliveryLocations}
                      labelPrefix="Куда"
                    />
                  </div>
                </div>

                {/* Tariff match panel — appears when both from/to are selected */}
                <TariffMatchPanel
                  fromEntityType={watchFromEntityType}
                  fromEntityId={watchFromEntityId}
                  toEntityType={watchToEntityType}
                  toEntityId={watchToEntityId}
                  allDeliveryCosts={allDeliveryCosts}
                  carriers={carriers}
                  onSelectTariff={(id) => form.setValue("selectedDeliveryCostId", id)}
                  selectedId={watchSelectedCostId}
                  onInlineCreated={() => refetchCosts()}
                />

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="dateStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата начала</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата окончания</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Deadline / late warnings */}
                {isLateWarning && (
                  <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Маршрут спланирован с опозданием! Дата окончания позже дедлайна поставки.
                  </div>
                )}
                {isDeadlineWarning && !isLateWarning && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    Маршрут назначен впритык к дедлайну поставки.
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Комментарий</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Комментарий к маршруту..."
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" size="sm" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Добавление...</>
                    ) : "Добавить"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function resolveEntityName(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  bases: any[],
  warehouses: any[],
  deliveryLocations: any[],
): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === DELIVERY_ENTITY_TYPE.BASE)
    return bases.find((b) => b.id === entityId)?.name ?? null;
  if (entityType === DELIVERY_ENTITY_TYPE.WAREHOUSE)
    return warehouses.find((w) => w.id === entityId)?.name ?? null;
  if (entityType === DELIVERY_ENTITY_TYPE.DELIVERY_LOCATION)
    return deliveryLocations.find((d) => d.id === entityId)?.name ?? null;
  return null;
}
