import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  MoreHorizontal,
  Plus,
  Truck,
  User,
  History,
  Pencil,
  Trash2,
  Wrench,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuditPanel } from "@/components/audit-panel";
import { TransportUnitDialog } from "./transport-unit-dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TransportTabProps {
  periodFrom: string;
  periodTo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEDULE_TYPES = [
  { value: "unavailable", label: "Недоступен" },
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "available", label: "Доступен" },
  { value: "other", label: "Другое" },
];

const AVAILABILITY_TYPES = [
  { value: "repair", label: "Ремонт" },
  { value: "maintenance", label: "ТО" },
  { value: "to", label: "Техосмотр" },
  { value: "other", label: "Другое" },
];

const scheduleAddSchema = z.object({
  type: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  reason: z.string().optional().nullable(),
});

const availabilityAddSchema = z.object({
  type: z.string().min(1),
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  reason: z.string().optional().nullable(),
});

type ScheduleFormData = z.infer<typeof scheduleAddSchema>;
type AvailabilityFormData = z.infer<typeof availabilityAddSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  try {
    return format(new Date(d), "dd.MM.yy", { locale: ru });
  } catch {
    return d;
  }
}

const EXTRA_DRIVER_SCHEDULE_TYPES = [
  { value: "available", label: "Доступен" },
  { value: "unavailable", label: "Недоступен" },
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "other", label: "Другое" },
];

// ─── Extra drivers section ────────────────────────────────────────────────────

