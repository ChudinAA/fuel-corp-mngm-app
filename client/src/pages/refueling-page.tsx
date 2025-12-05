import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CalendarIcon, 
  Plus, 
  Pencil, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  Calculator,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Search,
  Filter,
  Plane
} from "lucide-react";
import type { AircraftRefueling, DirectoryRefueling } from "@shared/schema";

const PRODUCT_TYPES = [
  { value: "kerosene", label: "Керосин" },
  { value: "pvkj", label: "ПВКЖ" },
  { value: "service", label: "Услуга заправки" },
  { value: "storage", label: "Хранение" },
  { value: "agent", label: "Агентские" },
];

const refuelingFormSchema = z.object({
  refuelingDate: z.date({ required_error: "Укажите дату заправки" }),
  productType: z.string().min(1, "Выберите тип товара/услуги"),
  aircraftNumber: z.string().optional(),
  orderNumber: z.string().optional(),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPriceId: z.string().optional(),
});

type RefuelingFormData = z.infer<typeof refuelingFormSchema>;

function CalculatedField({ 
  label, 
  value, 
  status,
  suffix = "",
  isLoading = false
}: { 
  label: string; 
  value: string | number | null; 
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}) {
  const statusColors = {
    ok: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
  };

  const statusIcons = {
    ok: <CheckCircle2 className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Calculator className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
        {isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : status ? (
          <>
            <span className={statusColors[status]}>{statusIcons[status]}</span>
            <span className={`text-sm font-medium ${statusColors[status]}`}>
              {value}{suffix}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium">
            {value !== null ? `${value}${suffix}` : "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function RefuelingForm({ 
  onSuccess, 
  editData 
}: { 
  onSuccess?: () => void; 
  editData?: AircraftRefueling | null;
}) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");

  const form = useForm<RefuelingFormData>({
    resolver: zodResolver(refuelingFormSchema),
    defaultValues: {
      refuelingDate: editData ? new Date(editData.refuelingDate) : new Date(),
      productType: editData?.productType || "kerosene",
      aircraftNumber: editData?.aircraftNumber || "",
      orderNumber: editData?.orderNumber || "",
      supplierId: editData?.supplierId || "",
      buyerId: editData?.buyerId || "",
      inputMode: "liters",
      quantityLiters: editData?.quantityLiters || "",
      density: editData?.density || "",
      quantityKg: editData?.quantityKg || "",
      notes: editData?.notes || "",
      isApproxVolume: editData?.isApproxVolume || false,
      selectedPriceId: "",
    },
  });

  const { data: suppliers } = useQuery<DirectoryRefueling[]>({
    queryKey: ["/api/directories/refueling", "airport"],
  });

  const { data: buyers } = useQuery<DirectoryRefueling[]>({
    queryKey: ["/api/directories/refueling", "buyer"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: RefuelingFormData) => {
      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        refuelingDate: format(data.refuelingDate, "yyyy-MM-dd"),
      };
      const res = await apiRequest("POST", "/api/refueling", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refueling"] });
      toast({ title: "Заправка создана", description: "Запись о заправке успешно сохранена" });
      form.reset();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Ошибка", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");
  const watchProductType = form.watch("productType");

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg;

  const onSubmit = (data: RefuelingFormData) => {
    const submitData = {
      ...data,
      quantityKg: calculatedKg || data.quantityKg,
    };
    createMutation.mutate(submitData);
  };

  const formatNumber = (value: number | string | null) => {
    if (value === null) return null;
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
  };

  const formatCurrency = (value: number | string | null) => {
    if (value === null) return null;
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(num);
  };

  const isServiceType = ["service", "storage", "agent"].includes(watchProductType);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <FormField
            control={form.control}
            name="refuelingDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дата заправки</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-refueling-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      locale={ru}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="productType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Товар/Услуга</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-product-type">
                      <SelectValue placeholder="Выберите тип" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="aircraftNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Бортовой номер</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="RA-12345"
                    data-testid="input-aircraft-number"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="orderNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Номер РТ</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="RT-001234"
                    data-testid="input-order-number"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Поставщик (Аэропорт)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-refueling-supplier">
                      <SelectValue placeholder="Выберите поставщика" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <CalculatedField 
            label="Базис" 
            value="Шереметьево"
          />

          <FormField
            control={form.control}
            name="buyerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Покупатель</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-refueling-buyer">
                      <SelectValue placeholder="Выберите покупателя" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {buyers?.map((buyer) => (
                      <SelectItem key={buyer.id} value={buyer.id}>
                        {buyer.name}
                      </SelectItem>
                    )) || (
                      <SelectItem value="none" disabled>Нет данных</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!isServiceType && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Объем топлива</CardTitle>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                  <Switch
                    checked={inputMode === "kg"}
                    onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
                    data-testid="switch-refueling-input-mode"
                  />
                  <Label className="text-sm text-muted-foreground">КГ</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {inputMode === "liters" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="quantityLiters"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Литры</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0.00"
                              data-testid="input-refueling-liters"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="density"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Плотность</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.0001"
                              placeholder="0.8000"
                              data-testid="input-refueling-density"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <CalculatedField 
                      label="КГ (расчет)" 
                      value={formatNumber(calculatedKg)}
                      suffix=" кг"
                    />
                  </>
                ) : (
                  <FormField
                    control={form.control}
                    name="quantityKg"
                    render={({ field }) => (
                      <FormItem className="md:col-span-3">
                        <FormLabel>Количество (КГ)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0.00"
                            data-testid="input-refueling-kg"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isServiceType && (
          <FormField
            control={form.control}
            name="quantityKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {watchProductType === "service" ? "Количество заправок" : 
                   watchProductType === "storage" ? "Объем хранения (кг)" : 
                   "Сумма услуги"}
                </FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    data-testid="input-service-quantity"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CalculatedField 
            label="Объем на складе" 
            value="ОК: 45,000"
            status="ok"
            suffix=" кг"
          />
          <CalculatedField 
            label="Покупка" 
            value={formatNumber(58.50)}
            suffix=" ₽/кг"
          />
          <CalculatedField 
            label="Сумма закупки" 
            value={formatCurrency(187200)}
          />
          <CalculatedField 
            label="Продажа" 
            value={formatNumber(65.00)}
            suffix=" ₽/кг"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CalculatedField 
            label="Сумма продажи" 
            value={formatCurrency(208000)}
          />
          <CalculatedField 
            label="Прибыль" 
            value={formatCurrency(20800)}
            status="ok"
          />
          <CalculatedField 
            label="Накопительно" 
            value={formatCurrency(458000)}
          />
        </div>

        <div className="flex items-center gap-4">
          <FormField
            control={form.control}
            name="isApproxVolume"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-refueling-approx-volume"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal cursor-pointer">
                  Примерный объем (требует уточнения)
                </FormLabel>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => form.reset()}
          >
            Очистить
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending}
            data-testid="button-create-refueling"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Создать запись
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function RefuelingTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 10;

  const { data: refuelings, isLoading } = useQuery<{ data: AircraftRefueling[]; total: number }>({
    queryKey: ["/api/refueling", page, search],
  });

  const formatNumber = (value: string | number | null) => {
    if (value === null) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
  };

  const formatCurrency = (value: string | number | null) => {
    if (value === null) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });
  };

  const getProductLabel = (type: string) => {
    return PRODUCT_TYPES.find(t => t.value === type)?.label || type;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const data = refuelings?.data || [];
  const total = refuelings?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по заправкам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-refueling"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Борт</TableHead>
              <TableHead>Поставщик</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead className="text-right">КГ/Кол-во</TableHead>
              <TableHead className="text-right">Прибыль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDate(item.refuelingDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getProductLabel(item.productType)}</Badge>
                  </TableCell>
                  <TableCell>{item.aircraftNumber || "—"}</TableCell>
                  <TableCell>{item.supplierId}</TableCell>
                  <TableCell>{item.buyerId}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(item.profit)}</TableCell>
                  <TableCell>
                    {item.warehouseStatus === "OK" ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        ОК
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Внимание
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RefuelingPage() {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Заправка ВС</h1>
          <p className="text-muted-foreground">
            Учет заправок воздушных судов и сопутствующих услуг
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Новая заправка
          </CardTitle>
          <CardDescription>
            Заполните данные для записи заправки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RefuelingForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Список заправок</CardTitle>
            <CardDescription>
              Последние 10 записей
            </CardDescription>
          </div>
          <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] h-[90vh]">
              <DialogHeader>
                <DialogTitle>Все заправки ВС</DialogTitle>
                <DialogDescription>
                  Полный список заправок с фильтрацией и поиском
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <RefuelingTable />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <RefuelingTable />
        </CardContent>
      </Card>
    </div>
  );
}
