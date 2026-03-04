import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { format } from "date-fns";
import { STORAGE_CARD_TRANSACTION_TYPE } from "@shared/constants";
import { Combobox } from "@/components/ui/combobox";

const supplierDepositSchema = z.object({
  amount: z.string().min(1, "Сумма обязательна"),
  notes: z.string().optional(),
});

const buyerDepositSchema = z.object({
  amount: z.string().min(1, "Сумма (USD) обязательна"),
  localCurrencyId: z.string().optional(),
  localCurrencyAmount: z.string().optional(),
  exchangeRateToUsd: z.string().optional(),
  rateDate: z.string().optional(),
  notes: z.string().optional(),
});

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export function DepositForm({
  card,
  cardType = "supplier",
  onSuccess,
  onCancel,
}: {
  card: any;
  cardType?: "supplier" | "buyer";
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const isBuyer = cardType === "buyer";

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
    enabled: isBuyer,
  });

  const form = useForm<any>({
    resolver: zodResolver(isBuyer ? buyerDepositSchema : supplierDepositSchema),
    defaultValues: {
      amount: "",
      localCurrencyId: "",
      localCurrencyAmount: "",
      exchangeRateToUsd: "",
      rateDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload: any = {
        transactionType: STORAGE_CARD_TRANSACTION_TYPE.INCOME,
        quantity: parseFloat(data.amount),
        price: card.latestPrice?.price || 0,
        notes: data.notes || (isBuyer ? "Пополнение карты покупателя" : "Пополнение аванса"),
        transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      };

      if (isBuyer && data.localCurrencyId) {
        payload.localCurrencyId = data.localCurrencyId;
        payload.localCurrencyAmount = data.localCurrencyAmount
          ? parseFloat(data.localCurrencyAmount)
          : null;
        payload.exchangeRateToUsd = data.exchangeRateToUsd
          ? parseFloat(data.exchangeRateToUsd)
          : null;
        payload.rateDate = data.rateDate || null;
      }

      const response = await apiRequest(
        "POST",
        `/api/storage-cards/${card.id}/transactions`,
        payload,
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: isBuyer ? "Карта покупателя пополнена" : "Аванс успешно внесен",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма (USD)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  data-testid="input-deposit-amount"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isBuyer && (
          <>
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Пополнение в местной валюте (для расчёта ср. курса)
              </p>

              <FormField
                control={form.control}
                name="localCurrencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Валюта пополнения</FormLabel>
                    <FormControl>
                      <Combobox
                        options={currencies.map((c) => ({
                          value: c.id,
                          label: `${c.code} — ${c.name}`,
                        }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Выберите валюту..."
                        dataTestId="select-local-currency"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="localCurrencyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сумма в местной валюте</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-local-amount"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="exchangeRateToUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Курс к USD</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.00001"
                          placeholder="0.00000"
                          data-testid="input-exchange-rate"
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
                name="rateDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата пополнения</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-rate-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Комментарий</FormLabel>
              <FormControl>
                <Input
                  placeholder="Комментарий к платежу..."
                  data-testid="input-deposit-notes"
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
            data-testid="button-cancel-deposit"
          >
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={depositMutation.isPending}
            data-testid="button-confirm-deposit"
          >
            {isBuyer ? "Пополнить" : "Внести"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
