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

interface StorageCard {
  id: string;
  name: string;
  cardType?: string | null;
  currency: string | null;
  currencySymbol: string | null;
  currencyId: string | null;
  supplierId?: string | null;
  buyerId?: string | null;
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

interface Supplier {
  id: string;
  name: string;
}

interface Buyer {
  id: string;
  name: string;
}

const storageCardFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  currency: z.string().default("USD"),
  currencySymbol: z.string().default("$"),
  currencyId: z.string().optional(),
  supplierId: z.string().optional(),
  buyerId: z.string().optional(),
  notes: z.string().optional(),
});

type StorageCardFormData = z.infer<typeof storageCardFormSchema>;

export function StorageCardForm({
  editCard,
  cardType = "supplier",
  onSuccess,
  onCancel,
}: {
  editCard?: StorageCard | null;
  cardType?: "supplier" | "buyer";
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isBuyer = cardType === "buyer";

  const form = useForm<StorageCardFormData>({
    resolver: zodResolver(storageCardFormSchema),
    defaultValues: {
      name: editCard?.name || "",
      currency: editCard?.currency || "USD",
      currencySymbol: editCard?.currencySymbol || "$",
      currencyId: editCard?.currencyId || "",
      supplierId: editCard?.supplierId || "",
      buyerId: editCard?.buyerId || "",
      notes: editCard?.notes || "",
    },
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: !isBuyer,
  });

  const { data: customers = [] } = useQuery<Buyer[]>({
    queryKey: ["/api/customers"],
    enabled: isBuyer,
  });

  const foreignCustomers = (customers as any[]).filter((c) => c.isForeign);
  const foreignSuppliers = (suppliers as any[]).filter((s) => s.isForeign);

  const createMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const payload = {
        ...data,
        cardType,
        supplierId: isBuyer ? null : (data.supplierId || null),
        buyerId: isBuyer ? (data.buyerId || null) : null,
      };
      const response = await apiRequest("POST", "/api/storage-cards", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-cards/advances"],
      });
      toast({ title: "Карта создана" });
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
      const payload = {
        ...data,
        cardType,
        supplierId: isBuyer ? null : (data.supplierId || null),
        buyerId: isBuyer ? (data.buyerId || null) : null,
      };
      const response = await apiRequest(
        "PATCH",
        `/api/storage-cards/${editCard?.id}`,
        payload,
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-cards/advances"],
      });
      toast({ title: "Карта обновлена" });
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
              <FormLabel>Название карты</FormLabel>
              <FormControl>
                <Input
                  placeholder="Карта аванса..."
                  data-testid="input-card-name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isBuyer && (
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Поставщик (зарубежный)</FormLabel>
                <FormControl>
                  <Combobox
                    options={[
                      { value: "", label: "— без привязки —" },
                      ...foreignSuppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                      })),
                      ...(suppliers as any[])
                        .filter((s) => !s.isForeign)
                        .map((s) => ({
                          value: s.id,
                          label: s.name,
                        })),
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Выберите поставщика..."
                    dataTestId="select-supplier"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isBuyer && (
          <FormField
            control={form.control}
            name="buyerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Покупатель (зарубежный)</FormLabel>
                <FormControl>
                  <Combobox
                    options={[
                      { value: "", label: "— без привязки —" },
                      ...foreignCustomers.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                      ...(customers as any[])
                        .filter((c) => !c.isForeign)
                        .map((c) => ({
                          value: c.id,
                          label: c.name,
                        })),
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Выберите покупателя..."
                    dataTestId="select-buyer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
                      dataTestId="select-currency"
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
