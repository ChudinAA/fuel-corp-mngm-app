import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  eachWeekOfInterval,
  format,
  isSameDay,
  startOfWeek,
  addDays,
  parseISO,
  isWithinInterval,
  addWeeks,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  LayoutGrid,
  CheckCircle,
  CheckCircle2,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Truck,
  User,
  MapPin,
  Wrench,
  ArrowRight,
  RefreshCw,
  Package,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoutePlanDialog } from "./route-plan-dialog";
import { SyncStatusBanner } from "./sync-status-banner";
import { useToast } from "@/hooks/use-toast";

interface PlanningTabProps {
  periodFrom: string;
  periodTo: string;
}

type ViewMode = "week" | "month";

// ─── helpers ─────────────────────────────────────────────────────────────────

const WEEK_DAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getRouteStatusMeta(route: any) {
  if (route.type === "unavailable")
    return {
      bg: "bg-gray-100 dark:bg-gray-800",
      border: "border-gray-300 dark:border-gray-600",
      dot: "bg-gray-400",
      label: "Ремонт/ТО",
    };
  if (route.isLate)
    return {
      bg: "bg-red-100 dark:bg-red-900/40",
      border: "border-red-400 dark:border-red-600",
      dot: "bg-red-500",
      label: "С опозданием",
    };
  if (route.isDeadline)
    return {
      bg: "bg-amber-100 dark:bg-amber-900/40",
      border: "border-amber-400 dark:border-amber-600",
      dot: "bg-amber-500",
      label: "Дедлайн",
    };
  if (route.isUnplanned)
    return {
      bg: "bg-purple-100 dark:bg-purple-900/40",
      border: "border-purple-400 dark:border-purple-600",
      dot: "bg-purple-500",
      label: "Внеплановый",
    };
  if (!route.isOptimal)
    return {
      bg: "bg-yellow-100 dark:bg-yellow-900/40",
      border: "border-yellow-400 dark:border-yellow-600",
      dot: "bg-yellow-500",
      label: "Не оптимален",
    };
  if (route.type === "deadhead")
    return {
      bg: "bg-blue-100 dark:bg-blue-900/40",
      border: "border-blue-400 dark:border-blue-600",
      dot: "bg-blue-500",
      label: "Прогон",
    };
  return {
    bg: "bg-green-100 dark:bg-green-900/40",
    border: "border-green-400 dark:border-green-600",
    dot: "bg-green-500",
    label: "Маршрут",
  };
}

function RouteTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "deadhead") return <RefreshCw className={cn("h-3 w-3", className)} />;
  if (type === "unavailable") return <Wrench className={cn("h-3 w-3", className)} />;
  return <ArrowRight className={cn("h-3 w-3", className)} />;
}

function getNotifIcon(type: string) {
  if (type === "deadline" || type === "late")
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  if (type === "unassigned")
    return <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  if (type === "unplanned")
    return <AlertTriangle className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
  return <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function routeShortLabel(route: any) {
  if (route.type === "deadhead") return "Прогон";
  if (route.type === "unavailable") return "Ремонт";
  const from = route.fromEntityName?.split(" ")[0] || "?";
  const to = route.toEntityName?.split(" ")[0] || "?";
  return `${from}→${to}`;
}

function RouteTooltipContent({ route, unit }: { route: any; unit?: any }) {
  const meta = getRouteStatusMeta(route);
  return (
    <div className="flex flex-col gap-1.5 min-w-[180px] max-w-[260px] text-xs">
      <div className="flex items-center gap-1.5 font-medium">
        <span className={cn("inline-block w-2 h-2 rounded-full shrink-0", meta.dot)} />
        {meta.label}
        {route.priority != null && (
          <Badge variant="outline" className="ml-auto text-[10px] py-0 px-1 h-4">
            P{route.priority}
          </Badge>
        )}
      </div>
      {route.type !== "unavailable" && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>
            {route.fromEntityName || "—"} → {route.toEntityName || "—"}
          </span>
        </div>
      )}
      {unit?.vehicle && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <Truck className="h-3 w-3 shrink-0" />
          <span>
            {unit.vehicle.regNumber}
            {unit.vehicle.model ? ` (${unit.vehicle.model})` : ""}
          </span>
        </div>
      )}
      {unit?.driver && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span>{unit.driver.fullName}</span>
        </div>
      )}
      {route.dateStart && (
        <div className="flex items-center gap-1 text-muted-foreground">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>
            {format(parseISO(route.dateStart), "dd.MM")}
            {route.dateEnd && route.dateEnd !== route.dateStart
              ? ` — ${format(parseISO(route.dateEnd), "dd.MM")}`
              : ""}
          </span>
        </div>
      )}
      {route.notes && (
        <p className="text-muted-foreground border-t pt-1 mt-0.5">{route.notes}</p>
      )}
    </div>
  );
}

// ─── compact route pill ───────────────────────────────────────────────────────

