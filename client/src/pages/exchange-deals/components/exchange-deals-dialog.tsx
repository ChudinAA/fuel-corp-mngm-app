import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ChevronsUpDown, Check, Wallet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  dealNumber: z.string().nullable().optional(),
  dealDate: z.string().nullable().optional(),
  departureStationId: z.string().uuid().nullable().optional(),
  destinationStationId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  pricePerTon: z.string().nullable().optional(),
  weightTon: z.string().nullable().optional(),
  actualWeightTon: z.string().nullable().optional(),
  deliveryTariffId: z.string().uuid().nullable().optional(),
  wagonDepartureDate: z.string().nullable().optional(),
  plannedDeliveryDate: z.string().nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  wagonNumbers: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDraft: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface ExchangeDealsDialogProps {
  open: boolean;
  onClose: () => void;
  deal?: any | null;
  isCopy?: boolean;
}

function ComboboxField({
  label,
  value,
  onChange,
  options,
  placeholder = "Выбрать...",
  testId,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  options: { id: string; label: string; sub?: string }[];
  placeholder?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            data-testid={testId}
            className="w-full justify-between font-normal"
          >
            {selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Поиск..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>Ничего не найдено</CommandEmpty>
            <CommandGroup>
              <ScrollArea className="max-h-48">
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(null); setOpen(false); setSearch(""); }}
                  className="text-muted-foreground"
                >
                  — Не выбрано
                </CommandItem>
                {filtered.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => { onChange(o.id); setOpen(false); setSearch(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === o.id ? "opacity-100" : "opacity-0")} />
                    <div>
                      <div>{o.label}</div>
                      {o.sub && <div className="text-xs text-muted-foreground">{o.sub}</div>}
                    </div>
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (val: string | null) => void;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-testid={testId}
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd.MM.yyyy", { locale: ru }) : "Выбрать дату"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
            locale={ru}
            initialFocus
          />
          {value && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { onChange(null); setOpen(false); }}
              >
                Очистить
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ExchangeDealsDialog({ open, onClose, deal, isCopy }: ExchangeDealsDialogProps) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dealNumber: "",
      dealDate: null,
      departureStationId: null,
      destinationStationId: null,
      buyerId: null,
      paymentDate: null,
      pricePerTon: "",
      weightTon: "",
      actualWeightTon: "",
      deliveryTariffId: null,
      wagonDepartureDate: null,
      plannedDeliveryDate: null,
      sellerId: null,
      wagonNumbers: "",
      notes: "",
      isDraft: false,
    },
  });

  const watchPricePerTon = form.watch("pricePerTon");
  const watchWeightTon = form.watch("weightTon");
  const watchActualWeightTon = form.watch("actualWeightTon");
  const watchDeliveryTariffId = form.watch("deliveryTariffId");
  const watchSellerId = form.watch("sellerId");

  // Load data
  const { data: stations = [] } = useQuery<any[]>({
    queryKey: ["/api/railway/stations"],
  });
  const { data: tariffs = [] } = useQuery<any[]>({
    queryKey: ["/api/railway/tariffs"],
  });
  const { data: customers = [] } = useQuery<any[]>({
    queryKey: ["/api/customers"],
  });
  const { data: suppliers = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  // Seller advance card
  const { data: sellerCard } = useQuery<any>({
    queryKey: ["/api/exchange-advances/by-seller", watchSellerId],
    enabled: !!watchSellerId,
    queryFn: async () => {
      if (!watchSellerId) return null;
      const res = await fetch(`/api/exchange-advances/by-seller?sellerId=${watchSellerId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Selected tariff for price
  const selectedTariff = tariffs.find((t: any) => t.id === watchDeliveryTariffId);
  const tariffPrice = selectedTariff ? parseFloat(selectedTariff.pricePerTon) : 0;

  // Calculations
  const pricePerTon = parseFloat(watchPricePerTon || "0") || 0;
  const weightTon = parseFloat(watchWeightTon || "0") || 0;
  const actualWeightTon = parseFloat(watchActualWeightTon || "0") || 0;

  const purchaseAmount = weightTon * pricePerTon;
  const deliveryCostTotal = tariffPrice * weightTon;
  const totalCostWithDelivery = purchaseAmount + deliveryCostTotal;
  const costPerTon = weightTon > 0 ? totalCostWithDelivery / weightTon : 0;
  const reservedFunds = purchaseAmount * 0.05;
  const sellerRemainder = sellerCard ? parseFloat(sellerCard.currentBalance || "0") : 0;

  const formatMoney = (val: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 }).format(val);

  // Populate form when editing
  useEffect(() => {
    if (deal) {
      form.reset({
        dealNumber: deal.dealNumber || "",
        dealDate: deal.dealDate || null,
        departureStationId: deal.departureStationId || null,
        destinationStationId: deal.destinationStationId || null,
        buyerId: deal.buyerId || null,
        paymentDate: deal.paymentDate || null,
        pricePerTon: deal.pricePerTon || "",
        weightTon: deal.weightTon || "",
        actualWeightTon: deal.actualWeightTon || "",
        deliveryTariffId: deal.deliveryTariffId || null,
        wagonDepartureDate: deal.wagonDepartureDate || null,
        plannedDeliveryDate: deal.plannedDeliveryDate || null,
        sellerId: deal.sellerId || null,
        wagonNumbers: deal.wagonNumbers || "",
        notes: deal.notes || "",
        isDraft: isCopy ? true : (deal.isDraft || false),
      });
    } else {
      form.reset({
        dealNumber: "",
        dealDate: null,
        departureStationId: null,
        destinationStationId: null,
        buyerId: null,
        paymentDate: null,
        pricePerTon: "",
        weightTon: "",
        actualWeightTon: "",
        deliveryTariffId: null,
        wagonDepartureDate: null,
        plannedDeliveryDate: null,
        sellerId: null,
        wagonNumbers: "",
        notes: "",
        isDraft: false,
      });
    }
  }, [deal, isCopy, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues & { isDraft: boolean }) => {
      if (deal && !isCopy) {
        return apiRequest("PATCH", `/api/exchange-deals/${deal.id}`, data);
      }
      return apiRequest("POST", "/api/exchange-deals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-advances"] });
      toast({ title: deal && !isCopy ? "Сделка обновлена" : "Сделка создана" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (isDraft: boolean) => {
    const values = form.getValues();
    mutation.mutate({ ...values, isDraft });
  };

  const stationOptions = stations.map((s: any) => ({ id: s.id, label: s.name, sub: s.code }));
  const tariffOptions = tariffs.map((t: any) => ({
    id: t.id,
    label: t.zoneName,
    sub: `${formatMoney(parseFloat(t.pricePerTon))}/тн`,
  }));
  const customerOptions = customers.map((c: any) => ({ id: c.id, label: c.name }));
  const supplierOptions = suppliers.map((s: any) => ({ id: s.id, label: s.name }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deal && !isCopy ? "Редактировать сделку Биржи" : isCopy ? "Копия сделки Биржи" : "Новая сделка Биржи"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4">
            {/* Row 1: Deal number and date */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dealNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>№ биржевой сделки</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Номер сделки"
                        data-testid="input-deal-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DatePickerField
                label="Дата"
                value={form.watch("dealDate")}
                onChange={(v) => form.setValue("dealDate", v)}
                testId="button-deal-date"
              />
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Маршрут</p>

            {/* Row 2: Stations */}
            <div className="grid grid-cols-2 gap-4">
              <ComboboxField
                label="Ст. отправления"
                value={form.watch("departureStationId")}
                onChange={(v) => form.setValue("departureStationId", v)}
                options={stationOptions}
                placeholder="Выберите станцию..."
                testId="select-departure-station"
              />
              <ComboboxField
                label="Ст. назначения"
                value={form.watch("destinationStationId")}
                onChange={(v) => form.setValue("destinationStationId", v)}
                options={stationOptions}
                placeholder="Выберите станцию..."
                testId="select-destination-station"
              />
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Контрагенты</p>

            {/* Row 3: Buyer, Seller */}
            <div className="grid grid-cols-2 gap-4">
              <ComboboxField
                label="Покупатель"
                value={form.watch("buyerId")}
                onChange={(v) => form.setValue("buyerId", v)}
                options={customerOptions}
                placeholder="Выберите покупателя..."
                testId="select-buyer"
              />
              <ComboboxField
                label="Продавец"
                value={form.watch("sellerId")}
                onChange={(v) => form.setValue("sellerId", v)}
                options={supplierOptions}
                placeholder="Выберите продавца..."
                testId="select-seller"
              />
            </div>

            {/* Seller advance card balance */}
            {watchSellerId && sellerCard && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Баланс аванса продавца:&nbsp;
                  <span className="font-semibold">{formatMoney(sellerRemainder)}</span>
                </span>
              </div>
            )}
            {watchSellerId && !sellerCard && (
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">Карта аванса будет создана автоматически при сохранении</p>
              </div>
            )}

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Финансы</p>

            {/* Row 4: Prices and weights */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="pricePerTon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость за тонну, руб</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-price-per-ton"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weightTon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Вес, тн</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        data-testid="input-weight-ton"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="actualWeightTon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Вес фактический, тн</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        data-testid="input-actual-weight-ton"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Delivery tariff */}
            <div className="grid grid-cols-2 gap-4">
              <ComboboxField
                label="Доставка за тонну (тариф)"
                value={form.watch("deliveryTariffId")}
                onChange={(v) => form.setValue("deliveryTariffId", v)}
                options={tariffOptions}
                placeholder="Выберите тариф..."
                testId="select-delivery-tariff"
              />
              <DatePickerField
                label="Дата оплаты"
                value={form.watch("paymentDate")}
                onChange={(v) => form.setValue("paymentDate", v)}
                testId="button-payment-date"
              />
            </div>

            {/* Calculated fields */}
            {(pricePerTon > 0 || weightTon > 0) && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted text-sm">
                <div>
                  <span className="text-muted-foreground">Сумма закупки:</span>
                  <span className="ml-2 font-medium">{formatMoney(purchaseAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Доставка (всего):</span>
                  <span className="ml-2 font-medium">{formatMoney(deliveryCostTotal)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Себестоимость с доставкой:</span>
                  <span className="ml-2 font-medium">{formatMoney(totalCostWithDelivery)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Себестоимость за тн:</span>
                  <span className="ml-2 font-medium">{formatMoney(costPerTon)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Зарезервировано (5%):</span>
                  <span className="ml-2 font-medium">{formatMoney(reservedFunds)}</span>
                </div>
              </div>
            )}

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Логистика</p>

            {/* Row 6: Dates */}
            <div className="grid grid-cols-2 gap-4">
              <DatePickerField
                label="Дата выхода вагона"
                value={form.watch("wagonDepartureDate")}
                onChange={(v) => form.setValue("wagonDepartureDate", v)}
                testId="button-wagon-departure"
              />
              <DatePickerField
                label="Дата поставки планово"
                value={form.watch("plannedDeliveryDate")}
                onChange={(v) => form.setValue("plannedDeliveryDate", v)}
                testId="button-planned-delivery"
              />
            </div>

            {/* Row 7: Wagon numbers */}
            <FormField
              control={form.control}
              name="wagonNumbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номера вагонов / ЖД накладная</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Номера вагонов или номер накладной"
                      data-testid="input-wagon-numbers"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Дополнительные сведения"
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={mutation.isPending}
            data-testid="button-save-draft"
          >
            Сохранить как черновик
          </Button>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={mutation.isPending}
            data-testid="button-save-deal"
          >
            {mutation.isPending ? "Сохранение..." : (deal && !isCopy ? "Сохранить" : "Создать")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
