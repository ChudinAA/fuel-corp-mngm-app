import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { tonsToKg, kgToTons } from "../utils/planning-utils";

const formSchema = z.object({
  date: z.string().min(1, "Дата обязательна"),
  fromCounterpartyId: z.string().min(1, "Обязательно"),
  toCounterpartyId: z.string().min(1, "Обязательно"),
  volume: z.string().min(1, "Объём обязателен"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface AllocationFormEntry {
  id: string;
  date: string;
  fromCounterpartyId: string | null;
  toCounterpartyId: string | null;
  volume: string;
  notes: string | null;
  fromName?: string | null;
  toName?: string | null;
}

interface PlanningResourceWithSupplier {
  id: string;
  supplierId: string;
  supplierName: string;
}

export function AllocationDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: AllocationFormEntry | null;
  onSubmit: (values: any) => Promise<void>;
  defaultDate?: string;
}) {
  const [saving, setSaving] = useState(false);

  const { data: planningResources = [] } = useQuery<PlanningResourceWithSupplier[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
  });

  const { data: customers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      fromCounterpartyId: "",
      toCounterpartyId: "",
      volume: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: entry ? entry.date.slice(0, 10) : (defaultDate || format(new Date(), "yyyy-MM-dd")),
        fromCounterpartyId: entry?.fromCounterpartyId || "",
        toCounterpartyId: entry?.toCounterpartyId || "",
        volume: entry ? kgToTons(entry.volume) : "",
        notes: entry?.notes || "",
      });
    }
  }, [open, entry, defaultDate]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        volume: tonsToKg(values.volume),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const supplierOptions = planningResources.map((r) => ({
    value: r.supplierId,
    label: r.supplierName,
  }));
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const dateValue = form.watch("date");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-allocation">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Редактировать распределение" : "Новое распределение свободного объёма"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateValue && "text-muted-foreground",
                          )}
                          data-testid="button-allocation-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateValue
                            ? format(new Date(dateValue + "T00:00:00"), "dd MMMM yyyy", { locale: ru })
                            : "Выберите дату"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateValue ? new Date(dateValue + "T00:00:00") : undefined}
                        onSelect={(date) => {
                          if (date) field.onChange(format(date, "yyyy-MM-dd"));
                        }}
                        locale={ru}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fromCounterpartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Откуда (поставщик)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={supplierOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={
                        planningResources.length === 0
                          ? "Нет ресурсов — добавьте на вкладке Объёмы"
                          : "Выберите поставщика"
                      }
                      dataTestId="select-from-counterparty"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="toCounterpartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Куда (клиент/покупатель)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={customerOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите клиента"
                      dataTestId="select-to-counterparty"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="volume"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Объём (т)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.001"
                      {...field}
                      data-testid="input-allocation-volume"
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
                  <FormLabel>Примечание</FormLabel>
                  <FormControl>
                    <Textarea {...field} data-testid="input-allocation-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving} data-testid="button-save-allocation">
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