function RoutePill({
  route,
  unit,
  compact = false,
}: {
  route: any;
  unit?: any;
  compact?: boolean;
}) {
  const meta = getRouteStatusMeta(route);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1 rounded border leading-none cursor-default select-none",
            compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-1 text-xs",
            meta.bg,
            meta.border,
          )}
        >
          <RouteTypeIcon
            type={route.type}
            className={cn("shrink-0 opacity-70", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
          />
          <span className="truncate max-w-[80px]">{routeShortLabel(route)}</span>
          {route.isLate && (
            <AlertTriangle className="h-2.5 w-2.5 text-red-600 shrink-0" />
          )}
          {route.isDeadline && !route.isLate && (
            <Clock className="h-2.5 w-2.5 text-amber-600 shrink-0" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-background border shadow-lg p-2">
        <RouteTooltipContent route={route} unit={unit} />
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Unassigned badge (replaces the old tiny dot) ────────────────────────────

function UnassignedBadge({ count, demands }: { count: number; demands: any[] }) {
  const tooltipContent = (
    <div className="flex flex-col gap-1 text-xs max-w-[220px]">
      <p className="font-semibold text-red-600 dark:text-red-400">
        {count} нераспределённых {count === 1 ? "маршрут" : "маршрута/маршрутов"}
      </p>
      <p className="text-muted-foreground">
        Системе не удалось автоматически назначить транспорт. Возможные причины:
      </p>
      <ul className="list-disc pl-3 space-y-0.5 text-muted-foreground">
        <li>Нет доступного транспорта/водителей</li>
        <li>Не настроены тарифы для маршрута</li>
        <li>Все ТС заняты в этот период</li>
      </ul>
      <p className="text-muted-foreground border-t pt-1 mt-0.5">
        Нажмите на день для ручного распределения.
      </p>
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500 text-white text-[10px] font-semibold leading-none cursor-help">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-background border shadow-lg p-2">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function CalendarLegend() {
  const items = [
    { dot: "bg-green-500", label: "Маршрут (норм.)", Icon: ArrowRight },
    { dot: "bg-blue-500", label: "Прогон", Icon: RefreshCw },
    { dot: "bg-amber-500", label: "Дедлайн", Icon: Clock },
    { dot: "bg-red-500", label: "С опозданием", Icon: AlertTriangle },
    { dot: "bg-purple-500", label: "Внеплановый", Icon: AlertTriangle },
    { dot: "bg-yellow-500", label: "Не оптимален", Icon: null },
    { dot: "bg-gray-400", label: "Ремонт/ТО", Icon: Wrench },
  ];
  return (
    <div className="flex flex-wrap gap-3 py-2 text-[11px] text-muted-foreground">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span className={cn("w-2 h-2 rounded-full shrink-0", item.dot)} />
          {item.Icon && <item.Icon className="h-2.5 w-2.5 opacity-60" />}
          {item.label}
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500 text-white text-[9px] font-semibold leading-none">
          <AlertTriangle className="h-2 w-2" />
          N
        </span>
        <span>Нераспределённые</span>
      </div>
    </div>
  );
}

// ─── Summary panel ────────────────────────────────────────────────────────────

type SummaryCardKey = "routes" | "unassigned" | "deadline" | "unavailable";

function SummaryCard({
  icon,
  label,
  value,
  variant,
  hint,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  variant: "ok" | "warn" | "danger" | "neutral";
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const colors = {
    ok: "text-green-700 dark:text-green-400",
    warn: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
    neutral: "text-foreground",
  };
  const bgColors = {
    ok: "",
    warn: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800",
    danger: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    neutral: "",
  };

  const card = (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={cn(
        "flex flex-col gap-0.5 rounded-md border px-3 py-2 transition-colors",
        bgColors[variant] || "border-border",
        onClick && "cursor-pointer hover:bg-muted/50",
        active && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <div className={cn("flex items-center gap-1.5 text-[11px] text-muted-foreground")}>
        <span className={cn(variant !== "neutral" && value > 0 ? colors[variant] : "")}>
          {icon}
        </span>
        {label}
      </div>
      <div className={cn("text-xl font-bold leading-none", variant !== "neutral" && value > 0 ? colors[variant] : "text-foreground")}>
        {value}
      </div>
    </div>
  );

  if (hint && !onClick) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-xs">{hint}</TooltipContent>
      </Tooltip>
    );
  }
  return card;
}

const SUMMARY_SCHEDULE_TYPE_OPTIONS = [
  { value: "unavailable", label: "Недоступен" },
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "day_off", label: "Выходной" },
  { value: "training", label: "Обучение" },
  { value: "available", label: "Доступен" },
];
const SUMMARY_EXTRA_SCHEDULE_TYPE_OPTIONS = [
  { value: "available", label: "Доступен (замещает)" },
  { value: "unavailable", label: "Недоступен" },
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
];

function LogisticsSummaryPanel({
  routes,
  units,
  unassignedDemands,
  notifications,
  onOpenDay,
  periodFrom,
  periodTo,
}: {
  routes: any[];
  units: any[];
  unassignedDemands: any[];
  notifications: any[];
  onOpenDay?: (day: Date) => void;
  periodFrom?: string;
  periodTo?: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeCard, setActiveCard] = useState<SummaryCardKey | null>(null);
  const [inlineAction, setInlineAction] = useState<{
    unitId: string;
    driverId?: string;
    kind: "schedule" | "extra";
    type: string;
    extraDriverId: string;
    dateFrom: string;
    dateTo: string;
    scheduleType: string;
  } | null>(null);

  const { data: allDriversForPanel = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/drivers"],
    queryFn: () => apiRequest("GET", "/api/logistics/drivers").then((r) => r.json()),
    enabled: activeCard === "unavailable",
  });

  const addScheduleMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", "/api/logistics-plan/driver-schedule", payload).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      setInlineAction(null);
      toast({ title: "Запись добавлена в табель" });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка добавления в табель", variant: "destructive" }),
  });

  const addExtraDriverMutation = useMutation({
    mutationFn: (payload: any) =>
      apiRequest("POST", `/api/logistics-plan/transport-units/${payload.transportUnitId}/extra-drivers`, payload).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      setInlineAction(null);
      toast({ title: "Дополнительный водитель добавлен" });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка добавления водителя", variant: "destructive" }),
  });

  const totalRoutes = routes.filter((r) => r.type !== "unavailable").length;
  const lateCount = routes.filter((r) => r.isLate).length;
  const deadlineCount = routes.filter((r) => r.isDeadline && !r.isLate).length;
  const unassignedCount = unassignedDemands.length;
  const driverUnavailableUnits = units.filter((u) => u.driverUnavailable);
  const vehicleUnavailableUnits = units.filter((u) => u.vehicleUnavailable);
  const unavailableCount = driverUnavailableUnits.length + vehicleUnavailableUnits.length;

  const allGood =
    unassignedCount === 0 &&
    lateCount === 0 &&
    driverUnavailableUnits.length === 0;

  const toggleCard = (key: SummaryCardKey) => setActiveCard((prev) => (prev === key ? null : key));

  // Detail content for each card
  const renderDetail = () => {
    if (!activeCard) return null;
    // onOpenDay is available via closure from props

    if (activeCard === "routes") {
      const displayed = routes.filter((r) => r.type !== "unavailable");
      return (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Все маршруты ({displayed.length})</p>
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
            {displayed.length === 0 && <p className="text-xs text-muted-foreground">Нет маршрутов</p>}
            {displayed.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs bg-muted/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">
                    {r.fromEntityName ?? "—"} → {r.toEntityName ?? "—"}
                  </span>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                  {r.dateStart && (
                    <span className="text-muted-foreground">{r.dateStart.slice(0, 10)}</span>
                  )}
                  {r.status === "auto" && (
                    <span className="text-[10px] text-blue-500">авто</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeCard === "unassigned") {
      return (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Нераспределённые потребности ({unassignedDemands.length})</p>
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
            {unassignedDemands.length === 0 && <p className="text-xs text-muted-foreground text-green-700">Все потребности распределены</p>}
            {unassignedDemands.map((d: any, i: number) => (
              <div
                key={d.id ?? i}
                role={onOpenDay && d.deliveryDeadline ? "button" : undefined}
                tabIndex={onOpenDay && d.deliveryDeadline ? 0 : undefined}
                className={cn(
                  "flex items-start justify-between gap-2 rounded border border-red-200 dark:border-red-800 px-2 py-1.5 text-xs bg-red-50 dark:bg-red-950/20",
                  onOpenDay && d.deliveryDeadline && "cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors",
                )}
                onClick={() => {
                  if (onOpenDay && d.deliveryDeadline) {
                    try { onOpenDay(new Date(d.deliveryDeadline)); } catch {}
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && onOpenDay && d.deliveryDeadline) {
                    try { onOpenDay(new Date(d.deliveryDeadline)); } catch {}
                  }
                }}
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3 w-3 text-red-500 shrink-0" />
                    <span className="truncate font-medium">
                      {d.fromEntityName || "—"} → {d.toEntityName || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-4 text-muted-foreground flex-wrap">
                    <span>{d.type === "income" ? "Приход" : "Расход"}</span>
                    {(d.volumeTons != null || d.volume != null) && (
                      <span>{(d.volumeTons != null ? d.volumeTons : parseFloat(d.volume) / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} т</span>
                    )}
                    {d.deliveryDeadline && (
                      <span>дедлайн: {d.deliveryDeadline.slice(0, 10)}</span>
                    )}
                  </div>
                  {d.missingDataReason && (
                    <div className="flex items-start gap-1 pl-4 mt-0.5">
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-amber-700 dark:text-amber-400">{d.missingDataReason}</span>
                    </div>
                  )}
                </div>
                {onOpenDay && d.deliveryDeadline && (
                  <ArrowRight className="h-3 w-3 shrink-0 text-primary mt-0.5" />
                )}
              </div>
            ))}
          </div>
          {unassignedDemands.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Нажмите «Назначить» или кликните день в календаре для ручного распределения.
            </p>
          )}
        </div>
      );
    }

    if (activeCard === "deadline") {
      const problematic = routes.filter((r) => r.isLate || r.isDeadline);
      return (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Дедлайны и опоздания ({problematic.length})</p>
          <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1">
            {problematic.length === 0 && <p className="text-xs text-green-700">Нет просрочек и дедлайнов</p>}
            {problematic.map((r: any) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs",
                  r.isLate
                    ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20"
                    : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20",
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className={cn("h-3 w-3 shrink-0", r.isLate ? "text-red-500" : "text-amber-500")} />
                  <span className="truncate">{r.fromLocation ?? "—"} → {r.toLocation ?? "—"}</span>
                </div>
                <span className={cn("shrink-0 font-medium text-[10px]", r.isLate ? "text-red-600" : "text-amber-600")}>
                  {r.isLate ? "опоздание" : "дедлайн"}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeCard === "unavailable") {
      const allUnavailable = [
        ...driverUnavailableUnits.map((u: any) => ({ ...u, kind: "driver" })),
        ...vehicleUnavailableUnits.map((u: any) => ({ ...u, kind: "vehicle" })),
      ];

      const scheduleTypeLabel: Record<string, string> = {
        available: "Доступен",
        unavailable: "Недоступен",
        vacation: "Отпуск",
        sick: "Больничный",
        day_off: "Выходной",
        training: "Обучение",
        other: "Другое",
      };

      return (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium mb-2 text-muted-foreground">Недоступные ТС/водители ({allUnavailable.length})</p>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {allUnavailable.length === 0 && <p className="text-xs text-green-700">Все доступны</p>}
            {allUnavailable.map((u: any) => {
              const blockingSchedules = (u.driverScheduleForPeriod ?? []).filter((s: any) => s.type !== "available");
              const extraDrivers = (u.extraDriversForPeriod ?? []);
              const hasSubstitute = extraDrivers.some((ed: any) =>
                !ed.scheduleType || ["available", null, ""].includes(ed.scheduleType)
              );
              const isActionOpen = inlineAction?.unitId === u.id;
              return (
                <div key={u.id + u.kind} className={cn(
                  "flex flex-col gap-1.5 rounded border px-2 py-2 text-xs",
                  hasSubstitute && u.kind === "driver"
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                    : "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20"
                )}>
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {u.kind === "driver"
                        ? <User className={cn("h-3 w-3 shrink-0", hasSubstitute ? "text-green-500" : "text-amber-500")} />
                        : <Truck className="h-3 w-3 text-amber-500 shrink-0" />
                      }
                      <span className="font-medium truncate">
                        {u.kind === "driver" ? (u.driver?.fullName ?? "—") : (u.vehicle?.regNumber ?? "—")}
                      </span>
                    </div>
                    <span className={cn("text-[10px] shrink-0", hasSubstitute && u.kind === "driver" ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                      {u.kind === "driver"
                        ? (hasSubstitute ? "есть замена" : "нет замены")
                        : "ТС недоступно"}
                    </span>
                  </div>
                  {/* Unavailability periods */}
                  {blockingSchedules.length > 0 && (
                    <div className="pl-4 flex flex-col gap-0.5">
                      {blockingSchedules.map((s: any, i: number) => (
                        <span key={i} className="text-[10px] text-muted-foreground">
                          {scheduleTypeLabel[s.type] ?? s.type}: {s.dateFrom?.slice(0, 10)} — {s.dateTo?.slice(0, 10)}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Extra drivers covering this period */}
                  {extraDrivers.length > 0 && u.kind === "driver" && (
                    <div className="pl-4 flex flex-col gap-0.5">
                      {extraDrivers.map((ed: any, i: number) => {
                        const blocked = ed.scheduleType && !["available", null, ""].includes(ed.scheduleType);
                        return (
                          <span key={i} className={cn("text-[10px]", blocked ? "text-muted-foreground line-through" : "text-green-700 dark:text-green-400")}>
                            Доп. вод.: {ed.driver?.fullName ?? "—"}
                            {ed.dateFrom && ed.dateTo && ` (${ed.dateFrom.slice(0, 10)} — ${ed.dateTo.slice(0, 10)})`}
                            {ed.scheduleType && ed.scheduleType !== "available" && ` · ${scheduleTypeLabel[ed.scheduleType] ?? ed.scheduleType}`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* Quick-add actions for driver units */}
                  {u.kind === "driver" && !isActionOpen && (
                    <div className="flex gap-2 border-t pt-1.5 mt-0.5">
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => setInlineAction({
                          unitId: u.id,
                          driverId: u.driverId,
                          kind: "schedule",
                          type: "unavailable",
                          extraDriverId: "",
                          dateFrom: periodFrom ?? "",
                          dateTo: periodTo ?? "",
                          scheduleType: "available",
                        })}
                      >
                        + Табель
                      </button>
                      <button
                        className="text-[10px] text-primary hover:underline"
                        onClick={() => setInlineAction({
                          unitId: u.id,
                          driverId: u.driverId,
                          kind: "extra",
                          type: "unavailable",
                          extraDriverId: "",
                          dateFrom: periodFrom ?? "",
                          dateTo: periodTo ?? "",
                          scheduleType: "available",
                        })}
                      >
                        + Доп. водитель
                      </button>
                    </div>
                  )}
                  {/* Inline: add schedule entry */}
                  {isActionOpen && inlineAction!.kind === "schedule" && (
                    <div className="border-t pt-2 mt-0.5 space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground">Новая запись в табель</p>
                      <select
                        value={inlineAction!.type}
                        onChange={(e) => setInlineAction((s) => s ? { ...s, type: e.target.value } : s)}
                        className="w-full h-7 text-xs rounded border bg-background px-1"
                      >
                        {SUMMARY_SCHEDULE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="date"
                          value={inlineAction!.dateFrom}
                          onChange={(e) => setInlineAction((s) => s ? { ...s, dateFrom: e.target.value } : s)}
                          className="h-7 text-xs rounded border bg-background px-1"
                        />
                        <input
                          type="date"
                          value={inlineAction!.dateTo}
                          onChange={(e) => setInlineAction((s) => s ? { ...s, dateTo: e.target.value } : s)}
                          className="h-7 text-xs rounded border bg-background px-1"
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="flex-1 h-6 rounded border bg-primary text-primary-foreground text-[10px] hover:bg-primary/90 disabled:opacity-50"
                          disabled={addScheduleMutation.isPending}
                          onClick={() => {
                            if (!inlineAction?.driverId || !inlineAction.dateFrom || !inlineAction.dateTo) return;
                            addScheduleMutation.mutate({
                              driverId: inlineAction.driverId,
                              type: inlineAction.type,
                              dateFrom: new Date(inlineAction.dateFrom).toISOString(),
                              dateTo: new Date(inlineAction.dateTo).toISOString(),
                            });
                          }}
                        >
                          {addScheduleMutation.isPending ? "..." : "Сохранить"}
                        </button>
                        <button
                          className="h-6 w-8 rounded border text-[10px] hover:bg-muted"
                          onClick={() => setInlineAction(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Inline: add extra driver */}
                  {isActionOpen && inlineAction!.kind === "extra" && (
                    <div className="border-t pt-2 mt-0.5 space-y-1.5">
                      <p className="text-[10px] font-medium text-muted-foreground">Добавить доп. водителя</p>
                      <select
                        value={inlineAction!.extraDriverId}
                        onChange={(e) => setInlineAction((s) => s ? { ...s, extraDriverId: e.target.value } : s)}
                        className="w-full h-7 text-xs rounded border bg-background px-1"
                      >
                        <option value="">— Выберите водителя —</option>
                        {allDriversForPanel
                          .filter((d: any) => d.id !== u.driverId)
                          .map((d: any) => (
                            <option key={d.id} value={d.id}>{d.fullName}</option>
                          ))}
                      </select>
                      <select
                        value={inlineAction!.scheduleType}
                        onChange={(e) => setInlineAction((s) => s ? { ...s, scheduleType: e.target.value } : s)}
                        className="w-full h-7 text-xs rounded border bg-background px-1"
                      >
                        {SUMMARY_EXTRA_SCHEDULE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="date"
                          value={inlineAction!.dateFrom}
                          onChange={(e) => setInlineAction((s) => s ? { ...s, dateFrom: e.target.value } : s)}
                          className="h-7 text-xs rounded border bg-background px-1"
                          placeholder="с (не обязательно)"
                        />
                        <input
                          type="date"
                          value={inlineAction!.dateTo}
                          onChange={(e) => setInlineAction((s) => s ? { ...s, dateTo: e.target.value } : s)}
                          className="h-7 text-xs rounded border bg-background px-1"
                          placeholder="по (не обязательно)"
                        />
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="flex-1 h-6 rounded border bg-primary text-primary-foreground text-[10px] hover:bg-primary/90 disabled:opacity-50"
                          disabled={addExtraDriverMutation.isPending || !inlineAction!.extraDriverId}
                          onClick={() => {
                            if (!inlineAction?.extraDriverId) return;
                            addExtraDriverMutation.mutate({
                              transportUnitId: inlineAction.unitId,
                              driverId: inlineAction.extraDriverId,
                              dateFrom: inlineAction.dateFrom ? new Date(inlineAction.dateFrom).toISOString() : null,
                              dateTo: inlineAction.dateTo ? new Date(inlineAction.dateTo).toISOString() : null,
                              scheduleType: inlineAction.scheduleType || null,
                            });
                          }}
                        >
                          {addExtraDriverMutation.isPending ? "..." : "Добавить"}
                        </button>
                        <button
                          className="h-6 w-8 rounded border text-[10px] hover:bg-muted"
                          onClick={() => setInlineAction(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Состояние логистики</span>
        {allGood && (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 text-green-700 border-green-300 bg-green-50 dark:text-green-400 dark:border-green-700 dark:bg-green-950/30 ml-auto"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Всё в порядке
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          icon={<ArrowRight className="h-3.5 w-3.5" />}
          label="Маршрутов"
          value={totalRoutes}
          variant="neutral"
          active={activeCard === "routes"}
          onClick={totalRoutes > 0 ? () => toggleCard("routes") : undefined}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Нераспределённых"
          value={unassignedCount}
          variant={unassignedCount > 0 ? "danger" : "ok"}
          hint={unassignedCount === 0 ? undefined : "Не удалось назначить транспорт — проверьте тарифы, транспорт и водителей"}
          active={activeCard === "unassigned"}
          onClick={() => toggleCard("unassigned")}
        />
        <SummaryCard
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Дедлайн/опоздания"
          value={lateCount + deadlineCount}
          variant={lateCount > 0 ? "danger" : deadlineCount > 0 ? "warn" : "ok"}
          active={activeCard === "deadline"}
          onClick={lateCount + deadlineCount > 0 ? () => toggleCard("deadline") : undefined}
        />
        <SummaryCard
          icon={<User className="h-3.5 w-3.5" />}
          label="Недоступных ТС/вод."
          value={unavailableCount}
          variant={unavailableCount > 0 ? "warn" : "ok"}
          active={activeCard === "unavailable"}
          onClick={unavailableCount > 0 ? () => toggleCard("unavailable") : undefined}
        />
      </div>

      {renderDetail()}

      {/* Actionable hints */}
      {!activeCard && unassignedCount > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            <strong>{unassignedCount} {unassignedCount === 1 ? "маршрут не распределён" : "маршрута не распределены"}.</strong>{" "}
            Проверьте: настроены ли тарифы во вкладке «Маршруты», добавлены ли транспортные единицы
            во вкладке «Транспорт», и есть ли доступные водители на нужные даты.
            Нажмите на день в календаре для ручного назначения.
          </span>
        </div>
      )}
      {units.length === 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Транспортные единицы не настроены. Перейдите во вкладку «Транспорт» и добавьте
            тягачи с прицепами и водителями для автоматического формирования логистики.
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Notifications strip ──────────────────────────────────────────────────────

function NotificationsStrip({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: any[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when there are unread notifications
  useEffect(() => {
    if (unreadCount > 0) setExpanded(true);
  }, [unreadCount]);

  return (
    <div className="rounded-md border bg-card">
      {/* header row */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">Оповещения</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-4 px-1">
            {unreadCount}
          </Badge>
        )}
        {unreadCount === 0 && notifications.length > 0 && (
          <span className="text-xs text-muted-foreground">({notifications.length})</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAllRead();
              }}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Все прочитаны
            </Button>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* expanded list */}
      {expanded && (
        <div className="border-t">
          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Нет оповещений
            </p>
          ) : (
            <div className="flex flex-col divide-y max-h-60 overflow-y-auto">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2 px-3 py-2 text-xs",
                    !n.isRead ? "bg-muted/30" : "opacity-60",
                  )}
                >
                  {getNotifIcon(n.type)}
                  <p className="flex-1 leading-snug">{n.message}</p>
                  {!n.isRead && (
                    <button
                      className="shrink-0 hover:text-foreground text-muted-foreground transition-colors"
                      onClick={() => onMarkRead(n.id)}
                      title="Прочитано"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({
  periodFrom,
  periodTo,
  routes,
  units,
  unassignedDemands,
  onOpenDay,
}: {
  periodFrom: string;
  periodTo: string;
  routes: any[];
  units: any[];
  unassignedDemands: any[];
  onOpenDay: (day: Date) => void;
}) {
  const from = new Date(periodFrom);
  const to = new Date(periodTo);

  const allWeekStarts = useMemo(() => {
    const weeks: Date[] = [];
    let ws = startOfWeek(from, { weekStartsOn: 1 });
    while (ws <= to) {
      weeks.push(ws);
      ws = addWeeks(ws, 1);
    }
    return weeks;
  }, [periodFrom, periodTo]);

  const [weekIdx, setWeekIdx] = useState(0);
  const weekStart = allWeekStarts[weekIdx] ?? allWeekStarts[0];
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const unitById = useMemo(() => {
    const m = new Map<string, any>();
    units.forEach((u) => m.set(u.id, u));
    return m;
  }, [units]);

  const getRoutesForUnit = (unitId: string, day: Date) =>
    routes.filter((r: any) => {
      if (r.transportUnitId !== unitId) return false;
      if (!r.dateStart) return false;
      try {
        const start = parseISO(r.dateStart);
        const end = r.dateEnd ? parseISO(r.dateEnd) : start;
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });

  const isVehicleUnavailable = (unit: any, day: Date) =>
    unit.vehicleAvailabilityForPeriod?.some((a: any) => {
      try {
        return isWithinInterval(day, {
          start: parseISO(a.dateFrom),
          end: parseISO(a.dateTo),
        });
      } catch {
        return false;
      }
    });

  const isDriverUnavailable = (unit: any, day: Date) =>
    unit.driverScheduleForPeriod?.some((s: any) => {
      if (s.type === "available") return false;
      try {
        return isWithinInterval(day, {
          start: parseISO(s.dateFrom),
          end: parseISO(s.dateTo),
        });
      } catch {
        return false;
      }
    });

  /** Returns true if any extra driver for this unit covers `day` and is not blocked */
  const hasExtraDriverForDay = (unit: any, day: Date) =>
    unit.extraDriversForPeriod?.some((ed: any) => {
      if (ed.scheduleType && !["available", null, ""].includes(ed.scheduleType)) return false;
      if (ed.dateFrom && ed.dateTo) {
        try {
          return isWithinInterval(day, {
            start: parseISO(ed.dateFrom),
            end: parseISO(ed.dateTo),
          });
        } catch { return false; }
      }
      return true; // no date restriction — always available
    });

  const unassignedForDay = (day: Date) =>
    unassignedDemands.filter((d: any) => {
      if (!d.deliveryDeadline) return false;
      try {
        return isSameDay(parseISO(d.deliveryDeadline), day);
      } catch {
        return false;
      }
    });

  const inPeriod = (day: Date) => day >= from && day <= to;

  return (
    <div className="flex flex-col gap-2">
      {/* week navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekIdx((i) => Math.max(0, i - 1))}
          disabled={weekIdx === 0}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium min-w-[180px] text-center">
          {format(weekStart, "d MMM", { locale: ru })} —{" "}
          {format(addDays(weekStart, 6), "d MMM yyyy", { locale: ru })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekIdx((i) => Math.min(allWeekStarts.length - 1, i + 1))}
          disabled={weekIdx === allWeekStarts.length - 1}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">
          Неделя {weekIdx + 1} из {allWeekStarts.length}
        </span>
      </div>

      {/* grid */}
      <div className="rounded-md border overflow-hidden">
        {/* header */}
        <div
          className="grid bg-muted/50"
          style={{ gridTemplateColumns: "180px repeat(7, 1fr)" }}
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-r">
            ТС / Водитель
          </div>
          {weekDays.map((day, i) => {
            const today = isSameDay(day, new Date());
            const active = inPeriod(day);
            const dayUnassigned = active ? unassignedForDay(day) : [];
            return (
              <div
                key={i}
                className={cn(
                  "px-2 py-2 text-center text-xs font-medium border-r last:border-r-0",
                  today && "bg-primary/15 dark:bg-primary/20",
                  !active && "opacity-40",
                )}
              >
                <div className="text-muted-foreground">{WEEK_DAYS_RU[i]}</div>
                <div
                  className={cn(
                    "text-sm font-semibold mt-0.5",
                    today && "text-primary",
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {format(day, "MMM", { locale: ru })}
                </div>
                {dayUnassigned.length > 0 && (
                  <div className="flex justify-center mt-1">
                    <UnassignedBadge count={dayUnassigned.length} demands={dayUnassigned} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* rows */}
        {units.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground border-t">
            Нет транспортных единиц. Добавьте их во вкладке «Транспорт».
          </div>
        ) : (
          <div className="divide-y">
            {units.map((unit: any) => (
              <div
                key={unit.id}
                className="grid hover:bg-muted/20 transition-colors"
                style={{ gridTemplateColumns: "180px repeat(7, 1fr)" }}
              >
                {/* unit label */}
                <div className="px-3 py-2 border-r bg-background flex flex-col justify-center gap-0.5">
                  <div className="flex items-center gap-1">
                    <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {unit.vehicle?.regNumber || unit.carrier?.name || "—"}
                    </span>
                  </div>
                  {unit.vehicle?.model && (
                    <span className="text-[10px] text-muted-foreground truncate pl-4">
                      {unit.vehicle.model}
                    </span>
                  )}
                  {unit.driver?.fullName && (
                    <div className="flex items-center gap-1 pl-0">
                      <User className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {unit.driver.fullName.split(" ").slice(0, 2).join(" ")}
                      </span>
                    </div>
                  )}
                  {unit.trailerCapacityM3 && (
                    <div className="flex items-center gap-1 pl-0">
                      <Package className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground">
                        {parseFloat(unit.trailerCapacityM3).toFixed(0)} м³
                      </span>
                    </div>
                  )}
                  {unit.driverUnavailable && (
                    unit.extraDriversForPeriod?.some((ed: any) =>
                      !ed.scheduleType || ["available", null, ""].includes(ed.scheduleType)
                    ) ? (
                      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                        Недоступен (есть замена)
                      </span>
                    ) : (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                        Недоступен
                      </span>
                    )
                  )}
                  {unit.vehicleUnavailable && (
                    <span className="text-[10px] text-gray-500 font-medium">
                      ТС недоступен
                    </span>
                  )}
                </div>

                {/* day cells */}
                {weekDays.map((day, i) => {
                  const active = inPeriod(day);
                  const today = isSameDay(day, new Date());
                  const dayRoutes = active ? getRoutesForUnit(unit.id, day) : [];
                  const vehicleOut = active && isVehicleUnavailable(unit, day);
                  const driverOut = active && !vehicleOut && isDriverUnavailable(unit, day);

                  return (
                    <div
                      key={i}
                      className={cn(
                        "px-1.5 py-1.5 border-r last:border-r-0 min-h-[60px] flex flex-col gap-1",
                        today && "bg-primary/5",
                        !active && "bg-muted/20 opacity-50",
                        active && "cursor-pointer",
                      )}
                      onClick={() => active && onOpenDay(day)}
                    >
                      {vehicleOut && (
                        <div className="flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                          <Wrench className="h-2.5 w-2.5 shrink-0" />
                          <span>Недоступен</span>
                        </div>
                      )}
                      {driverOut && (
                        hasExtraDriverForDay(unit, day) ? (
                          <div className="flex items-center gap-0.5 text-[10px] text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded px-1 py-0.5">
                            <User className="h-2.5 w-2.5 shrink-0" />
                            <span>Доп. вод.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 text-[10px] text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 rounded px-1 py-0.5">
                            <User className="h-2.5 w-2.5 shrink-0" />
                            <span>Вод. нет</span>
                          </div>
                        )
                      )}
                      {dayRoutes.map((r: any) => (
                        <RoutePill key={r.id} route={r} unit={unit} compact />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  periodFrom,
  periodTo,
  routes,
  units,
  unassignedDemands,
  onOpenDay,
}: {
  periodFrom: string;
  periodTo: string;
  routes: any[];
  units: any[];
  unassignedDemands: any[];
  onOpenDay: (day: Date) => void;
}) {
  const from = new Date(periodFrom);
  const to = new Date(periodTo);

  const weeks = useMemo(
    () => eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }),
    [periodFrom, periodTo],
  );

  const unitById = useMemo(() => {
    const m = new Map<string, any>();
    units.forEach((u) => m.set(u.id, u));
    return m;
  }, [units]);

  const getRoutesForDay = (day: Date) =>
    routes.filter((r: any) => {
      if (!r.dateStart) return false;
      try {
        const start = parseISO(r.dateStart);
        const end = r.dateEnd ? parseISO(r.dateEnd) : start;
        return isWithinInterval(day, { start, end });
      } catch {
        return false;
      }
    });

  const unassignedForDay = (day: Date) =>
    unassignedDemands.filter((d: any) => {
      if (!d.deliveryDeadline) return false;
      try {
        return isSameDay(parseISO(d.deliveryDeadline), day);
      } catch {
        return false;
      }
    });

  return (
    <div className="rounded-md border overflow-hidden">
      {/* header */}
      <div className="grid bg-muted/50" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEK_DAYS_RU.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* weeks */}
      <div className="divide-y">
        {weeks.map((weekStart) => {
          const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
          return (
            <div
              key={weekStart.toISOString()}
              className="grid"
              style={{ gridTemplateColumns: "repeat(7, 1fr)" }}
            >
              {weekDays.map((day) => {
                const inRange = day >= from && day <= to;
                const today = isSameDay(day, new Date());
                const dayRoutes = inRange ? getRoutesForDay(day) : [];
                const dayUnassigned = inRange ? unassignedForDay(day) : [];
                const maxVisible = 3;

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r last:border-r-0 px-1.5 py-1.5 min-h-[90px] flex flex-col",
                      !inRange && "bg-muted/20 opacity-40",
                      inRange && "cursor-pointer hover:bg-muted/20 transition-colors",
                      today && "bg-primary/5 dark:bg-primary/10",
                    )}
                    onClick={() => inRange && onOpenDay(day)}
                  >
                    {/* day number + unassigned badge */}
                    <div className="flex items-start justify-between mb-1 gap-1">
                      <span
                        className={cn(
                          "text-sm font-medium leading-none",
                          today &&
                            "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs",
                          !inRange && "text-muted-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayUnassigned.length > 0 && (
                        <UnassignedBadge count={dayUnassigned.length} demands={dayUnassigned} />
                      )}
                    </div>

                    {/* route pills */}
                    <div className="flex flex-col gap-0.5 flex-1">
                      {dayRoutes.slice(0, maxVisible).map((r: any) => (
                        <RoutePill
                          key={r.id}
                          route={r}
                          unit={unitById.get(r.transportUnitId)}
                          compact
                        />
                      ))}
                      {dayRoutes.length > maxVisible && (
                        <span className="text-[10px] text-muted-foreground pl-1">
                          +{dayRoutes.length - maxVisible} ещё
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanningTab({ periodFrom, periodTo }: PlanningTabProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [routePlanOpen, setRoutePlanOpen] = useState(false);

  const { data: calendarData, isLoading: calendarLoading } = useQuery<any>({
    queryKey: ["/api/logistics-plan/calendar", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/logistics-plan/calendar?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      ).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  // Show toast when new unread notifications arrive (plan updated externally)
  const prevUnreadRef = useRef<number>(-1);
  useEffect(() => {
    const cur: number = calendarData?.unreadCount ?? 0;
    if (prevUnreadRef.current >= 0 && cur > prevUnreadRef.current) {
      toast({
        title: "Логистика обновлена",
        description: "Появились новые изменения в плане — данные обновлены.",
      });
    }
    prevUnreadRef.current = cur;
  }, [calendarData?.unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: syncData } = useQuery<any>({
    queryKey: ["/api/logistics-plan/sync", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/logistics-plan/sync?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      ).then((r) => r.json()),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/logistics-plan/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/logistics-plan/notifications/mark-all-read", {
        periodFrom,
        periodTo,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
    },
  });

  const routes: any[] = calendarData?.routes || [];
  const units: any[] = calendarData?.transportUnits || [];
  const notifications: any[] = calendarData?.notifications || [];
  const unreadCount: number = calendarData?.unreadCount || 0;
  const unassignedDemands: any[] = calendarData?.unassignedDemands || [];

  const hasSyncedPlan = syncData?.latest != null;

  const openDayPlan = (day: Date) => {
    setSelectedDay(day);
    setRoutePlanOpen(true);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-3">
        {/* Sync status + alternative scenario banner */}
        <SyncStatusBanner syncData={syncData} periodFrom={periodFrom} periodTo={periodTo} />

        {!hasSyncedPlan ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 rounded-md border bg-muted/20">
            <CalendarDays className="h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Ежемесячный план ещё не запущен в логистику. Нажмите кнопку{" "}
              <strong>«Запустить в план логистики»</strong> на странице «Планирование»,
              чтобы данные появились здесь.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Summary panel */}
            <LogisticsSummaryPanel
              routes={routes}
              units={units}
              unassignedDemands={unassignedDemands}
              notifications={notifications}
              onOpenDay={openDayPlan}
              periodFrom={periodFrom}
              periodTo={periodTo}
            />

            {/* Notifications — auto-expands when unread > 0 */}
            <NotificationsStrip
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onMarkAllRead={() => markAllReadMutation.mutate()}
            />

            {/* View switcher + legend */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-view-week"
                >
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Неделя
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-view-month"
                >
                  <LayoutGrid className="h-4 w-4 mr-1.5" />
                  Месяц
                </Button>
              </div>
              {calendarLoading && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Загрузка…
                </span>
              )}
            </div>

            {/* Legend */}
            <CalendarLegend />

            {/* Calendar */}
            {viewMode === "week" ? (
              <WeekView
                periodFrom={periodFrom}
                periodTo={periodTo}
                routes={routes}
                units={units}
                unassignedDemands={unassignedDemands}
                onOpenDay={openDayPlan}
              />
            ) : (
              <MonthView
                periodFrom={periodFrom}
                periodTo={periodTo}
                routes={routes}
                units={units}
                unassignedDemands={unassignedDemands}
                onOpenDay={openDayPlan}
              />
            )}
          </div>
        )}

        {selectedDay && (
          <RoutePlanDialog
            open={routePlanOpen}
            onOpenChange={setRoutePlanOpen}
            day={selectedDay}
            periodFrom={periodFrom}
            periodTo={periodTo}
            units={units}
            routes={routes}
            unassignedDemands={unassignedDemands}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
