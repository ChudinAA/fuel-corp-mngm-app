import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { tonsToKg, kgToTons } from "../utils/planning-utils";

const formSchema = z.object({
  date: z.string().min(1, "Дата обязательна"),
  type: z.enum(["income", "expense"]),
  counterpartyId: z.string().min(1, "Контрагент обязателен"),
  volume: z.string().min(1, "Объём обязателен"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface PlanEntryFormEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  counterpartyId: string | null;
  volume: string;
  isManualBalance: boolean | null;
  balanceAfter: string | null;
  notes: string | null;
}

interface PlanningResourceWithSupplier {
  id: string;
  supplierId: string;
  supplierName: string;
}

export function PlanEntryDialog({
  open,
  onOpenChange,
  warehouseId,
  entry,
  onSubmit,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  entry?: PlanEntryFormEntry | null;
  onSubmit: (values: any) => Promise<void>;
  defaultDate?: string;
}) {
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      type: "income",
      counterpartyId: "",
      volume: "",
      notes: "",
    },
  });

  const type = form.watch("type");

  const { data: planningResources = [] } = useQuery<PlanningResourceWithSupplier[]>({
    queryKey: ["/api/planning/resources"],
    queryFn: async () => (await apiRequest("GET", "/api/planning/resources")).json(),
    enabled: type === "income",
  });

  const { data: customers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => (await apiRequest("GET", "/api/customers")).json(),
    enabled: type === "expense",
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: entry ? entry.date.slice(0, 10) : (defaultDate || format(new Date(), "yyyy-MM-dd")),
        type: entry?.type || "income",
        counterpartyId: entry?.counterpartyId || "",
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
        isManualBalance: false,
        balanceAfter: null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const incomeOptions = planningResources.map((r) => ({
    value: r.supplierId,
    label: r.supplierName,
  }));
  const expenseOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const counterpartyOptions = type === "income" ? incomeOptions : expenseOptions;

  const dateValue = form.watch("date");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-plan-entry">
        <DialogHeader>
          <DialogTitle>
            {entry ? "Редактировать запись плана" : "Новая запись плана"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип записи</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("counterpartyId", "");
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="income" id="type-income" data-testid="radio-type-income" />
                        <label htmlFor="type-income" className="cursor-pointer">Приход (от поставщика)</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="expense" id="type-expense" data-testid="radio-type-expense" />
                        <label htmlFor="type-expense" className="cursor-pointer">Расход (клиенту)</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          data-testid="button-plan-entry-date"
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
              name="counterpartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{type === "income" ? "Поставщик" : "Клиент"}</FormLabel>
                  <FormControl>
                    <Combobox
                      options={counterpartyOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={
                        type === "income"
                          ? planningResources.length === 0
                            ? "Нет ресурсов — добавьте на вкладке Объёмы"
                            : "Выберите поставщика"
                          : "Выберите клиента"
                      }
                      dataTestId="select-counterparty"
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
                      data-testid="input-plan-entry-volume"
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
                    <Textarea {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving} data-testid="button-save-plan-entry">
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
