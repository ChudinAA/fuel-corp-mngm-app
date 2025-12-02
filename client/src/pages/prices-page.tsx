import { useState } from "react";
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
  X
} from "lucide-react";
import type { Price, DirectoryWholesale, DirectoryRefueling } from "@shared/schema";

const priceFormSchema = z.object({
  dateFrom: z.date({ required_error: "Укажите дату начала" }),
  dateTo: z.date({ required_error: "Укажите дату окончания" }),
  priceType: z.enum(["purchase", "sale"]),
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

  const form = useForm<PriceFormData>({
    resolver: zodResolver(priceFormSchema),
    defaultValues: {
      dateFrom: new Date(),
      dateTo: new Date(),
      priceType: "purchase",
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
  const watchBasis = form.watch("basis");

  const { data: optBases } = useQuery<DirectoryWholesale[]>({
    queryKey: ["/api/directories/wholesale", "basis"],
  });

  const { data: refuelingBases } = useQuery<DirectoryRefueling[]>({
    queryKey: ["/api/directories/refueling", "basis"],
  });

  const { data: optContractors } = useQuery<DirectoryWholesale[]>({
    queryKey: ["/api/directories/wholesale", "all"],
  });

  const { data: refuelingContractors } = useQuery<DirectoryRefueling[]>({
    queryKey: ["/api/directories/refueling", "all"],
  });

  const bases = watchCounterpartyType === "wholesale" ? optBases : refuelingBases;
  const contractors = watchCounterpartyType === "wholesale" ? optContractors : refuelingContractors;

  const createMutation = useMutation({
    mutationFn: async (data: PriceFormData) => {
      const payload = {
        priceType: data.priceType,
        productType: data.productType,
        counterpartyId: parseInt(data.counterpartyId),
        counterpartyType: data.counterpartyType,
        counterpartyRole: data.counterpartyRole,
        basis: data.basis,
        volume: data.volume ? parseFloat(data.volume) : null,
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="priceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип цены</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-price-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="purchase">Покупка</SelectItem>
                        <SelectItem value="sale">Продажа</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
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
                    <FormLabel>Базис (место поставки)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-basis">
                          <SelectValue placeholder="Выберите базис" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bases?.map((b) => (
                          <SelectItem key={b.id} value={b.basis || b.name}>{b.basis || b.name}</SelectItem>
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

function PricesTable({ priceType, counterpartyType }: { priceType: "purchase" | "sale"; counterpartyType: "wholesale" | "refueling" }) {
  const [search, setSearch] = useState("");

  const { data: prices, isLoading } = useQuery<Price[]>({
    queryKey: ["/api/prices"],
  });

  const formatNumber = (value: string | number | null) => {
    if (value === null) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(num);
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });

  const filteredPrices = prices?.filter(p => 
    p.priceType === priceType && 
    p.counterpartyType === counterpartyType &&
    (!search || p.counterpartyId.toString().includes(search) || (p.basis && p.basis.toLowerCase().includes(search.toLowerCase())))
  ) || [];

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
        <Input placeholder="Поиск по базису..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Период</TableHead>
              <TableHead>Базис</TableHead>
              <TableHead>Продукт</TableHead>
              <TableHead className="text-right">Цена (₽/кг)</TableHead>
              <TableHead className="text-right">Выборка (кг)</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPrices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Нет данных</TableCell>
              </TableRow>
            ) : (
              filteredPrices.map((price) => (
                <TableRow key={price.id}>
                  <TableCell className="text-sm">{formatDate(price.dateFrom)} - {formatDate(price.dateTo)}</TableCell>
                  <TableCell>{price.basis || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {price.productType === "kerosine" ? "Керосин" : price.productType === "pvkj" ? "ПВКЖ" : price.productType === "service" ? "Услуга" : price.productType === "agent" ? "Агентские" : "Хранение"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(price.priceValues?.[0] ? JSON.parse(price.priceValues[0]).price : "—")} ₽</TableCell>
                  <TableCell className="text-right">{formatNumber(price.soldVolume)}</TableCell>
                  <TableCell>
                    {price.dateCheckWarning === "error" && (
                      <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        Пересечение
                      </Badge>
                    )}
                    {price.dateCheckWarning === "warning" && (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <AlertTriangle className="h-3 w-3" />
                        Внимание
                      </Badge>
                    )}
                    {!price.dateCheckWarning && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">ОК</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Цены</h1>
          <p className="text-muted-foreground">Управление ценами покупки и продажи с проверкой пересечения диапазонов</p>
        </div>
        <AddPriceDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Средняя продажа ОПТ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">62.50 ₽</p>
            <p className="text-xs text-muted-foreground">за кг</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Средняя покупка ОПТ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">58.50 ₽</p>
            <p className="text-xs text-muted-foreground">за кг</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Средняя продажа ВС
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">68.00 ₽</p>
            <p className="text-xs text-muted-foreground">за кг</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              Средняя покупка ВС
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">61.00 ₽</p>
            <p className="text-xs text-muted-foreground">за кг</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "wholesale" | "refueling")}>
        <TabsList>
          <TabsTrigger value="wholesale" data-testid="tab-opt-prices">ОПТ</TabsTrigger>
          <TabsTrigger value="refueling" data-testid="tab-refueling-prices">Заправка ВС</TabsTrigger>
        </TabsList>

        <TabsContent value="wholesale" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600">Цены продажи</CardTitle>
                <CardDescription>Цены для покупателей</CardDescription>
              </CardHeader>
              <CardContent>
                <PricesTable priceType="sale" counterpartyType="wholesale" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-600">Цены покупки</CardTitle>
                <CardDescription>Цены от поставщиков</CardDescription>
              </CardHeader>
              <CardContent>
                <PricesTable priceType="purchase" counterpartyType="wholesale" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="refueling" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-600">Цены продажи</CardTitle>
                <CardDescription>Цены для покупателей</CardDescription>
              </CardHeader>
              <CardContent>
                <PricesTable priceType="sale" counterpartyType="refueling" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-blue-600">Цены покупки</CardTitle>
                <CardDescription>Цены от аэропортов</CardDescription>
              </CardHeader>
              <CardContent>
                <PricesTable priceType="purchase" counterpartyType="refueling" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
