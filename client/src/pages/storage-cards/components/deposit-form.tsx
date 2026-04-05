import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useErrorModal } from "@/hooks/use-error-modal";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STORAGE_CARD_TRANSACTION_TYPE } from "@shared/constants";
import { Combobox } from "@/components/ui/combobox";
import { useEffect } from "react";

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

const depositSchema = z.object({
  currencyMode: z.enum(["USD", "local"]).default("USD"),
  localCurrencyId: z.string().optional(),
  localAmount: z.string().optional(),
  exchangeRate: z.string().optional(),
  rateDate: z.string().optional(),
  amountUsd: z.string().min(1, "Сумма (USD) обязательна"),
  notes: z.string().optional(),
});

type DepositFormData = z.infer<typeof depositSchema>;

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
  const { showError, ErrorModalComponent } = useErrorModal();
  const isBuyer = cardType === "buyer";

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
    enabled: isBuyer,
  });

  // Determine if this buyer card has already been topped up (currency is locked)
  const cardBalance = parseFloat(String(card.currentBalance || "0"));
  const hasExistingDeposits = isBuyer && cardBalance !== 0;
  const lockedLocalCurrencyCode = isBuyer && hasExistingDeposits ? (card.localCurrencyCode || null) : null;
  const isLockedToUsd = isBuyer && hasExistingDeposits && !card.localCurrencyCode;
  const currencyIsLocked = hasExistingDeposits;

  const form = useForm<DepositFormData>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      currencyMode: "USD",
      localCurrencyId: "",
      localAmount: "",
      exchangeRate: "",
      rateDate: format(new Date(), "yyyy-MM-dd"),
      amountUsd: "",
      notes: "",
    },
  });

  // Set initial currency after currencies load
  useEffect(() => {
    if (!isBuyer || currencies.length === 0) return;

    if (currencyIsLocked) {
      // Card already has deposits — lock to existing currency
      if (isLockedToUsd) {
        form.setValue("currencyMode", "USD");
        form.setValue("localCurrencyId", "");
      } else if (lockedLocalCurrencyCode) {
        const lockedCurrency = currencies.find((c) => c.code === lockedLocalCurrencyCode);
        if (lockedCurrency) {
          form.setValue("currencyMode", "local");
          form.setValue("localCurrencyId", lockedCurrency.id);
        }
      }
    } else {
      // New card — default to RUB
      const rubCurrency = currencies.find((c) => c.code === "RUB");
      if (rubCurrency) {
        form.setValue("currencyMode", "local");
        form.setValue("localCurrencyId", rubCurrency.id);
      }
    }
  }, [currencies, isBuyer, currencyIsLocked, isLockedToUsd, lockedLocalCurrencyCode]);

  const currencyMode = useWatch({ control: form.control, name: "currencyMode" });
  const localAmount = useWatch({ control: form.control, name: "localAmount" });
  const exchangeRate = useWatch({ control: form.control, name: "exchangeRate" });
  const isLocalMode = isBuyer && currencyMode === "local";

  // Auto-calculate USD amount from local amount and rate
  useEffect(() => {
    if (!isLocalMode) return;
    const local = parseFloat(localAmount || "0");
    const rate = parseFloat(exchangeRate || "0");
    if (local > 0 && rate > 0) {
      const usd = local / rate;
      form.setValue("amountUsd", usd.toFixed(2));
    } else {
      form.setValue("amountUsd", "");
    }
  }, [localAmount, exchangeRate, isLocalMode, form]);

  const selectedCurrency = currencies.find(
    (c) => c.id === form.watch("localCurrencyId"),
  );

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFormData) => {
      const quantity = parseFloat(data.amountUsd);

      const payload: any = {
        transactionType: STORAGE_CARD_TRANSACTION_TYPE.INCOME,
        quantity,
        price: card.latestPrice?.price || 0,
        notes: data.notes || (isBuyer ? "Пополнение карты покупателя" : "Пополнение аванса"),
        transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
      };

      if (isLocalMode && data.localCurrencyId && data.localAmount && data.exchangeRate) {
        payload.localCurrencyId = data.localCurrencyId;
        payload.localCurrencyAmount = parseFloat(data.localAmount);
        payload.exchangeRateToUsd = parseFloat(data.exchangeRate);
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
      showError(error.message);
    },
  });

  return (
    <>
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((data) => depositMutation.mutate(data))}
        className="space-y-4"
      >
        {isBuyer && (
          <FormField
            control={form.control}
            name="currencyMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Валюта пополнения</FormLabel>
                <FormControl>
                  <Combobox
                    options={[
                      { value: "USD", label: "USD — Доллар США" },
                      ...currencies
                        .filter((c) => c.code !== "USD")
                        .map((c) => ({
                          value: "local:" + c.id,
                          label: `${c.code} — ${c.name}`,
                        })),
                    ]}
                    value={
                      field.value === "USD"
                        ? "USD"
                        : "local:" + form.watch("localCurrencyId")
                    }
                    onValueChange={(val) => {
                      if (currencyIsLocked) return;
                      if (val === "USD") {
                        field.onChange("USD");
                        form.setValue("localCurrencyId", "");
                        form.setValue("localAmount", "");
                        form.setValue("exchangeRate", "");
                        form.setValue("amountUsd", "");
                      } else {
                        const currId = val.replace("local:", "");
                        field.onChange("local");
                        form.setValue("localCurrencyId", currId);
                        form.setValue("amountUsd", "");
                      }
                    }}
                    placeholder="Выберите валюту..."
                    dataTestId="select-currency-mode"
                    disabled={currencyIsLocked}
                  />
                </FormControl>
                {currencyIsLocked && (
                  <p className="text-xs text-muted-foreground">
                    Валюта зафиксирована по первому пополнению и не может быть изменена
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isLocalMode && (
          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Пополнение в {selectedCurrency?.code || "местной валюте"}
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="localAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Сумма ({selectedCurrency?.code || "местн. вал."})
                    </FormLabel>
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
                name="exchangeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Курс ({selectedCurrency?.code || "местн."} за 1 USD)
                    </FormLabel>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                          )}
                          data-testid="button-rate-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value
                            ? format(parseISO(field.value), "dd MMMM yyyy", {
                                locale: ru,
                              })
                            : "Выберите дату"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? parseISO(field.value) : undefined}
                        onSelect={(date) =>
                          field.onChange(
                            date ? format(date, "yyyy-MM-dd") : "",
                          )
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
          </div>
        )}

        <FormField
          control={form.control}
          name="amountUsd"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Сумма (USD)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  readOnly={isLocalMode}
                  className={isLocalMode ? "bg-muted text-muted-foreground cursor-not-allowed" : ""}
                  data-testid="input-deposit-amount"
                  {...field}
                />
              </FormControl>
              {isLocalMode && (
                <p className="text-xs text-muted-foreground">
                  Рассчитывается автоматически из местной валюты и курса
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

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
    <ErrorModalComponent />
    </>
  );
}
