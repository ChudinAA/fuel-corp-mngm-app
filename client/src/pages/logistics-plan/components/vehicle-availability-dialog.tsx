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

const AVAILABILITY_TYPES = [
  { value: "maintenance", label: "ТО" },
  { value: "repair", label: "Ремонт" },
  { value: "to", label: "Технический осмотр" },
  { value: "other", label: "Другое" },
];

const formSchema = z.object({
  type: z.string().min(1, "Выберите тип"),
  dateFrom: z.string().min(1, "Укажите дату начала"),
  dateTo: z.string().min(1, "Укажите дату окончания"),
  reason: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface VehicleAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleRegNumber: string;
  periodFrom: string;
  periodTo: string;
}

export function VehicleAvailabilityDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleRegNumber,
  periodFrom,
  periodTo,
}: VehicleAvailabilityDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: availabilities = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId],
    queryFn: () =>
      apiRequest(`/api/logistics-plan/vehicle-availability?vehicleId=${vehicleId}`),
    enabled: open && !!vehicleId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "maintenance",
      dateFrom: periodFrom,
      dateTo: periodTo,
      reason: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        type: "maintenance",
        dateFrom: periodFrom,
        dateTo: periodTo,
        reason: null,
      });
    }
  }, [open, periodFrom, periodTo]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/logistics-plan/vehicle-availability", {
        method: "POST",
        body: JSON.stringify({ ...data, vehicleId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Запись добавлена" });
      form.reset({ type: "maintenance", dateFrom: periodFrom, dateTo: periodTo, reason: null });
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/logistics-plan/vehicle-availability/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/vehicle-availability", vehicleId] });
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Запись удалена" });
    },
    onError: () => toast({ title: "Ошибка удаления", variant: "destructive" }),
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
    return AVAILABILITY_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Доступность ТС: {vehicleRegNumber}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {availabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет ограничений доступности</p>
            ) : (
              availabilities.map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="destructive" className="text-xs">
                      {getTypeLabel(a.type)}
                    </Badge>
                    <span className="text-sm">
                      {format(new Date(a.dateFrom), "dd.MM.yy", { locale: ru })} —{" "}
                      {format(new Date(a.dateTo), "dd.MM.yy", { locale: ru })}
                    </span>
                    {a.reason && (
                      <span className="text-xs text-muted-foreground">{a.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(a.id)}
                    data-testid={`button-delete-availability-${a.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Добавить ограничение</p>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Причина</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {AVAILABILITY_TYPES.map((t) => (
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
                        <FormLabel>Комментарий</FormLabel>
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
