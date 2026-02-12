import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
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

const storageCardFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  country: z.string().min(1, "Страна обязательна"),
  airport: z.string().min(1, "Аэропорт обязателен"),
  airportCode: z.string().optional(),
  currency: z.string().default("USD"),
  storageCost: z.string().optional(),
  notes: z.string().optional(),
});

type StorageCardFormData = z.infer<typeof storageCardFormSchema>;

interface StorageCard {
  id: string;
  name: string;
  country: string;
  airport: string;
  airportCode: string | null;
  currency: string | null;
  currentBalance: string | null;
  averageCost: string | null;
  averageCostCurrency: string | null;
  storageCost: string | null;
  notes: string | null;
  isActive: boolean | null;
  createdAt: string | null;
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
      country: editCard?.country || "",
      airport: editCard?.airport || "",
      airportCode: editCard?.airportCode || "",
      currency: editCard?.currency || "USD",
      storageCost: editCard?.storageCost || "",
      notes: editCard?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StorageCardFormData) => {
      const response = await apiRequest("POST", "/api/storage-cards", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
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
        data
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-cards/advances"] });
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
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Страна</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Германия"
                    data-testid="input-country"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="airport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Аэропорт</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Франкфурт"
                    data-testid="input-airport"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="airportCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Код аэропорта</FormLabel>
                <FormControl>
                  <Input
                    placeholder="FRA"
                    data-testid="input-airport-code"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Валюта</FormLabel>
                <FormControl>
                  <Input
                    placeholder="USD"
                    data-testid="input-currency"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="storageCost"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Стоимость хранения</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-storage-cost"
                  {...field}
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
