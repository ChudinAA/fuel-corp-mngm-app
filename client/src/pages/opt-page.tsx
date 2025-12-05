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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Filter
} from "lucide-react";
import type { Opt, DirectoryWholesale, DirectoryLogistics } from "@shared/schema";

const optFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  supplierId: z.string().min(1, "Выберите поставщика"),
  buyerId: z.string().min(1, "Выберите покупателя"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  carrierId: z.string().optional(),
  deliveryLocationId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
  isApproxVolume: z.boolean().default(false),
  selectedPriceId: z.string().optional(),
});

type OptFormData = z.infer<typeof optFormSchema>;

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

function OptForm({ 
  onSuccess, 
  editData 
}: { 
  onSuccess?: () => void; 
  editData?: Opt | null;
}) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");

  const form = useForm<OptFormData>({
    resolver: zodResolver(optFormSchema),
    defaultValues: {
      dealDate: editData ? new Date(editData.dealDate) : new Date(),
      supplierId: editData?.supplierId || "",
      buyerId: editData?.buyerId || "",
      inputMode: "liters",
      quantityLiters: editData?.quantityLiters || "",
      density: editData?.density || "",
      quantityKg: editData?.quantityKg || "",
      carrierId: editData?.carrierId || "",
      deliveryLocationId: editData?.deliveryLocationId || "",
      vehicleNumber: editData?.vehicleNumber || "",
      trailerNumber: editData?.trailerNumber || "",
      driverName: editData?.driverName || "",
      notes: editData?.notes || "",
      isApproxVolume: editData?.isApproxVolume || false,
      selectedPriceId: "",
    },
  });

  const { data: suppliers } = useQuery<DirectoryWholesale[]>({
    queryKey: ["/api/directories/wholesale", "supplier"],
  });

  const { data: buyers } = useQuery<DirectoryWholesale[]>({
    queryKey: ["/api/directories/wholesale", "buyer"],
  });

  const { data: carriers } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "carrier"],
  });

  const { data: deliveryLocations } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "delivery_location"],
  });

  const { data: vehicles } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "vehicle"],
  });

  const { data: trailers } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "trailer"],
  });

  const { data: drivers } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "driver"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: OptFormData) => {
      const payload = {
        ...data,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        carrierId: data.carrierId || null,
        deliveryLocationId: data.deliveryLocationId || null,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
      };
      const res = await apiRequest("POST", "/api/opt", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
      toast({ title: "Сделка создана", description: "Оптовая сделка успешно сохранена" });
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

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg;

  const onSubmit = (data: OptFormData) => {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FormField
            control={form.control}
            name="dealDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дата сделки</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="input-deal-date"
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
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Поставщик</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-supplier">
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

          <FormField
            control={form.control}
            name="buyerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Покупатель</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-buyer">
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

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-lg">Объем топлива</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                <Switch
                  checked={inputMode === "kg"}
                  onCheckedChange={(checked) => setInputMode(checked ? "kg" : "liters")}
                  data-testid="switch-input-mode"
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
                            data-testid="input-liters"
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
                            data-testid="input-density"
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
                          data-testid="input-kg"
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CalculatedField 
            label="Объем на складе" 
            value="ОК: 125,000"
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
            value={formatCurrency(292500)}
          />
          <CalculatedField 
            label="Базис" 
            value="ГПН ЯНОС"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CalculatedField 
            label="Продажа" 
            value={formatNumber(62.00)}
            suffix=" ₽/кг"
          />
          <CalculatedField 
            label="Сумма продажи" 
            value={formatCurrency(310000)}
          />
          <CalculatedField 
            label="Доставка" 
            value={formatCurrency(15000)}
          />
          <CalculatedField 
            label="Прибыль" 
            value={formatCurrency(2500)}
            status="ok"
          />
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Логистика</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="carrierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Перевозчик</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-carrier">
                          <SelectValue placeholder="Выберите перевозчика" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {carriers?.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            {carrier.name}
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

              <FormField
                control={form.control}
                name="deliveryLocationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Место доставки</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-location">
                          <SelectValue placeholder="Выберите место" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deliveryLocations?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
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

              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Госномер</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-vehicle">
                          <SelectValue placeholder="Выберите номер" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.name}>
                            {vehicle.name}
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

              <FormField
                control={form.control}
                name="trailerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Госномер ПП</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trailer">
                          <SelectValue placeholder="Выберите номер" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trailers?.map((trailer) => (
                          <SelectItem key={trailer.id} value={trailer.name}>
                            {trailer.name}
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

              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ФИО водителя</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-driver">
                          <SelectValue placeholder="Выберите водителя" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers?.map((driver) => (
                          <SelectItem key={driver.id} value={driver.name}>
                            {driver.name}
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
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Примечания</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Дополнительная информация..."
                    className="resize-none"
                    data-testid="input-notes"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="isApproxVolume"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0 pt-6">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-approx-volume"
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Примерный объем (требует уточнения)
                  </FormLabel>
                </FormItem>
              )}
            />
            
            <CalculatedField 
              label="Накопительно" 
              value={formatCurrency(125000)}
              status="ok"
            />
          </div>
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
            data-testid="button-create-opt"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Создать сделку
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function OptTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 10;
  const { toast } = useToast();

  const { data: optDeals, isLoading } = useQuery<{ data: Opt[]; total: number }>({
    queryKey: ["/api/opt", page, search],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/opt/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opt"] });
      toast({ title: "Сделка удалена", description: "Оптовая сделка успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const deals = optDeals?.data || [];
  const total = optDeals?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по сделкам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-opt"
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
              <TableHead>Поставщик</TableHead>
              <TableHead>Покупатель</TableHead>
              <TableHead className="text-right">КГ</TableHead>
              <TableHead className="text-right">Покупка</TableHead>
              <TableHead className="text-right">Продажа</TableHead>
              <TableHead className="text-right">Прибыль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Нет данных для отображения
                </TableCell>
              </TableRow>
            ) : (
              deals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>{formatDate(deal.dealDate)}</TableCell>
                  <TableCell>{deal.supplierId}</TableCell>
                  <TableCell>{deal.buyerId}</TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(deal.quantityKg)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(deal.purchaseAmount)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(deal.saleAmount)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(deal.profit)}</TableCell>
                  <TableCell>
                    {deal.warehouseStatus === "OK" ? (
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => {
                          toast({ title: "В разработке", description: "Функция редактирования в разработке" });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm("Вы уверены, что хотите удалить эту сделку?")) {
                            deleteMutation.mutate(deal.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
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

export default function OptPage() {
  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Оптовые продажи (ОПТ)</h1>
          <p className="text-muted-foreground">
            Учет оптовых сделок с автоматическим расчетом цен
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новая сделка</CardTitle>
          <CardDescription>
            Заполните данные для создания новой оптовой сделки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OptForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Список сделок</CardTitle>
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
                <DialogTitle>Все оптовые сделки</DialogTitle>
                <DialogDescription>
                  Полный список сделок с фильтрацией и поиском
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <OptTable />
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <OptTable />
        </CardContent>
      </Card>
    </div>
  );
}
