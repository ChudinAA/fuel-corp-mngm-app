import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  ExternalLink,
} from "lucide-react";

const formSchema = z.object({
  transportUnitId: z.string().optional().nullable(),
  type: z.enum(["route", "deadhead", "unavailable"]),
  fromEntityName: z.string().optional().nullable(),
  toEntityName: z.string().optional().nullable(),
  dateStart: z.string().min(1, "Укажите дату начала"),
  dateEnd: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  isUnplanned: z.boolean().default(false),
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

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transportUnitId: null,
      type: "route",
      fromEntityName: null,
      toEntityName: null,
      dateStart: format(day, "yyyy-MM-dd"),
      dateEnd: null,
      notes: null,
      isUnplanned: false,
    },
  });

  // Pre-fill form from an unassigned demand
  const prefillFromDemand = (demand: any) => {
    form.setValue("fromEntityName", demand.fromEntityName || null);
    form.setValue("toEntityName", demand.toEntityName || null);
    form.setValue("isUnplanned", false);
    // Scroll form into view
    document.getElementById("route-plan-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/routes", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      toast({ title: "Маршрут добавлен" });
      form.reset({
        transportUnitId: null,
        type: "route",
        fromEntityName: null,
        toEntityName: null,
        dateStart: format(day, "yyyy-MM-dd"),
        dateEnd: null,
        notes: null,
        isUnplanned: false,
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
    createMutation.mutate({
      transportUnitId:
        data.transportUnitId && data.transportUnitId !== NONE_VALUE
          ? data.transportUnitId
          : null,
      type: data.type,
      fromEntityName: data.fromEntityName || null,
      toEntityName: data.toEntityName || null,
      dateStart: new Date(data.dateStart).toISOString(),
      dateEnd: data.dateEnd ? new Date(data.dateEnd).toISOString() : null,
      notes: data.notes || null,
      isUnplanned: data.isUnplanned,
      status: "manual",
      periodFrom,
      periodTo,
    });
  };

  // Warn if dateEnd is beyond day's deadline or already late
  const watchDateEnd = form.watch("dateEnd");
  const isLateWarning =
    watchDateEnd && differenceInDays(new Date(watchDateEnd), day) > 0;
  const isDeadlineWarning =
    watchDateEnd && differenceInDays(new Date(watchDateEnd), day) === 0;

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
                      className="flex items-center justify-between gap-2 rounded border border-amber-200 dark:border-amber-700 bg-white dark:bg-background px-2 py-1.5"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 h-4"
                          >
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
                        <span className="text-[10px] text-muted-foreground">
                          Объём:{" "}
                          {demand.volume
                            ? parseFloat(demand.volume).toLocaleString("ru-RU")
                            : "—"}{" "}
                          т
                        </span>
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
                          <Badge
                            variant={getRouteStatusColor(r) as any}
                            className="text-xs"
                          >
                            {r.type === "route"
                              ? "Маршрут"
                              : r.type === "deadhead"
                              ? "Прогон"
                              : "Недоступность"}
                          </Badge>
                          {r.status === "auto" && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                              авто
                            </Badge>
                          )}
                          {r.isLate && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Опоздание
                            </Badge>
                          )}
                          {r.isDeadline && !r.isLate && (
                            <Badge
                              variant="outline"
                              className="text-xs gap-1 border-amber-300 text-amber-700 dark:text-amber-400"
                            >
                              <Clock className="h-3 w-3" />
                              Дедлайн
                            </Badge>
                          )}
                          {r.isUnplanned && (
                            <Badge variant="secondary" className="text-xs">
                              Внеплановый
                            </Badge>
                          )}
                          {!r.isOptimal && (
                            <Badge
                              variant="outline"
                              className="text-xs border-yellow-300 text-yellow-700 dark:text-yellow-400"
                            >
                              Не оптимален
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm">
                          {r.fromEntityName || "?"} → {r.toEntityName || "?"}
                        </span>
                        {unit && (
                          <span className="text-xs text-muted-foreground">
                            ТС:{" "}
                            {unit.vehicle?.regNumber || "—"}
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
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="transportUnitId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Транспортная единица</FormLabel>
                        <Select
                          value={field.value || NONE_VALUE}
                          onValueChange={(v) =>
                            field.onChange(v === NONE_VALUE ? null : v)
                          }
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
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
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

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="fromEntityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Откуда</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Начальная точка"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toEntityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Куда</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Конечная точка"
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

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    Маршрут не найден в тарифах?{" "}
                    <a
                      href="/delivery"
                      className="inline-flex items-center gap-0.5 underline text-primary"
                    >
                      Добавить тариф
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Добавление..." : "Добавить"}
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
