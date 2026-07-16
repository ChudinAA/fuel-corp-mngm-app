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
  counterpartyId: z.string().optional(),
  basisId: z.string().optional(),
  volume: z.string().min(1, "Объём обязателен"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface PlanEntryFormEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  counterpartyId: string | null;
  basisId?: string | null;
  volume: string;
  isManualBalance: boolean | null;
  balanceAfter: string | null;
  notes: string | null;
}

interface PlanningResourceWithSupplier {
  id: string;
  supplierId: string;
  supplierName: string;
  basisId?: string | null;
  basisName?: string | null;
}

export function PlanEntryDialog({
  open,
  onOpenChange,
  warehouseId,
  entry,
  onSubmit,
  defaultDate,
  defaultType,
  periodDates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  entry?: PlanEntryFormEntry | null;
  onSubmit: (values: any) => Promise<void>;
  defaultDate?: string;
  defaultType?: "income" | "expense";
  periodDates?: string[];
}) {
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: defaultDate || format(new Date(), "yyyy-MM-dd"),
      type: "income",
      counterpartyId: "",
      basisId: "",
      volume: "",
      notes: "",
    },
  });

  const type = form.watch("type");
  const counterpartyId = form.watch("counterpartyId");

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

  const { data: allBases = [] } = useQuery<{ id: string; name: string; code?: string }[]>({
    queryKey: ["/api/bases"],
    queryFn: async () => (await apiRequest("GET", "/api/bases")).json(),
    enabled: type === "expense",
  });

  // For income: load bases for selected supplier
  const selectedResource = planningResources.find((r) => r.supplierId === counterpartyId);
  const supplierIdForBases = selectedResource?.supplierId || "";

  const { data: supplierBases = [] } = useQuery<{ id: string; name: string; iataCode?: string }[]>({
    queryKey: ["/api/planning/supplier-bases", supplierIdForBases],
    queryFn: async () =>
      (await apiRequest("GET", `/api/planning/supplier-bases/${supplierIdForBases}`)).json(),
    enabled: type === "income" && !!supplierIdForBases,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: entry ? entry.date.slice(0, 10) : (defaultDate || format(new Date(), "yyyy-MM-dd")),
        type: entry?.type || defaultType || "income",
        counterpartyId: entry?.counterpartyId || "",
        basisId: entry?.basisId || "",
        volume: entry ? kgToTons(entry.volume) : "",
        notes: entry?.notes || "",
      });
    }
  }, [open, entry, defaultDate, defaultType]);

  // Auto-populate basisId from resource when supplier selected (income)
  useEffect(() => {
    if (type === "income" && selectedResource?.basisId) {
      const current = form.getValues("basisId");
      if (!current) {
        form.setValue("basisId", selectedResource.basisId);
      }
    }
  }, [selectedResource?.basisId, type]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        counterpartyId: values.counterpartyId || null,
        basisId: values.basisId || null,
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
    label: r.basisName ? `${r.supplierName} / ${r.basisName}` : r.supplierName,
  }));
  const expenseOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const counterpartyOptions = type === "income" ? incomeOptions : expenseOptions;

  // Basis options depend on type
  const incomeBasisOptions = supplierBases.map((b) => ({
    value: b.id,
    label: b.iataCode ? `${b.name} (${b.iataCode})` : b.name,
  }));
  const expenseBasisOptions = allBases.map((b) => ({
    value: b.id,
    label: (b as any).iataCode ? `${b.name} (${(b as any).iataCode})` : b.name,
  }));
  const basisOptions =
    type === "income" ? incomeBasisOptions : expenseBasisOptions;

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
                        form.setValue("basisId", "");
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
                        defaultMonth={dateValue ? new Date(dateValue + "T00:00:00") : undefined}
                        onSelect={(date) => {
                          if (date) field.onChange(format(date, "yyyy-MM-dd"));
                        }}
                        disabled={
                          periodDates && periodDates.length > 0
                            ? (date) => !periodDates.includes(format(date, "yyyy-MM-dd"))
                            : undefined
                        }
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
                  <FormLabel>
                    {type === "income" ? "Поставщик" : "Клиент"}
                    <span className="text-muted-foreground ml-1 text-xs">(необязательно)</span>
                  </FormLabel>
                  <FormControl>
                    <Combobox
                      options={[
                        { value: "", label: "— Не указан —" },
                        ...counterpartyOptions,
                      ]}
                      value={field.value || ""}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("basisId", "");
                      }}
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

            {type === "income" ? (
              <FormField
                control={form.control}
                name="basisId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Базис
                      <span className="text-muted-foreground ml-1 text-xs">(необязательно)</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: "", label: "— Не указан —" },
                          ...incomeBasisOptions,
                        ]}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        placeholder={
                          !counterpartyId
                            ? "Выберите базис"
                            : incomeBasisOptions.length === 0
                              ? "Нет баз для этого поставщика"
                              : "Выберите базис"
                        }
                        dataTestId="select-plan-entry-basis"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : expenseBasisOptions.length > 0 ? (
              <FormField
                control={form.control}
                name="basisId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Базис (необязательно)</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[{ value: "", label: "— Не указан —" }, ...expenseBasisOptions]}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        placeholder="Выберите базис"
                        dataTestId="select-plan-entry-basis"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

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
