import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CalendarIcon,
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Search,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  X,
  Calculator,
  CalendarCheck,
  RefreshCw
} from "lucide-react";
import type { Price, WholesaleBase, WholesaleSupplier, RefuelingProvider, RefuelingBase, Customer } from "@shared/schema";

const priceFormSchema = z.object({
  dateFrom: z.date({ required_error: "Укажите дату начала" }),
  dateTo: z.date({ required_error: "Укажите дату окончания" }),
  counterpartyType: z.enum(["wholesale", "refueling"]),
  counterpartyRole: z.enum(["supplier", "buyer"]),
  counterpartyId: z.string().min(1, "Выберите контрагента"),
  productType: z.enum(["kerosine", "service", "pvkj", "agent", "storage"]),
  basis: z.string().min(1, "Выберите базис"),
  volume: z.string().optional(),
  priceValues: z.array(z.object({
    price: z.string().min(1, "Укажите цену")
  })).min(1, "Добавьте хотя бы одну цену"),
  contractNumber: z.string().optional(),
});

type PriceFormData = z.infer<typeof priceFormSchema>;

function AddPriceDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [calculatingSelection, setCalculatingSelection] = useState(false);
  const [checkingDates, setCheckingDates] = useState(false);
  const [selectionResult, setSelectionResult] = useState<string | null>(null);
  const [dateCheckResult, setDateCheckResult] = useState<{ status: string; message: string; overlaps?: { id: number; dateFrom: string; dateTo: string }[] } | null>(null);

  const form = useForm<PriceFormData>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: {
      dateFrom: new Date(),
      dateTo: new Date(),
      counterpartyType: "wholesale",
      counterpartyRole: "supplier",
      counterpartyId: "",
      productType: "kerosine",
      basis: "",
      volume: "",
      priceValues: [{ price: "" }],
      contractNumber: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "priceValues"
  });

  const watchCounterpartyType = form.watch("counterpartyType");
  const watchCounterpartyRole = form.watch("counterpartyRole");
  const watchCounterpartyId = form.watch("counterpartyId");
  const watchBasis = form.watch("basis");
  const watchDateFrom = form.watch("dateFrom");
  const watchDateTo = form.watch("dateTo");

  const { data: optBases } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const { data: refuelingBases } = useQuery<RefuelingBase[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const { data: wholesaleSuppliers } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: refuelingProviders } = useQuery<RefuelingProvider[]>({
    queryKey: ["/api/refueling/providers"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Объединяем базисы из обеих таблиц
  const allBases = [...(optBases || []), ...(refuelingBases || [])];

  // Логика выбора контрагентов в зависимости от роли
  const contractors = watchCounterpartyRole === "supplier" 
    ? [...(wholesaleSuppliers || []), ...(refuelingProviders || [])]
    : customers || [];

  // Автоматическое заполнение базиса при выборе поставщика
  useEffect(() => {
    if (watchCounterpartyRole === "supplier" && watchCounterpartyId) {
      const selectedContractor = contractors.find(c => c.id === watchCounterpartyId);
      if (selectedContractor && selectedContractor.defaultBaseId) {
        const defaultBase = allBases.find(b => b.id === selectedContractor.defaultBaseId);
        if (defaultBase) {
          form.setValue("basis", defaultBase.name);
        }
      }
    }
  }, [watchCounterpartyRole, watchCounterpartyId, contractors, allBases, form]);

  const calculateSelection = async () => {
    if (!watchCounterpartyId || !watchBasis || !watchDateFrom || !watchDateTo) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    setCalculatingSelection(true);
    try {
      const params = new URLSearchParams({
        counterpartyId: watchCounterpartyId,
        counterpartyType: watchCounterpartyType,
        basis: watchBasis,
        dateFrom: format(watchDateFrom, "yyyy-MM-dd"),
        dateTo: format(watchDateTo, "yyyy-MM-dd"),
      });
      const res = await apiRequest("GET", `/api/prices/calculate-selection?${params}`);
      const data = await res.json();
      setSelectionResult(data.totalVolume);
      toast({ title: "Выборка рассчитана", description: `Общий объем: ${data.totalVolume} кг` });
    } catch (error) {
      toast({ title: "Ошибка расчета", description: "Не удалось рассчитать выборку", variant: "destructive" });
    } finally {
      setCalculatingSelection(false);
    }
  };

  const checkDateOverlaps = async () => {
    if (!watchCounterpartyId || !watchBasis || !watchDateFrom || !watchDateTo) {
      toast({ title: "Ошибка", description: "Заполните все обязательные поля", variant: "destructive" });
      return;
    }
    setCheckingDates(true);
    try {
      const params = new URLSearchParams({
        counterpartyId: watchCounterpartyId,
        counterpartyType: watchCounterpartyType,
        counterpartyRole: watchCounterpartyRole,
        basis: watchBasis,
        dateFrom: format(watchDateFrom, "yyyy-MM-dd"),
        dateTo: format(watchDateTo, "yyyy-MM-dd"),
      });
      const res = await apiRequest("GET", `/api/prices/check-date-overlaps?${params}`);
      const data = await res.json();
      setDateCheckResult(data);
      if (data.status === "error") {
        toast({ title: "Двойная цена!", description: data.message, variant: "destructive" });
      } else if (data.status === "warning") {
        toast({ title: "Внимание", description: data.message });
      } else {
        toast({ title: "Проверка пройдена", description: "Пересечений не обнаружено" });
      }
    } catch (error) {
      toast({ title: "Ошибка проверки", description: "Не удалось проверить даты", variant: "destructive" });
    } finally {
      setCheckingDates(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: PriceFormData) => {
      const payload = {
        productType: data.productType,
        counterpartyId: data.counterpartyId,
        counterpartyType: data.counterpartyType,
        counterpartyRole: data.counterpartyRole,
        basis: data.basis,
        volume: data.volume || null,
        priceValues: data.priceValues,
        dateFrom: format(data.dateFrom, "yyyy-MM-dd"),
        dateTo: format(data.dateTo, "yyyy-MM-dd"),
        contractNumber: data.contractNumber || null,
      };
      const res = await apiRequest("POST", "/api/prices", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Цена добавлена", description: "Новая цена успешно сохранена" });
      form.reset();
      setSelectionResult(null);
      setDateCheckResult(null);
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-price">
          <Plus className="mr-2 h-4 w-4" />
          Добавить цену
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая цена</DialogTitle>
          <DialogDescription>Добавление цены покупки или продажи</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок действия ОТ</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-date-from">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ru} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок действия ДО</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-date-to">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} locale={ru} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="counterpartyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип контрагента</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-counterparty-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wholesale">ОПТ</SelectItem>
                        <SelectItem value="refueling">Заправка ВС</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counterpartyRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Роль контрагента</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-counterparty-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="supplier">Поставщик</SelectItem>
                        <SelectItem value="buyer">Покупатель</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="counterpartyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контрагент</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-counterparty">
                          <SelectValue placeholder="Выберите контрагента" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contractors?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип продукта</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="kerosine">Керосин</SelectItem>
                        <SelectItem value="service">Услуга</SelectItem>
                        <SelectItem value="pvkj">ПВКЖ</SelectItem>
                        <SelectItem value="agent">Агентские</SelectItem>
                        <SelectItem value="storage">Хранение</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="basis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Базис (место поставки/заправки)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-basis">
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allBases?.map((b) => (
                          <SelectItem key={`${b.id}-${b.name}`} value={b.basis || b.name}>{b.basis || b.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="volume"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Объем по договору (кг)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Объем поставки" data-testid="input-volume" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <FormLabel>Цены (добавьте одну или несколько)</FormLabel>
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name={`priceValues.${index}.price`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input type="number" step="0.0001" placeholder="Цена за кг (₽)" data-testid={`input-price-${index}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      data-testid={`button-remove-price-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {index === fields.length - 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => append({ price: "" })}
                      data-testid="button-add-price-field"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="contractNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер договора (опционально)</FormLabel>
                  <FormControl>
                    <Input placeholder="№ договора" data-testid="input-contract-number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Выборка и Проверка дат */}
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Выборка</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={calculateSelection}
                        disabled={calculatingSelection}
                        data-testid="button-calculate-selection"
                      >
                        {calculatingSelection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Рассчитать сумму сделок из ОПТ и Заправка ВС</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="text-lg font-semibold">
                  {selectionResult ? `${new Intl.NumberFormat('ru-RU').format(parseFloat(selectionResult))} кг` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">Суммирует все сделки по контрагенту, базису и периоду</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Проверка дат</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={checkDateOverlaps}
                        disabled={checkingDates}
                        data-testid="button-check-dates"
                      >
                        {checkingDates ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Проверить пересечение диапазонов дат</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div>
                  {dateCheckResult ? (
                    <Badge variant={dateCheckResult.status === "error" ? "destructive" : dateCheckResult.status === "warning" ? "outline" : "default"} className="flex items-center gap-1 w-fit">
                      {dateCheckResult.status === "error" && <AlertTriangle className="h-3 w-3" />}
                      {dateCheckResult.status === "error" ? "Двойная цена!" : dateCheckResult.status === "warning" ? "Внимание" : "ОК"}
                    </Badge>
                  ) : (
                    <span className="text-lg font-semibold">—</span>
                  )}
                </div>
                {dateCheckResult?.overlaps && dateCheckResult.overlaps.length > 0 && (
                  <div className="text-xs text-destructive">
                    Пересечения: {dateCheckResult.overlaps.map(o => `#${o.id}`).join(", ")}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Проверяет задвоение цен по диапазонам дат</p>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-price">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PricesTable({ counterpartyRole, counterpartyType }: { counterpartyRole: "supplier" | "buyer"; counterpartyType: "wholesale" | "refueling" }) {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const { data: optContractors } = useQuery<WholesaleSupplier[]>({
    queryKey: ["/api/wholesale/suppliers"],
  });

  const { data: refuelingContractors } = useQuery<RefuelingProvider[]>({
    queryKey: ["/refueling/providers"],
  });

  const getContractorName = (id: string, type: string) => {
    const contractors = type === "wholesale" ? optContractors : refuelingContractors;
    return contractors?.find(c => c.id === id)?.name || `ID: ${id}`;
  };

  const formatNumber = (value: string | number | null) => {
    if (value === null) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  const getPriceDisplay = (priceValues: string[] | null) => {
    if (!priceValues || priceValues.length === 0) return "—";
    try {
      const prices = priceValues.map(pv => {
        const parsed = JSON.parse(pv);
        return parsed.price;
      });
      if (prices.length === 1) {
        return `${formatNumber(prices[0])} ₽`;
      }
      return prices.map(p => `${formatNumber(p)} ₽`).join(", ");
    } catch {
      return "—";
    }
  };

  const filteredPrices = prices?.filter(p => 
    p.counterpartyRole === counterpartyRole && 
    p.counterpartyType === counterpartyType &&
    (!search || p.basis?.toLowerCase().includes(search.toLowerCase()) || getContractorName(p.counterpartyId, p.counterpartyType).toLowerCase().includes(search.toLowerCase()))
  ) || [];

  const calculateSelectionMutation = useMutation({
    mutationFn: async (price: Price) => {
      const params = new URLSearchParams({
        counterpartyId: price.counterpartyId,
        counterpartyType: price.counterpartyType,
        basis: price.basis || "",
        dateFrom: price.dateFrom,
        dateTo: price.dateTo || price.dateFrom,
      });
      const res = await apiRequest("GET", `/api/prices/calculate-selection?${params}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      toast({ title: "Выборка рассчитана", description: `Общий объем: ${data.totalVolume} кг` });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось рассчитать выборку", variant: "destructive" });
    },
  });

  const checkDatesMutation = useMutation({
    mutationFn: async (price: Price) => {
      const params = new URLSearchParams({
        counterpartyId: price.counterpartyId,
        counterpartyType: price.counterpartyType,
        counterpartyRole: price.counterpartyRole,
        basis: price.basis || "",
        dateFrom: price.dateFrom,
        dateTo: price.dateTo || price.dateFrom,
        excludeId: price.id,
      });
      const res = await apiRequest("GET", `/api/prices/check-date-overlaps?${params}`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/prices"] });
      if (data.status === "error") {
        toast({ title: "Двойная цена!", description: data.message, variant: "destructive" });
      } else {
        toast({ title: "Проверка пройдена", description: "Пересечений не обнаружено" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось проверить даты", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Поиск по базису или контрагенту..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Период</TableHead>
              <TableHead>Контрагент</TableHead>
              <TableHead>Базис</TableHead>
              <TableHead>Продукт</TableHead>
              <TableHead className="text-right">Цена (₽/кг)</TableHead>
              <TableHead className="text-right">Объем</TableHead>
              <TableHead className="text-right">Выборка</TableHead>
              <TableHead>Даты</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Нет данных</TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((price) => (
                <TableRow key={price.id} data-testid={`row-price-${price.id}`}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(price.dateFrom)} - {formatDate(price.dateTo)}</TableCell>
                  <TableCell>{getContractorName(price.counterpartyId, price.counterpartyType)}</TableCell>
                  <TableCell>{price.basis || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {price.productType === "kerosine" ? "Керосин" : price.productType === "pvkj" ? "ПВКЖ" : price.productType === "service" ? "Услуга" : price.productType === "agent" ? "Агентские" : "Хранение"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{getPriceDisplay(price.priceValues)}</TableCell>
                  <TableCell className="text-right">{price.volume ? `${formatNumber(price.volume)} кг` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{price.soldVolume ? `${formatNumber(price.soldVolume)} кг` : "—"}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => calculateSelectionMutation.mutate(price)}
                            disabled={calculateSelectionMutation.isPending}
                            data-testid={`button-calc-selection-${price.id}`}
                          >
                            <RefreshCw className={`h-3 w-3 ${calculateSelectionMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Пересчитать выборку</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {price.dateCheckWarning === "error" ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Пересечение
                        </Badge>
                      ) : price.dateCheckWarning === "warning" ? (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          Внимание
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">ОК</Badge>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => checkDatesMutation.mutate(price)}
                            disabled={checkDatesMutation.isPending}
                            data-testid={`button-check-dates-${price.id}`}
                          >
                            <CalendarCheck className={`h-3 w-3 ${checkDatesMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Проверить даты</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-edit-price-${price.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" data-testid={`button-delete-price-${price.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PricesPage() {
  const [activeTab, setActiveTab] = useState<"wholesale" | "refueling">("wholesale");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Цены</h1>
          <p className="text-muted-foreground">Управление ценами с проверкой пересечения диапазонов</p>
        </div>
        <AddPriceDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Цены ОПТ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">Закупка/Продажа</p>
            <p className="text-xs text-muted-foreground">оптовая торговля</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Цены Заправка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">Закупка/Продажа</p>
            <p className="text-xs text-muted-foreground">заправка воздушных судов</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4 text-purple-500" />
              Выборка
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">Авторасчет</p>
            <p className="text-xs text-muted-foreground">сумма сделок по цене</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-orange-500" />
              Проверка дат
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">Контроль</p>
            <p className="text-xs text-muted-foreground">обнаружение пересечений</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "wholesale" | "refueling")}>
        <TabsList>
          <TabsTrigger value="wholesale">ОПТ</TabsTrigger>
          <TabsTrigger value="refueling">Заправка ВС</TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены закупки (Поставщики)</CardTitle>
              <CardDescription>Цены от поставщиков для оптовой торговли</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="supplier" counterpartyType="wholesale" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены продажи (Покупатели)</CardTitle>
              <CardDescription>Цены для покупателей по оптовым сделкам</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="buyer" counterpartyType="wholesale" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refueling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены закупки (Поставщики)</CardTitle>
              <CardDescription>Цены от поставщиков для заправок ВС</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="supplier" counterpartyType="refueling" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Цены продажи (Покупатели)</CardTitle>
              <CardDescription>Цены для покупателей по заправкам ВС</CardDescription>
            </CardHeader>
            <CardContent>
              <PricesTable counterpartyRole="buyer" counterpartyType="refueling" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
