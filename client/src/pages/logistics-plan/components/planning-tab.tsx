import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
  addDays,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { ru } from "date-fns/locale";
import { AlertTriangle, Bell, CalendarDays, LayoutGrid, CheckCircle, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RoutePlanDialog } from "./route-plan-dialog";
import { SyncStatusBanner } from "./sync-status-banner";

interface PlanningTabProps {
  periodFrom: string;
  periodTo: string;
}

type ViewMode = "week" | "month";

export function PlanningTab({ periodFrom, periodTo }: PlanningTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [routePlanOpen, setRoutePlanOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: calendarData, isLoading: calendarLoading } = useQuery<any>({
    queryKey: ["/api/logistics-plan/calendar", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(`/api/logistics-plan/calendar?periodFrom=${periodFrom}&periodTo=${periodTo}`),
  });

  const { data: syncData } = useQuery<any>({
    queryKey: ["/api/logistics-plan/sync", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(`/api/logistics-plan/sync?periodFrom=${periodFrom}&periodTo=${periodTo}`),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/logistics-plan/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/logistics-plan/notifications/mark-all-read", {
        method: "POST",
        body: JSON.stringify({ periodFrom, periodTo }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/notifications"] });
    },
  });

  const from = new Date(periodFrom);
  const to = new Date(periodTo);

  const days = eachDayOfInterval({ start: from, end: to });
  const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });

  const routes: any[] = calendarData?.routes || [];
  const units: any[] = calendarData?.transportUnits || [];
  const notifications: any[] = calendarData?.notifications || [];
  const unreadCount: number = calendarData?.unreadCount || 0;

  const getRoutesForDay = (day: Date) => {
    return routes.filter((r: any) => {
      if (!r.dateStart) return false;
      try {
        return isSameDay(parseISO(r.dateStart), day);
      } catch {
        return false;
      }
    });
  };

  const getRoutesForUnit = (unitId: string, day: Date) => {
    return routes.filter((r: any) => {
      if (r.transportUnitId !== unitId) return false;
      if (!r.dateStart || !r.dateEnd) return false;
      try {
        return isWithinInterval(day, {
          start: parseISO(r.dateStart),
          end: parseISO(r.dateEnd),
        });
      } catch {
        return false;
      }
    });
  };

  const getRouteStatusColor = (route: any) => {
    if (route.isLate) return "bg-red-100 border-red-300 dark:bg-red-900/30";
    if (route.isDeadline) return "bg-amber-100 border-amber-300 dark:bg-amber-900/30";
    if (route.isUnplanned) return "bg-purple-100 border-purple-300 dark:bg-purple-900/30";
    if (!route.isOptimal) return "bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30";
    if (route.type === "deadhead") return "bg-blue-100 border-blue-300 dark:bg-blue-900/30";
    return "bg-green-100 border-green-300 dark:bg-green-900/30";
  };

  const getNotifIcon = (type: string) => {
    if (type === "deadline" || type === "late") return <AlertTriangle className="h-3 w-3 text-amber-500" />;
    if (type === "unassigned") return <Clock className="h-3 w-3 text-blue-500" />;
    if (type === "unplanned") return <AlertTriangle className="h-3 w-3 text-purple-500" />;
    return <Bell className="h-3 w-3 text-muted-foreground" />;
  };

  const hasUnassigned = (day: Date) => {
    return routes.some((r: any) => {
      if (!r.dateStart) return false;
      try {
        return isSameDay(parseISO(r.dateStart), day) && !r.transportUnitId;
      } catch {
        return false;
      }
    });
  };

  const openDayPlan = (day: Date) => {
    setSelectedDay(day);
    setRoutePlanOpen(true);
  };

  const hasSyncedPlan = syncData?.latest != null;

  return (
    <div className="flex flex-col gap-4">
      <SyncStatusBanner
        syncData={syncData}
        periodFrom={periodFrom}
        periodTo={periodTo}
      />

      {!hasSyncedPlan ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <CalendarDays className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Ежемесячный план ещё не запущен в логистику. Нажмите кнопку{" "}
            <strong>«Запустить в план логистики»</strong> на странице «Планирование ежем.»,
            чтобы данные появились здесь.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  data-testid="button-view-week"
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Неделя
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  data-testid="button-view-month"
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Месяц
                </Button>
              </div>
            </div>

            {viewMode === "week" && (
              <div className="overflow-auto rounded-md border">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="border px-3 py-2 text-left font-medium min-w-[180px] sticky left-0 bg-muted/50 z-10">
                        ТС / Водитель
                      </th>
                      {days.map((day) => (
                        <th
                          key={day.toISOString()}
                          className={cn(
                            "border px-2 py-2 text-center font-medium min-w-[120px] cursor-pointer hover-elevate",
                            isSameDay(day, new Date()) && "bg-primary/10"
                          )}
                          onClick={() => openDayPlan(day)}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">
                              {format(day, "EEE", { locale: ru })}
                            </span>
                            <span>{format(day, "d MMM", { locale: ru })}</span>
                            {hasUnassigned(day) && (
                              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Нераспределённые маршруты" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {units.length === 0 ? (
                      <tr>
                        <td
                          colSpan={days.length + 1}
                          className="border px-3 py-8 text-center text-muted-foreground"
                        >
                          Нет транспортных единиц. Добавьте их во вкладке «Транспорт».
                        </td>
                      </tr>
                    ) : (
                      units.map((unit: any) => (
                        <tr key={unit.id}>
                          <td className="border px-3 py-2 sticky left-0 bg-background z-10">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-sm">
                                {unit.vehicle?.regNumber || "—"}
                              </span>
                              {unit.trailerCapacityM3 && (
                                <span className="text-xs text-muted-foreground">
                                  {parseFloat(unit.trailerCapacityM3).toFixed(0)} м³
                                </span>
                              )}
                              {unit.driver?.fullName && (
                                <span className="text-xs text-muted-foreground">
                                  {unit.driver.fullName}
                                </span>
                              )}
                            </div>
                          </td>
                          {days.map((day) => {
                            const dayRoutes = getRoutesForUnit(unit.id, day);
                            const isUnavailable = unit.vehicleAvailabilityForPeriod?.some((a: any) => {
                              try {
                                return isWithinInterval(day, {
                                  start: parseISO(a.dateFrom),
                                  end: parseISO(a.dateTo),
                                });
                              } catch {
                                return false;
                              }
                            });
                            const driverUnavailable = unit.driverScheduleForPeriod?.some((s: any) => {
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

                            return (
                              <td
                                key={day.toISOString()}
                                className={cn(
                                  "border px-2 py-1 align-top cursor-pointer hover-elevate min-w-[120px]",
                                  isSameDay(day, new Date()) && "bg-primary/5"
                                )}
                                onClick={() => openDayPlan(day)}
                              >
                                {isUnavailable && (
                                  <div className="text-xs rounded px-1 py-0.5 bg-gray-100 dark:bg-gray-800 text-muted-foreground mb-1">
                                    Недоступен
                                  </div>
                                )}
                                {driverUnavailable && !isUnavailable && (
                                  <div className="text-xs rounded px-1 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 mb-1">
                                    Вод. нет
                                  </div>
                                )}
                                {dayRoutes.map((r: any) => (
                                  <div
                                    key={r.id}
                                    className={cn(
                                      "text-xs rounded px-1 py-0.5 border mb-1 leading-tight",
                                      getRouteStatusColor(r)
                                    )}
                                  >
                                    {r.type === "deadhead" ? (
                                      <span className="text-muted-foreground">Прогон</span>
                                    ) : (
                                      <span>
                                        {r.fromEntityName?.split(" ")[0] || "?"} →{" "}
                                        {r.toEntityName?.split(" ")[0] || "?"}
                                      </span>
                                    )}
                                    {r.isLate && <AlertTriangle className="inline h-2.5 w-2.5 ml-1 text-red-600" />}
                                    {r.isDeadline && !r.isLate && <Clock className="inline h-2.5 w-2.5 ml-1 text-amber-600" />}
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "month" && (
              <div className="overflow-auto rounded-md border">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
                        <th key={d} className="border px-2 py-2 text-center font-medium min-w-[120px]">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((weekStart) => {
                      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                      return (
                        <tr key={weekStart.toISOString()}>
                          {weekDays.map((day) => {
                            const inRange =
                              day >= from && day <= to;
                            const dayRoutes = getRoutesForDay(day);
                            const unassigned = hasUnassigned(day);
                            return (
                              <td
                                key={day.toISOString()}
                                className={cn(
                                  "border px-2 py-2 align-top min-h-[80px] min-w-[120px]",
                                  !inRange && "bg-muted/30 opacity-50",
                                  inRange && "cursor-pointer hover-elevate",
                                  isSameDay(day, new Date()) && "bg-primary/5"
                                )}
                                onClick={() => inRange && openDayPlan(day)}
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      !inRange && "text-muted-foreground"
                                    )}
                                  >
                                    {format(day, "d")}
                                  </span>
                                  {unassigned && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1"
                                      title="Нераспределённые маршруты"
                                    />
                                  )}
                                </div>
                                {inRange && dayRoutes.slice(0, 3).map((r: any) => (
                                  <div
                                    key={r.id}
                                    className={cn(
                                      "text-xs rounded px-1 py-0.5 border mb-0.5 truncate",
                                      getRouteStatusColor(r)
                                    )}
                                  >
                                    {r.type === "deadhead"
                                      ? "Прогон"
                                      : `${r.fromEntityName?.split(" ")[0] || "?"} → ${r.toEntityName?.split(" ")[0] || "?"}`}
                                  </div>
                                ))}
                                {inRange && dayRoutes.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{dayRoutes.length - 3} ещё
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
                Маршрут (норм.)
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
                Прогон
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300" />
                Дедлайн
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                С опозданием
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
                Внеплановый
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
                Не оптимальный
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Нераспределённые
              </div>
            </div>
          </div>

          <div className="w-72 shrink-0">
            <div className="rounded-md border p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span className="font-medium text-sm">Оповещения</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Все прочитаны
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Нет оповещений
                  </p>
                ) : (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex items-start gap-2 rounded-md p-2 text-xs",
                        !n.isRead ? "bg-muted/70" : "opacity-60"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="leading-snug">{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => markReadMutation.mutate(n.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
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
        />
      )}
    </div>
  );
}
