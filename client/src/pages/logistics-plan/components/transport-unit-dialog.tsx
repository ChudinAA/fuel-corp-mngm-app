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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  carrierId: z.string().optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  trailerId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  trailerCapacityM3: z.string().optional().nullable(),
  currentLocationEntityType: z.string().optional().nullable(),
  currentLocationEntityId: z.string().optional().nullable(),
  currentLocationName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface TransportUnitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUnit: any | null;
  periodFrom: string;
  periodTo: string;
}

const NONE_VALUE = "__none__";

function nullifyNone(val: string | null | undefined) {
  if (!val || val === NONE_VALUE) return null;
  return val;
}

export function TransportUnitDialog({
  open,
  onOpenChange,
  editingUnit,
  periodFrom,
  periodTo,
}: TransportUnitDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: carriers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
    queryFn: () => apiRequest("GET", "/api/logistics/carriers").then((r) => r.json()),
  });
  const { data: vehicles = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/vehicles"],
    queryFn: () => apiRequest("GET", "/api/logistics/vehicles").then((r) => r.json()),
  });
  const { data: trailers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/trailers"],
    queryFn: () => apiRequest("GET", "/api/logistics/trailers").then((r) => r.json()),
  });
  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ["/api/logistics/drivers"],
    queryFn: () => apiRequest("GET", "/api/logistics/drivers").then((r) => r.json()),
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      carrierId: null,
      vehicleId: null,
      trailerId: null,
      driverId: null,
      trailerCapacityM3: null,
      currentLocationEntityType: null,
      currentLocationEntityId: null,
      currentLocationName: null,
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingUnit) {
        form.reset({
          carrierId: editingUnit.carrierId || null,
          vehicleId: editingUnit.vehicleId || null,
          trailerId: editingUnit.trailerId || null,
          driverId: editingUnit.driverId || null,
          trailerCapacityM3: editingUnit.trailerCapacityM3 || null,
          currentLocationEntityType: editingUnit.currentLocationEntityType || null,
          currentLocationEntityId: editingUnit.currentLocationEntityId || null,
          currentLocationName: editingUnit.currentLocationName || null,
          notes: editingUnit.notes || null,
        });
      } else {
        form.reset({
          carrierId: null,
          vehicleId: null,
          trailerId: null,
          driverId: null,
          trailerCapacityM3: null,
          currentLocationEntityType: null,
          currentLocationEntityId: null,
          currentLocationName: null,
          notes: null,
        });
      }
    }
  }, [open, editingUnit]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/logistics-plan/transport-units", data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Транспортная единица добавлена" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка сохранения", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/logistics-plan/transport-units/${editingUnit.id}`, data).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/logistics-plan/transport-units"] });
      toast({ title: "Транспортная единица обновлена" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: e?.message || "Ошибка обновления", variant: "destructive" }),
  });

  const onSubmit = (data: FormData) => {
    const payload = {
      carrierId: nullifyNone(data.carrierId),
      vehicleId: nullifyNone(data.vehicleId),
      trailerId: nullifyNone(data.trailerId),
      driverId: nullifyNone(data.driverId),
      trailerCapacityM3: data.trailerCapacityM3 || null,
      currentLocationEntityType: nullifyNone(data.currentLocationEntityType),
      currentLocationEntityId: nullifyNone(data.currentLocationEntityId),
      currentLocationName: data.currentLocationName || null,
      notes: data.notes || null,
    };
    if (editingUnit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingUnit ? "Редактировать транспортную единицу" : "Добавить транспортную единицу"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="carrierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Перевозчик</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-carrier">
                        <SelectValue placeholder="Выберите перевозчика" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                      {carriers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тягач</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-vehicle">
                        <SelectValue placeholder="Выберите тягач" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                      {vehicles.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.regNumber}{v.model ? ` (${v.model})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="trailerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Полуприцеп</FormLabel>
                    <Select
                      value={field.value || NONE_VALUE}
                      onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-trailer">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                        {trailers.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.regNumber}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trailerCapacityM3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Объём, м³</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0.0"
                        data-testid="input-trailer-capacity"
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
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Водитель</FormLabel>
                  <Select
                    value={field.value || NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-driver">
                        <SelectValue placeholder="Выберите водителя" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>— Не указан —</SelectItem>
                      {drivers.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currentLocationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Текущее местонахождение</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Название пункта"
                      data-testid="input-location-name"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Комментарий..."
                      data-testid="textarea-notes"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-unit">
                {isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
