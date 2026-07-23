import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const SCHEDULE_TYPES = [
  { value: "available", label: "Доступен" },
  { value: "unavailable", label: "Недоступен" },
  { value: "vacation", label: "Отпуск" },
  { value: "sick", label: "Больничный" },
  { value: "other", label: "Другое" },
];

const formSchema = z.object({
  type: z.string().min(1, "Выберите тип"),
  dateFrom: z.string().min(1, "Укажите дату начала"),
  dateTo: z.string().min(1, "Укажите дату окончания"),
  reason: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface DriverScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  periodFrom: string;
  periodTo: string;
}

export function DriverScheduleDialog({
  open,
  onOpenChange,
  driverId,
  driverName,
  periodFrom,
  periodTo,
}: DriverScheduleDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/driver-schedule", driverId],
    queryFn: () =>
      apiRequest("GET", `/api/logistics-plan/driver-schedule?driverId=${driverId}`).then((r) => r.json()),
    enabled: open && !!driverId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "unavailable",
      dateFrom: periodFrom,
      dateTo: periodTo,
      reason: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        type: "unavailable",
        dateFrom: periodFrom,
        dateTo: periodTo,
        reason: null,
      });
    }
  }, [open, periodFrom, periodTo]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/driver-schedule", { ...data, driverId }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/driver-schedule", driverId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Запись добавлена" });
      form.reset({ type: "unavailable", dateFrom: periodFrom, dateTo: periodTo, reason: null });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка сохранения", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/logistics-plan/driver-schedule/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/driver-schedule", driverId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Запись удалена" });
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка удаления", variant: "destructive" }),
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      type: data.type,
      dateFrom: new Date(data.dateFrom).toISOString(),
      dateTo: new Date(data.dateTo).toISOString(),
      reason: data.reason || null,
    });
  };

  const getTypeLabel = (type: string) => {
    return SCHEDULE_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getTypeBadge = (type: string) => {
    if (type === "available") return "outline";
    if (type === "vacation" || type === "sick") return "secondary";
    return "destructive";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Табель водителя: {driverName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет записей в табеле</p>
            ) : (
              schedules.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={getTypeBadge(s.type) as any} className="text-xs">
                      {getTypeLabel(s.type)}
                    </Badge>
                    <span className="text-sm">
                      {format(new Date(s.dateFrom), "dd.MM.yy", { locale: ru })} —{" "}
                      {format(new Date(s.dateTo), "dd.MM.yy", { locale: ru })}
                    </span>
                    {s.reason && (
                      <span className="text-xs text-muted-foreground">{s.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(s.id)}
                    data-testid={`button-delete-schedule-${s.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Добавить запись</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
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
                            {SCHEDULE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Причина (опц.)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Комментарий"
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
                    name="dateFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>С</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>По</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={createMutation.isPending}>
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить
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
