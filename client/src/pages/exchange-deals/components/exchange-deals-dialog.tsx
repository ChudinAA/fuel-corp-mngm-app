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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Wallet, Warehouse } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  dealNumber: z.string().nullable().optional(),
  dealDate: z.string().nullable().optional(),
  departureStationId: z.string().uuid().nullable().optional(),
  destinationStationId: z.string().uuid().nullable().optional(),
  buyerId: z.string().uuid().nullable().optional(),
  buyerSupplierId: z.string().uuid().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  pricePerTon: z.string().nullable().optional(),
  weightTon: z.string().nullable().optional(),
  actualWeightTon: z.string().nullable().optional(),
  deliveryTariffId: z.string().uuid().nullable().optional(),
  wagonDepartureDate: z.string().nullable().optional(),
  plannedDeliveryDate: z.string().nullable().optional(),
  sellerId: z.string().uuid().nullable().optional(),
  wagonNumbers: z.string().nullable().optional(),
  railwayInvoice: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isDraft: z.boolean().default(false),
  isReceivedAtWarehouse: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

interface ExchangeDealsDialogProps {
  open: boolean;
  onClose: () => void;
  deal?: any | null;
  isCopy?: boolean;
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

const WAREHOUSE_BUYER_PREFIX = "ws:";

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
      buyerSupplierId: null,
      paymentDate: null,
      pricePerTon: "",
      weightTon: "",
      actualWeightTon: "",
      deliveryTariffId: null,
      wagonDepartureDate: null,
      plannedDeliveryDate: null,
      sellerId: null,
      wagonNumbers: "",
      railwayInvoice: "",
      notes: "",
      isDraft: false,
      isReceivedAtWarehouse: false,
    },
  });

  const watchPricePerTon = form.watch("pricePerTon");
  const watchWeightTon = form.watch("weightTon");
  const watchActualWeightTon = form.watch("actualWeightTon");
  const watchDeliveryTariffId = form.watch("deliveryTariffId");
  const watchSellerId = form.watch("sellerId");
  const watchBuyerSupplierId = form.watch("buyerSupplierId");
  const watchIsReceived = form.watch("isReceivedAtWarehouse");

  // Текущее значение объединённого поля Покупатель:
  // если buyerSupplierId — храним как "ws:<id>", иначе — UUID покупателя
  const buyerId = form.watch("buyerId");
  const combinedBuyerValue = watchBuyerSupplierId
    ? `${WAREHOUSE_BUYER_PREFIX}${watchBuyerSupplierId}`
    : buyerId || "";

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

  const selectedTariff = tariffs.find((t: any) => t.id === watchDeliveryTariffId);
  const tariffPrice = selectedTariff ? parseFloat(selectedTariff.pricePerTon) : 0;

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

  const warehouseSuppliers = (suppliers as any[]).filter((s: any) => s.isWarehouse && s.warehouseId);
  const hasExistingMovement = !isCopy && deal?.movementId;

  // Опции для объединённого поля Покупатель
  const customerOptions = (customers as any[]).map((c: any) => ({
    value: c.id,
    label: c.name,
  }));
  const warehouseSupplierOptions = warehouseSuppliers.map((s: any) => ({
    value: `${WAREHOUSE_BUYER_PREFIX}${s.id}`,
    label: s.name,
    render: (
      <div>
        <span>{s.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">Наш склад</span>
      </div>
    ),
  }));
  const allBuyerOptions = [...customerOptions, ...warehouseSupplierOptions];

  const stationOptions = stations.map((s: any) => ({ value: s.id, label: s.name, render: (
    <div>
      <span>{s.name}</span>
      {s.code && <span className="ml-2 text-xs text-muted-foreground">{s.code}</span>}
    </div>
  ) }));
  const tariffOptions = tariffs.map((t: any) => ({
    value: t.id,
    label: t.zoneName,
    render: (
      <div>
        <span>{t.zoneName}</span>
        <span className="ml-2 text-xs text-muted-foreground">{formatMoney(parseFloat(t.pricePerTon))}/тн</span>
      </div>
    ),
  }));
  const supplierOptions = (suppliers as any[]).map((s: any) => ({ value: s.id, label: s.name }));

  const handleBuyerChange = (val: string) => {
    if (!val) {
      form.setValue("buyerId", null);
      form.setValue("buyerSupplierId", null);
      form.setValue("isReceivedAtWarehouse", false);
    } else if (val.startsWith(WAREHOUSE_BUYER_PREFIX)) {
      const supplierId = val.slice(WAREHOUSE_BUYER_PREFIX.length);
      form.setValue("buyerSupplierId", supplierId);
      form.setValue("buyerId", null);
    } else {
      form.setValue("buyerId", val);
      form.setValue("buyerSupplierId", null);
      form.setValue("isReceivedAtWarehouse", false);
    }
  };

  useEffect(() => {
    if (deal) {
      form.reset({
        dealNumber: deal.dealNumber || "",
        dealDate: deal.dealDate || null,
        departureStationId: deal.departureStationId || null,
        destinationStationId: deal.destinationStationId || null,
        buyerId: isCopy ? deal.buyerId || null : deal.buyerId || null,
        buyerSupplierId: isCopy ? null : (deal.buyerSupplierId || null),
        paymentDate: deal.paymentDate || null,
        pricePerTon: deal.pricePerTon || "",
        weightTon: deal.weightTon || "",
        actualWeightTon: deal.actualWeightTon || "",
        deliveryTariffId: deal.deliveryTariffId || null,
        wagonDepartureDate: deal.wagonDepartureDate || null,
        plannedDeliveryDate: deal.plannedDeliveryDate || null,
        sellerId: deal.sellerId || null,
        wagonNumbers: deal.wagonNumbers || "",
        railwayInvoice: deal.railwayInvoice || "",
        notes: deal.notes || "",
        isDraft: isCopy ? true : (deal.isDraft || false),
        isReceivedAtWarehouse: isCopy ? false : (deal.isReceivedAtWarehouse || false),
      });
    } else {
      form.reset({
        dealNumber: "",
        dealDate: null,
        departureStationId: null,
        destinationStationId: null,
        buyerId: null,
        buyerSupplierId: null,
        paymentDate: null,
        pricePerTon: "",
        weightTon: "",
        actualWeightTon: "",
        deliveryTariffId: null,
        wagonDepartureDate: null,
        plannedDeliveryDate: null,
        sellerId: null,
        wagonNumbers: "",
        railwayInvoice: "",
        notes: "",
        isDraft: false,
        isReceivedAtWarehouse: false,
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
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
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
            {/* Номер сделки и дата */}
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departureStationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ст. отправления</FormLabel>
                    <Combobox
                      options={stationOptions}
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      placeholder="Выберите станцию..."
                      dataTestId="select-departure-station"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destinationStationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ст. назначения</FormLabel>
                    <Combobox
                      options={stationOptions}
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      placeholder="Выберите станцию..."
                      dataTestId="select-destination-station"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Контрагенты</p>

            {/* Покупатель (клиенты + поставщики-склады) и Продавец */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Покупатель</label>
                <Combobox
                  options={allBuyerOptions}
                  value={combinedBuyerValue}
                  onValueChange={handleBuyerChange}
                  placeholder="Выберите покупателя..."
                  dataTestId="select-buyer"
                />
              </div>
              <FormField
                control={form.control}
                name="sellerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Продавец</FormLabel>
                    <Combobox
                      options={supplierOptions}
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      placeholder="Выберите продавца..."
                      dataTestId="select-seller"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Информация о балансе продавца */}
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

            {/* Индикатор: выбранный покупатель — наш склад */}
            {watchBuyerSupplierId && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <Warehouse className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Топливо закупается на наш склад
                </span>
                {hasExistingMovement && (
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px] h-5 px-2 bg-blue-100 text-blue-800 border-blue-200"
                  >
                    Перемещение создано
                  </Badge>
                )}
              </div>
            )}

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">Финансы</p>

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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deliveryTariffId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Доставка за тонну (тариф)</FormLabel>
                    <Combobox
                      options={tariffOptions}
                      value={field.value || ""}
                      onValueChange={(v) => field.onChange(v || null)}
                      placeholder="Выберите тариф..."
                      dataTestId="select-delivery-tariff"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DatePickerField
                label="Дата оплаты"
                value={form.watch("paymentDate")}
                onChange={(v) => form.setValue("paymentDate", v)}
                testId="button-payment-date"
              />
            </div>

            {/* Расчётные поля */}
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

            {/* Два отдельных поля: Номера вагонов и ЖД накладная */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="wagonNumbers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номера вагонов</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Номера вагонов"
                        data-testid="input-wagon-numbers"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="railwayInvoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ЖД накладная</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Номер накладной"
                        data-testid="input-railway-invoice"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Примечания */}
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

            {/* Чекбокс "Подтвердить получение на складе" — только если покупатель наш склад, под Примечаниями */}
            {watchBuyerSupplierId && (
              <div className="p-3 rounded-md border border-border bg-muted/40 space-y-1">
                <FormField
                  control={form.control}
                  name="isReceivedAtWarehouse"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={hasExistingMovement}
                          data-testid="checkbox-is-received"
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal">
                        Подтвердить получение на складе
                      </FormLabel>
                    </FormItem>
                  )}
                />
                {!hasExistingMovement && watchIsReceived && (
                  <p className="text-xs text-muted-foreground pl-6">
                    При сохранении будет создано Перемещение и обновлён баланс склада
                  </p>
                )}
                {hasExistingMovement && (
                  <p className="text-xs text-blue-600 pl-6">
                    Перемещение уже создано. Изменения количества/цены обновят его автоматически.
                  </p>
                )}
              </div>
            )}
          </form>
        </Form>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>

          {(!deal || isCopy || deal?.isDraft) && (
            <Button
              variant="secondary"
              onClick={() => handleSubmit(true)}
              disabled={mutation.isPending}
              data-testid="button-save-draft"
            >
              Сохранить черновик
            </Button>
          )}

          <Button
            onClick={() => handleSubmit(false)}
            disabled={mutation.isPending}
            data-testid="button-save-deal"
          >
            {mutation.isPending
              ? "Сохранение..."
              : deal && !isCopy && !deal.isDraft
                ? "Сохранить изменения"
                : "Создать сделку"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
