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
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  date: z.string().min(1, "Дата обязательна"),
  type: z.enum(["income", "expense"]),
  counterpartyId: z.string().min(1, "Контрагент обязателен"),
  volume: z.string().min(1, "Объём обязателен"),
  isManualBalance: z.boolean().default(false),
  balanceAfter: z.string().optional(),
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

export function PlanEntryDialog({
  open,
  onOpenChange,
  warehouseId,
  entry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouseId: string;
  entry?: PlanEntryFormEntry | null;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      type: "income",
      counterpartyId: "",
      volume: "",
      isManualBalance: false,
      balanceAfter: "",
      notes: "",
    },
  });

  const type = form.watch("type");

  const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => (await apiRequest("GET", "/api/suppliers")).json(),
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
        date: entry ? entry.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
        type: entry?.type || "income",
        counterpartyId: entry?.counterpartyId || "",
        volume: entry?.volume || "",
        isManualBalance: entry?.isManualBalance || false,
        balanceAfter: entry?.balanceAfter || "",
        notes: entry?.notes || "",
      });
    }
  }, [open, entry]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const counterpartyOptions = (type === "income" ? suppliers : customers).map((c) => ({
    value: c.id,
    label: c.name,
  }));

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
                        <label htmlFor="type-income">Приход (от поставщика)</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="expense" id="type-expense" data-testid="radio-type-expense" />
                        <label htmlFor="type-expense">Расход (клиенту)</label>
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
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-plan-entry-date" />
                  </FormControl>
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
                      placeholder="Выберите контрагента"
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
                  <FormLabel>Объём</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} data-testid="input-plan-entry-volume" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isManualBalance"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2">
                  <FormLabel>Указать остаток вручную</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-manual-balance"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch("isManualBalance") && (
              <FormField
                control={form.control}
                name="balanceAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Остаток после операции</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-balance-after" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
