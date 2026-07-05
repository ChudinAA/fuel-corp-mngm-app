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
import { apiRequest } from "@/lib/queryClient";

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
}

export function AllocationDialog({
  open,
  onOpenChange,
  entry,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: AllocationFormEntry | null;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => (await apiRequest("GET", "/api/suppliers")).json(),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      fromCounterpartyId: "",
      toCounterpartyId: "",
      volume: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: entry ? entry.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
        fromCounterpartyId: entry?.fromCounterpartyId || "",
        toCounterpartyId: entry?.toCounterpartyId || "",
        volume: entry?.volume || "",
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

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));

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
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-allocation-date" />
                  </FormControl>
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
                      placeholder="Выберите поставщика"
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
                  <FormLabel>Куда (поставщик)</FormLabel>
                  <FormControl>
                    <Combobox
                      options={supplierOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Выберите поставщика"
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
                  <FormLabel>Объём</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} data-testid="input-allocation-volume" />
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