function ExtraDriversSection({
  unit,
  allDrivers,
  periodFrom,
  periodTo,
}: {
  unit: any;
  allDrivers: any[];
  periodFrom: string;
  periodTo: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [addDateFrom, setAddDateFrom] = useState("");
  const [addDateTo, setAddDateTo] = useState("");
  const [addScheduleType, setAddScheduleType] = useState("available");

  const { data: extraDrivers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/extra-drivers", unit.id],
    queryFn: () =>
      apiRequest("GET", `/api/logistics-plan/transport-units/${unit.id}/extra-drivers`).then((r) => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (payload: {
      driverId: string;
      dateFrom: string | null;
      dateTo: string | null;
      scheduleType: string | null;
    }) =>
      apiRequest("POST", `/api/logistics-plan/transport-units/${unit.id}/extra-drivers`, payload).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/extra-drivers", unit.id] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      setSelectedDriverId("");
      setAddDateFrom("");
      setAddDateTo("");
      setAddScheduleType("available");
      setAddOpen(false);
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logistics-plan/extra-drivers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/extra-drivers", unit.id] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  // Exclude already-assigned drivers
  const assignedIds = new Set([unit.driverId, ...extraDrivers.map((ed: any) => ed.driverId)].filter(Boolean));
  const availableToAdd = allDrivers.filter((d) => !assignedIds.has(d.id));

  const scheduleLabel = (type: string | null | undefined) =>
    EXTRA_DRIVER_SCHEDULE_TYPES.find((t) => t.value === type)?.label ?? "Всегда доступен";

  return (
    <div className="border-t mt-3 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Дополнительные водители</p>
        {!addOpen && (
          <button
            className="h-5 flex items-center gap-0.5 text-[10px] text-primary hover:underline"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-3 w-3" />
            Добавить
          </button>
        )}
      </div>

      {extraDrivers.length === 0 && !addOpen && (
        <p className="text-xs text-muted-foreground italic">Не добавлены</p>
      )}

      <div className="flex flex-col gap-1.5">
        {extraDrivers.map((ed: any) => (
          <div key={ed.id} className="rounded border px-2 py-1.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <User className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs font-medium truncate">{ed.driver?.fullName ?? "—"}</span>
              </div>
              <button
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted shrink-0"
                onClick={() => removeMutation.mutate(ed.id)}
                disabled={removeMutation.isPending}
                title="Удалить водителя"
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2 pl-4">
              <span className={ed.scheduleType === "unavailable" || ed.scheduleType === "vacation" || ed.scheduleType === "sick" ? "text-red-500" : ""}>
                {scheduleLabel(ed.scheduleType)}
              </span>
              {(ed.dateFrom || ed.dateTo) && (
                <span>
                  {ed.dateFrom ? ed.dateFrom.slice(0, 10) : "…"} — {ed.dateTo ? ed.dateTo.slice(0, 10) : "…"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {addOpen && (
        <div className="mt-2 space-y-2 rounded border bg-muted/20 px-2 py-2">
          <select
            className="w-full h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
          >
            <option value="">— Выберите водителя —</option>
            {availableToAdd.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>
          <select
            className="w-full h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
            value={addScheduleType}
            onChange={(e) => setAddScheduleType(e.target.value)}
          >
            {EXTRA_DRIVER_SCHEDULE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Период с</p>
              <input
                type="date"
                className="w-full h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                value={addDateFrom}
                onChange={(e) => setAddDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Период по</p>
              <input
                type="date"
                className="w-full h-7 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                value={addDateTo}
                onChange={(e) => setAddDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              className="h-7 px-3 rounded text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
              onClick={() => { setAddOpen(false); setSelectedDriverId(""); setAddDateFrom(""); setAddDateTo(""); setAddScheduleType("available"); }}
            >
              Отмена
            </button>
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              disabled={!selectedDriverId || addMutation.isPending}
              onClick={() =>
                addMutation.mutate({
                  driverId: selectedDriverId,
                  dateFrom: addDateFrom ? new Date(addDateFrom).toISOString() : null,
                  dateTo: addDateTo ? new Date(addDateTo).toISOString() : null,
                  scheduleType: addScheduleType || null,
                })
              }
            >
              Добавить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Driver schedule inline cell ──────────────────────────────────────────────

function DriverScheduleCell({
  unit,
  periodFrom,
  periodTo,
  allDrivers,
}: {
  unit: any;
  periodFrom: string;
  periodTo: string;
  allDrivers: any[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const driverId = unit.driverId;

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/driver-schedule", driverId],
    queryFn: () =>
      apiRequest("GET", `/api/logistics-plan/driver-schedule?driverId=${driverId}`)
        .then((r) => r.json()),
    enabled: !!driverId,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/driver-schedule", { ...data, driverId }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/driver-schedule", driverId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      form.reset({ type: "unavailable", dateFrom: periodFrom, dateTo: periodTo, reason: null });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logistics-plan/driver-schedule/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/driver-schedule", driverId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleAddSchema),
    defaultValues: { type: "unavailable", dateFrom: periodFrom, dateTo: periodTo, reason: null },
  });

  const onSubmit = (data: ScheduleFormData) => {
    addMutation.mutate({
      type: data.type,
      dateFrom: new Date(data.dateFrom).toISOString(),
      dateTo: new Date(data.dateTo).toISOString(),
      reason: data.reason || null,
    });
  };

  if (!driverId) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const unavailable = unit.driverUnavailable;
  const hasEntries = schedules.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors">
          {unavailable ? (
            <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
          )}
          <span className={cn("text-xs", unavailable ? "text-red-600" : "text-green-700")}>
            {unavailable ? "Недоступен" : "Доступен"}
          </span>
          {hasEntries && (
            <Badge variant="secondary" className="text-[10px] px-1 h-4">
              {schedules.length}
            </Badge>
          )}
          <Pencil className="h-3 w-3 text-muted-foreground ml-0.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="left" align="start">
        <p className="text-sm font-medium mb-2">Табель: {unit.driver?.fullName}</p>

        {/* Existing entries */}
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mb-3">
          {schedules.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет записей</p>
          ) : (
            schedules.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between gap-1 rounded border px-2 py-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Badge
                    variant={s.type === "available" ? "outline" : "destructive"}
                    className="text-[10px] shrink-0"
                  >
                    {SCHEDULE_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
                  </Badge>
                  <span className="text-xs truncate">
                    {fmtDate(s.dateFrom)} – {fmtDate(s.dateTo)}
                  </span>
                </div>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted shrink-0"
                  onClick={() => deleteMutation.mutate(s.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        <div className="border-t pt-2">
          <p className="text-xs font-medium mb-2">Добавить запись</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Тип</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SCHEDULE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Причина</FormLabel>
                      <FormControl>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Опционально"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="dateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">С</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-7 text-xs" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">По</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-7 text-xs" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={addMutation.isPending}>
                <Plus className="h-3 w-3 mr-1" />
                Добавить
              </Button>
            </form>
          </Form>
        </div>

        <ExtraDriversSection
          unit={unit}
          allDrivers={allDrivers}
          periodFrom={periodFrom}
          periodTo={periodTo}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Vehicle availability inline cell ─────────────────────────────────────────

function VehicleAvailabilityCell({
  unit,
  periodFrom,
  periodTo,
}: {
  unit: any;
  periodFrom: string;
  periodTo: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const vehicleId = unit.vehicleId;

  const { data: availabilities = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId],
    queryFn: () =>
      apiRequest("GET", `/api/logistics-plan/vehicle-availability?vehicleId=${vehicleId}`)
        .then((r) => r.json()),
    enabled: !!vehicleId,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/vehicle-availability", { ...data, vehicleId }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      form.reset({ type: "repair", dateFrom: periodFrom, dateTo: periodTo, reason: null });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/logistics-plan/vehicle-availability/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка", variant: "destructive" }),
  });

  const form = useForm<AvailabilityFormData>({
    resolver: zodResolver(availabilityAddSchema),
    defaultValues: { type: "repair", dateFrom: periodFrom, dateTo: periodTo, reason: null },
  });

  const onSubmit = (data: AvailabilityFormData) => {
    addMutation.mutate({
      type: data.type,
      dateFrom: new Date(data.dateFrom).toISOString(),
      dateTo: new Date(data.dateTo).toISOString(),
      reason: data.reason || null,
    });
  };

  if (!vehicleId) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const unavailable = unit.vehicleUnavailable;
  const periodEntries: any[] = unit.vehicleAvailabilityForPeriod ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors">
          {unavailable ? (
            <>
              <Wrench className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="text-xs text-red-600">Недоступен</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span className="text-xs text-green-700">Доступен</span>
            </>
          )}
          {availabilities.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 h-4">
              {availabilities.length}
            </Badge>
          )}
          <Pencil className="h-3 w-3 text-muted-foreground ml-0.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" side="left" align="start">
        <p className="text-sm font-medium mb-2">
          Доступность: {unit.vehicle?.regNumber}
        </p>

        {/* Existing entries */}
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto mb-3">
          {availabilities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет ограничений</p>
          ) : (
            availabilities.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-1 rounded border px-2 py-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    {AVAILABILITY_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
                  </Badge>
                  <span className="text-xs truncate">
                    {fmtDate(a.dateFrom)} – {fmtDate(a.dateTo)}
                  </span>
                  {a.reason && (
                    <span className="text-[10px] text-muted-foreground truncate">{a.reason}</span>
                  )}
                </div>
                <button
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted shrink-0"
                  onClick={() => deleteMutation.mutate(a.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add form */}
        <div className="border-t pt-2">
          <p className="text-xs font-medium mb-2">Добавить ограничение</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Тип</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {AVAILABILITY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Комментарий</FormLabel>
                      <FormControl>
                        <Input
                          className="h-7 text-xs"
                          placeholder="Опционально"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="dateFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">С</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-7 text-xs" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dateTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">По</FormLabel>
                      <FormControl>
                        <Input type="date" className="h-7 text-xs" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={addMutation.isPending}>
                <Plus className="h-3 w-3 mr-1" />
                Добавить
              </Button>
            </form>
          </Form>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TransportTab({ periodFrom, periodTo }: TransportTabProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntityId, setAuditEntityId] = useState<string | null>(null);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);

  const { data: units = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/transport-units", periodFrom, periodTo],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/logistics-plan/transport-units?periodFrom=${periodFrom}&periodTo=${periodTo}`,
      ).then((r) => r.json()),
  });

  const { data: allDrivers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/drivers"],
    queryFn: () => apiRequest("GET", "/api/logistics/drivers").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/logistics-plan/transport-units/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Транспортная единица удалена" });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "Ошибка удаления", variant: "destructive" }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Транспортные единицы (связки перевозчик + тягач + прицеп + водитель) на период
        </p>
        <Button
          onClick={() => {
            setEditingUnit(null);
            setUnitDialogOpen(true);
          }}
          data-testid="button-add-transport-unit"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Перевозчик</TableHead>
              <TableHead>Тягач</TableHead>
              <TableHead>Прицеп</TableHead>
              <TableHead className="text-right">Объём, м³</TableHead>
              <TableHead>Водитель</TableHead>
              <TableHead>Доступность водителя</TableHead>
              <TableHead>Доступность ТС</TableHead>
              <TableHead>Местонахождение</TableHead>
              <TableHead className="sticky right-0 bg-background z-10 w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Нет транспортных единиц. Добавьте первую.
                </TableCell>
              </TableRow>
            ) : (
              units.map((unit: any) => (
                <TableRow key={unit.id} data-testid={`row-transport-unit-${unit.id}`}>
                  {/* Carrier */}
                  <TableCell className="font-medium text-sm">
                    {unit.carrier?.name || <span className="text-muted-foreground">—</span>}
                  </TableCell>

                  {/* Vehicle */}
                  <TableCell>
                    {unit.vehicle?.regNumber ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{unit.vehicle.regNumber}</span>
                        </div>
                        {unit.vehicle.model && (
                          <span className="text-xs text-muted-foreground">{unit.vehicle.model}</span>
                        )}
                        {unit.vehicle.capacityKg && (
                          <span className="text-xs text-muted-foreground">
                            {parseFloat(unit.vehicle.capacityKg).toLocaleString("ru")} кг
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Trailer */}
                  <TableCell>
                    {unit.trailer?.regNumber ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm">{unit.trailer.regNumber}</span>
                        {unit.trailer.capacityKg && (
                          <span className="text-xs text-muted-foreground">
                            {parseFloat(unit.trailer.capacityKg).toLocaleString("ru")} кг
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Volume */}
                  <TableCell className="text-right tabular-nums text-sm">
                    {unit.trailerCapacityM3 ? (
                      parseFloat(unit.trailerCapacityM3).toFixed(1)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Driver */}
                  <TableCell>
                    {unit.driver?.fullName ? (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm">{unit.driver.fullName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>

                  {/* Driver availability — inline popover */}
                  <TableCell>
                    <DriverScheduleCell
                      unit={unit}
                      periodFrom={periodFrom}
                      periodTo={periodTo}
                      allDrivers={allDrivers}
                    />
                  </TableCell>

                  {/* Vehicle availability — inline popover */}
                  <TableCell>
                    <VehicleAvailabilityCell
                      unit={unit}
                      periodFrom={periodFrom}
                      periodTo={periodTo}
                    />
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    {unit.currentLocationName ? (
                      <span className="text-sm">{unit.currentLocationName}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="sticky right-0 bg-background z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`menu-transport-${unit.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingUnit(unit);
                            setUnitDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAuditEntityId(unit.id);
                            setAuditOpen(true);
                          }}
                        >
                          <History className="h-4 w-4 mr-2" />
                          История изменений
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(unit.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
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

      <TransportUnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        editingUnit={editingUnit}
        periodFrom={periodFrom}
        periodTo={periodTo}
      />

      {auditEntityId && (
        <AuditPanel
          open={auditOpen}
          onOpenChange={setAuditOpen}
          entityType="logistics_transport_units"
          entityId={auditEntityId}
        />
      )}
    </div>
  );
}
