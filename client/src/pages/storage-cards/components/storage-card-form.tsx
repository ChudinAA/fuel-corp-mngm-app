import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

const storageCardFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  currency: z.string().default("USD"),
  currencySymbol: z.string().default("$"),
  currencyId: z.string().optional(),
  notes: z.string().optional(),
});

type StorageCardFormData = z.infer<typeof storageCardFormSchema>;

interface StorageCard {
  id: string;
  name: string;
  currency: string | null;
  currencySymbol: string | null;
  currencyId: string | null;
  currentBalance: string | null;
  averageCost: string | null;
  notes: string | null;
  isActive: boolean | null;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export function StorageCardForm({
  editCard,
  onSuccess,
  onCancel,
}: {
  editCard?: StorageCard | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();

  const form = useForm<StorageCardFormData>({
    resolver: zodResolver(storageCardFormSchema),
    defaultValues: {
      name: editCard?.name || "",
      currency: editCard?.currency || "USD",
      currencySymbol: editCard?.currencySymbol || "$",
      currencyId: editCard?.currencyId || "",
      notes: editCard?.notes || "",
    },
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest("POST", "/api/storage-cards", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-cards/advances"],
      });
      toast({ title: "Карта хранения создана" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка создания",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest(
        "PATCH",
        `/api/storage-cards/${editCard?.id}`,
        data,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-cards/advances"],
      });
      toast({ title: "Карта хранения обновлена" });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка обновления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: StorageCardFormData) => {
    if (editCard) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название</FormLabel>
              <FormControl>
                <Input
                  placeholder="Карта хранения..."
                  data-testid="input-card-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="currencyId"
            render={({ field }) => (
              <FormItem className="col-span-1 min-w-0">
                <FormLabel>Валюта</FormLabel>
                <FormControl>
                  <div className="w-full">
                    <Combobox
                      options={currencies.map((c) => ({
                        value: c.id,
                        label: c.code,
                      }))}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const currency = currencies?.find(
                          (c) => c.id === value,
                        );
                        if (currency) {
                          form.setValue("currency", currency.code);
                          form.setValue("currencySymbol", currency.symbol);
                        }
                      }}
                      placeholder="USD"
                      className="w-full"
                      dataTestId="select-base-type"
                    />
                  </div>
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
                  <Input
                    placeholder="Примечания..."
                    data-testid="input-notes"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            data-testid="button-submit"
          >
            {editCard ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
