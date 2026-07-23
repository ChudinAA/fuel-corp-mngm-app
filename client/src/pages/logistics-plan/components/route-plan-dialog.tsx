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
import { format, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock } from "lucide-react";

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
}

export function RoutePlanDialog({
  open,
  onOpenChange,
  day,
  periodFrom,
  periodTo,
  units,
  routes,
}: RoutePlanDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const dayRoutes = routes.filter((r: any) => {
    if (!r.dateStart) return false;
    try {
      return isSameDay(parseISO(r.dateStart), day);
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

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/routes", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      toast({ title: "Маршрут добавлен" });
      form.reset();
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка создания маршрута", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/logistics-plan/routes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/calendar"] });
      toast({ title: "Маршрут удалён" });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка удаления", variant: "destructive" }),
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      transportUnitId: data.transportUnitId && data.transportUnitId !== NONE_VALUE ? data.transportUnitId : null,
      type: data.type,
      fromEntityName: data.fromEntityName || null,
      toEntityName: data.toEntityName || null,
      dateStart: new Date(data.dateStart).toISOString(),
      dateEnd: data.dateEnd ? new Date(data.dateEnd).toISOString() : null,
      notes: data.notes || null,
      isUnplanned: data.isUnplanned,
      periodFrom,
      periodTo,
    });
  };

  const getRouteStatusColor = (r: any) => {
    if (r.isLate) return "destructive";
    if (r.isDeadline) return "outline";
    if (r.isUnplanned) return "secondary";
    return "outline";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {format(day, "EEEE, d MMMM yyyy", { locale: ru })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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
                          {r.isLate && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Опоздание
                            </Badge>
                          )}
                          {r.isDeadline && !r.isLate && (
                            <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700">
                              <Clock className="h-3 w-3" />
                              Дедлайн
                            </Badge>
                          )}
                          {r.isUnplanned && (
                            <Badge variant="secondary" className="text-xs">Внеплановый</Badge>
                          )}
                        </div>
                        <span className="text-sm">
                          {r.fromEntityName || "?"} → {r.toEntityName || "?"}
                        </span>
                        {unit && (
                          <span className="text-xs text-muted-foreground">
                            ТС: {unit.vehicle?.regNumber || "—"}{unit.driver?.fullName ? `, ${unit.driver.fullName}` : ""}
                          </span>
                        )}
                        {r.notes && (
                          <span className="text-xs text-muted-foreground">{r.notes}</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive h-7 px-2"
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={cn(dayRoutes.length > 0 && "border-t pt-4")}>
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
                                {u.vehicle?.regNumber || "—"}{u.driver?.fullName ? ` / ${u.driver.fullName}` : ""}
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
                  <span className="text-xs text-muted-foreground">
                    Если маршрут не найден в справочнике,{" "}
                    <a href="/delivery" className="underline text-primary">перейдите в Доставку</a>{" "}
                    для добавления.
                  </span>
                  <Button type="submit" size="sm" disabled={createMutation.isPending}>
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
