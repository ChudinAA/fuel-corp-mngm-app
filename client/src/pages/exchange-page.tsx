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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  TrendingUp
} from "lucide-react";
import type { Exchange, Warehouse } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const exchangeFormSchema = z.object({
  dealDate: z.date({ required_error: "Укажите дату сделки" }),
  dealNumber: z.string().optional(),
  counterparty: z.string().min(1, "Укажите контрагента"),
  productType: z.string().min(1, "Выберите тип продукта"),
  quantityKg: z.string().min(1, "Укажите количество"),
  pricePerKg: z.string().min(1, "Укажите цену"),
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
});

type ExchangeFormData = z.infer<typeof exchangeFormSchema>;

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

function AddExchangeDialog({ 
  warehouses, 
  editExchange, 
  open, 
  onOpenChange 
}: { 
  warehouses: Warehouse[]; 
  editExchange: Exchange | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!editExchange;

  const form = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      dealDate: editExchange?.dealDate ? new Date(editExchange.dealDate) : new Date(),
      dealNumber: editExchange?.dealNumber || "",
      counterparty: editExchange?.counterparty || "",
      productType: editExchange?.productType || "kerosene",
      quantityKg: editExchange?.quantityKg?.toString() || "",
      pricePerKg: editExchange?.pricePerKg?.toString() || "",
      warehouseId: editExchange?.warehouseId || "",
      notes: editExchange?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExchangeFormData) => {
      const quantity = parseFloat(data.quantityKg);
      const price = parseFloat(data.pricePerKg);
      const payload = {
        ...data,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        warehouseId: data.warehouseId || null,
        totalAmount: (quantity * price).toString(),
      };
      const res = await apiRequest(isEditing ? "PATCH" : "POST", isEditing ? `/api/exchange/${editExchange?.id}` : "/api/exchange", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      toast({ title: isEditing ? "Сделка обновлена" : "Сделка создана", description: isEditing ? "Биржевая сделка успешно обновлена" : "Биржевая сделка успешно сохранена" });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const watchQuantity = form.watch("quantityKg");
  const watchPrice = form.watch("pricePerKg");

  const totalAmount = watchQuantity && watchPrice
    ? parseFloat(watchQuantity) * parseFloat(watchPrice)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование биржевой сделки" : "Новая биржевая сделка"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Измените данные для обновления сделки" : "Заполните данные для записи сделки"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="dealDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дата сделки</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-exchange-date">
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
                name="dealNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Номер сделки</FormLabel>
                    <FormControl>
                      <Input placeholder="СПБ-001234" data-testid="input-exchange-number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контрагент</FormLabel>
                    <FormControl>
                      <Input placeholder="Название контрагента" data-testid="input-exchange-counterparty" {...field} />
                    </FormControl>
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
                        <SelectTrigger data-testid="select-exchange-product">
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
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="quantityKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Количество (КГ)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" data-testid="input-exchange-quantity" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pricePerKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена за кг (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-exchange-price" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-1">
                <label className="text-sm font-medium">Сумма сделки</label>
                <div className="h-10 px-3 bg-muted rounded-md flex items-center">
                  <span className="text-sm font-medium">{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Склад назначения</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-exchange-warehouse">
                          <SelectValue placeholder="Выберите склад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses?.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
                          </SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Дополнительная информация..." className="resize-none" data-testid="input-exchange-notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-exchange">
                {createMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Обновление..." : "Сохранение..."}</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />{isEditing ? "Обновить сделку" : "Создать сделку"}</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ExchangePage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingExchange, setEditingExchange] = useState<Exchange | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const pageSize = 10;

  const { data: warehouses } = useQuery<Warehouse[]>({
    queryKey: ["/api/warehouses"],
  });

  const { data: exchanges, isLoading } = useQuery<{ data: Exchange[]; total: number }>({
    queryKey: ["/api/exchange", page, search],
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExchangeFormData) => {
      const quantity = parseFloat(data.quantityKg);
      const price = parseFloat(data.pricePerKg);
      const payload = {
        ...data,
        dealDate: format(data.dealDate, "yyyy-MM-dd"),
        warehouseId: data.warehouseId || null,
        totalAmount: (quantity * price).toString(),
      };
      const res = await apiRequest("POST", "/api/exchange", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      toast({ title: "Сделка создана", description: "Биржевая сделка успешно сохранена" });
      // form.reset(); // This form instance is from ExchangePage, not AddExchangeDialog
      // The form reset should happen within AddExchangeDialog upon successful creation/update.
      // The dialog closing will also handle state reset.
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/exchange/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Сделка удалена", description: "Биржевая сделка успешно удалена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<ExchangeFormData>({
    resolver: zodResolver(exchangeFormSchema),
    defaultValues: {
      dealDate: new Date(),
      dealNumber: "",
      counterparty: "",
      productType: "kerosene",
      quantityKg: "",
      pricePerKg: "",
      warehouseId: "",
      notes: "",
    },
  });

  const watchQuantity = form.watch("quantityKg");
  const watchPrice = form.watch("pricePerKg");

  const totalAmount = watchQuantity && watchPrice 
    ? parseFloat(watchQuantity) * parseFloat(watchPrice)
    : 0;

  const data = exchanges?.data || [];
  const total = exchanges?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleEditClick = (exchange: Exchange) => {
    setEditingExchange(exchange);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingExchange(null);
  };

  const handleOpenDialog = () => {
    setEditingExchange(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Биржа</h1>
          <p className="text-muted-foreground">
            Учет биржевых сделок с автоматическим обновлением складов
          </p>
        </div>
        <Button onClick={handleOpenDialog} data-testid="button-add-exchange">
          <Plus className="mr-2 h-4 w-4" />
          Новая сделка
        </Button>
      </div>

      <AddExchangeDialog 
        warehouses={warehouses || []} 
        editExchange={editingExchange}
        open={isDialogOpen}
        onOpenChange={(open) => !open && handleCloseDialog()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список биржевых сделок</CardTitle>
          <CardDescription>История сделок с биржей</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-exchange" />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Номер</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Продукт</TableHead>
                    <TableHead className="text-right">КГ</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Нет данных для отображения
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.dealDate)}</TableCell>
                        <TableCell>{item.dealNumber || "—"}</TableCell>
                        <TableCell>{item.counterparty}</TableCell>
                        <TableCell><Badge variant="outline">{item.productType === "kerosene" ? "Керосин" : "ПВКЖ"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(item.quantityKg)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.pricePerKg)} ₽</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              data-testid={`button-edit-exchange-${item.id}`}
                              onClick={() => handleEditClick(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (confirm("Вы уверены, что хотите удалить эту сделку?")) {
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
                    ))
                  )}
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