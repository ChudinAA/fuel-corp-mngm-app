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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  ArrowLeftRight,
  Calculator
} from "lucide-react";
import type { Movement, Warehouse, DirectoryWholesale, DirectoryLogistics } from "@shared/schema";

const movementFormSchema = z.object({
  movementDate: z.date({ required_error: "Укажите дату" }),
  movementType: z.string().min(1, "Выберите тип перемещения"),
  productType: z.string().min(1, "Выберите тип продукта"),
  supplierId: z.string().optional(),
  fromWarehouseId: z.string().optional(),
  toWarehouseId: z.string().min(1, "Выберите склад назначения"),
  inputMode: z.enum(["liters", "kg"]),
  quantityLiters: z.string().optional(),
  density: z.string().optional(),
  quantityKg: z.string().min(1, "Укажите количество"),
  carrierId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  notes: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementFormSchema>;

function CalculatedField({ label, value, suffix = "" }: { label: string; value: string | number | null; suffix?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Calculator className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
        <span className="text-sm font-medium">{value !== null ? `${value}${suffix}` : "—"}</span>
      </div>
    </div>
  );
}

export default function MovementPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inputMode, setInputMode] = useState<"liters" | "kg">("liters");
  const pageSize = 10;

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementFormSchema),
    defaultValues: {
      movementDate: new Date(),
      movementType: "supply",
      productType: "kerosene",
      supplierId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      inputMode: "liters",
      quantityLiters: "",
      density: "",
      quantityKg: "",
      carrierId: "",
      vehicleNumber: "",
      trailerNumber: "",
      driverName: "",
      notes: "",
    },
  });

  const watchMovementType = form.watch("movementType");
  const watchLiters = form.watch("quantityLiters");
  const watchDensity = form.watch("density");
  const watchKg = form.watch("quantityKg");

  const calculatedKg = inputMode === "liters" && watchLiters && watchDensity
    ? (parseFloat(watchLiters) * parseFloat(watchDensity)).toFixed(2)
    : watchKg;

  const { data: warehouses } = useQuery<Warehouse[]>({ queryKey: ["/api/warehouses"] });
  const { data: suppliers } = useQuery<DirectoryWholesale[]>({ queryKey: ["/api/directories/wholesale", "supplier"] });
  const { data: carriers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "carrier"] });
  const { data: vehicles } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "vehicle"] });
  const { data: trailers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "trailer"] });
  const { data: drivers } = useQuery<DirectoryLogistics[]>({ queryKey: ["/api/directories/logistics", "driver"] });

  const { data: movements, isLoading } = useQuery<{ data: Movement[]; total: number }>({
    queryKey: ["/api/movement", page, search],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/movement/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Перемещение удалено", description: "Запись успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      const payload = {
        ...data,
        movementDate: format(data.movementDate, "yyyy-MM-dd"),
        supplierId: data.supplierId || null,
        fromWarehouseId: data.fromWarehouseId || null,
        toWarehouseId: data.toWarehouseId,
        carrierId: data.carrierId || null,
        quantityKg: calculatedKg || data.quantityKg,
      };
      const res = await apiRequest("POST", "/api/movement", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Перемещение создано", description: "Запись успешно сохранена" });
      form.reset();
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

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });

  const data = movements?.data || [];
  const total = movements?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Перемещение</h1>
        <p className="text-muted-foreground">Учет поставок и внутренних перемещений топлива</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Новое перемещение
          </CardTitle>
          <CardDescription>Создание записи о поставке или внутреннем перемещении</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="movementDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дата</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-movement-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd.MM.yyyy", { locale: ru }) : "Выберите дату"}
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
                  name="movementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип перемещения</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-type">
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="supply">Поставка</SelectItem>
                          <SelectItem value="internal">Внутреннее перемещение</SelectItem>
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
                          <SelectTrigger data-testid="select-movement-product">
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kerosene">Керосин</SelectItem>
                          <SelectItem value="pvkj">ПВКЖ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {watchMovementType === "supply" ? (
                  <FormField
                    control={form.control}
                    name="supplierId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Поставщик</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-movement-supplier">
                              <SelectValue placeholder="Выберите поставщика" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="fromWarehouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Откуда (склад)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-movement-from">
                              <SelectValue placeholder="Выберите склад" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {warehouses?.map((w) => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Куда (склад)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-to">
                            <SelectValue placeholder="Выберите склад" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses?.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
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
                    <CardTitle className="text-lg">Объем</CardTitle>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">Литры/Плотность</Label>
                      <Switch checked={inputMode === "kg"} onCheckedChange={(c) => setInputMode(c ? "kg" : "liters")} data-testid="switch-movement-input" />
                      <Label className="text-sm text-muted-foreground">КГ</Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {inputMode === "liters" ? (
                      <>
                        <FormField control={form.control} name="quantityLiters" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Литры</FormLabel>
                            <FormControl><Input type="number" placeholder="0.00" data-testid="input-movement-liters" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="density" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Плотность</FormLabel>
                            <FormControl><Input type="number" step="0.0001" placeholder="0.8000" data-testid="input-movement-density" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <CalculatedField label="КГ (расчет)" value={formatNumber(calculatedKg)} suffix=" кг" />
                      </>
                    ) : (
                      <FormField control={form.control} name="quantityKg" render={({ field }) => (
                        <FormItem className="md:col-span-3">
                          <FormLabel>Количество (КГ)</FormLabel>
                          <FormControl><Input type="number" placeholder="0.00" data-testid="input-movement-kg" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <CalculatedField label="Цена закупки" value={formatNumber(58.50)} suffix=" ₽/кг" />
                <CalculatedField label="Доставка" value={formatCurrency(15000)} />
                <CalculatedField label="Общая стоимость" value={formatCurrency(307500)} />
                <CalculatedField label="Себестоимость на месте" value={formatNumber(61.50)} suffix=" ₽/кг" />
              </div>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Логистика</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField control={form.control} name="carrierId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Перевозчик</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-movement-carrier"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {carriers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vehicleNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Госномер</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-movement-vehicle"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {vehicles?.map((v) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="trailerNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Госномер ПП</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-movement-trailer"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {trailers?.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="driverName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ФИО водителя</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger data-testid="select-movement-driver"><SelectValue placeholder="Выберите" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {drivers?.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl><Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-movement-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => form.reset()}>Очистить</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-movement">
                  {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : <><Plus className="mr-2 h-4 w-4" />Создать</>}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список перемещений</CardTitle>
          <CardDescription>История поставок и внутренних перемещений</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-movement" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Откуда</TableHead>
                    <TableHead>Куда</TableHead>
                    <TableHead className="text-right">КГ</TableHead>
                    <TableHead className="text-right">Стоимость</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? [1, 2, 3].map((i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  )) : data.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Нет данных</TableCell></TableRow>
                  ) : data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.movementDate)}</TableCell>
                      <TableCell><Badge variant="outline">{item.movementType === "supply" ? "Поставка" : "Внутреннее"}</Badge></TableCell>
                      <TableCell>{item.supplierId || item.fromWarehouseId || "—"}</TableCell>
                      <TableCell>{item.toWarehouseId}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalCost)}</TableCell>
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
                              if (confirm("Вы уверены, что хотите удалить это перемещение?")) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} из {total}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-sm">{page} / {totalPages}</span>
                  <Button variant="outline" size="icon" disabled={page === totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}