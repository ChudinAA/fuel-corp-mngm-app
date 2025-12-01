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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CalendarIcon,
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Search,
  Truck,
  MapPin
} from "lucide-react";
import type { DeliveryCost, DirectoryLogistics } from "@shared/schema";

const deliveryCostFormSchema = z.object({
  effectiveDate: z.date({ required_error: "Укажите дату" }),
  carrierId: z.string().min(1, "Выберите перевозчика"),
  fromLocation: z.string().min(1, "Укажите откуда"),
  toLocation: z.string().min(1, "Укажите куда"),
  costPerTrip: z.string().min(1, "Укажите стоимость"),
  costPerKg: z.string().optional(),
});

type DeliveryCostFormData = z.infer<typeof deliveryCostFormSchema>;

function AddDeliveryCostDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<DeliveryCostFormData>({
    resolver: zodResolver(deliveryCostFormSchema),
    defaultValues: {
      effectiveDate: new Date(),
      carrierId: "",
      fromLocation: "",
      toLocation: "",
      costPerTrip: "",
      costPerKg: "",
    },
  });

  const { data: carriers } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "carrier"],
  });

  const { data: locations } = useQuery<DirectoryLogistics[]>({
    queryKey: ["/api/directories/logistics", "delivery_location"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: DeliveryCostFormData) => {
      const payload = {
        ...data,
        effectiveDate: format(data.effectiveDate, "yyyy-MM-dd"),
        carrierId: parseInt(data.carrierId),
      };
      const res = await apiRequest("POST", "/api/delivery-costs", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф добавлен", description: "Новый тариф доставки сохранен" });
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
        <Button data-testid="button-add-delivery-cost">
          <Plus className="mr-2 h-4 w-4" />
          Добавить тариф
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый тариф доставки</DialogTitle>
          <DialogDescription>Добавление тарифа перевозки</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="effectiveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата начала действия</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="input-delivery-date">
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
              name="carrierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Перевозчик</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-delivery-carrier">
                        <SelectValue placeholder="Выберите перевозчика" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {carriers?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                      )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fromLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Откуда</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-from">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((l) => (
                          <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="toLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Куда</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-to">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((l) => (
                          <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                        )) || <SelectItem value="none" disabled>Нет данных</SelectItem>}
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
                name="costPerTrip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость за рейс (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-cost-per-trip" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costPerKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стоимость за кг (₽)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" placeholder="0.0000" data-testid="input-cost-per-kg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-delivery-cost">
                {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</> : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function DeliveryPage() {
  const [search, setSearch] = useState("");

  const { data: deliveryCosts, isLoading } = useQuery<DeliveryCost[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const formatNumber = (value: string | number | null) => {
    if (value === null || value === undefined) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), "dd.MM.yyyy", { locale: ru });

  const filteredCosts = deliveryCosts?.filter(c => 
    c.fromLocation.toLowerCase().includes(search.toLowerCase()) ||
    c.toLocation.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Доставка</h1>
          <p className="text-muted-foreground">Управление тарифами на доставку</p>
        </div>
        <AddDeliveryCostDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Всего маршрутов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredCosts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Средняя стоимость рейса
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">15,000 ₽</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные перевозчики</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">5</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Тарифы доставки</CardTitle>
          <CardDescription>Стоимость перевозки по маршрутам</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск по маршрутам..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-delivery" />
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата начала</TableHead>
                    <TableHead>Перевозчик</TableHead>
                    <TableHead>Маршрут</TableHead>
                    <TableHead className="text-right">За рейс (₽)</TableHead>
                    <TableHead className="text-right">За кг (₽)</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет тарифов для отображения
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCosts.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell>{formatDate(cost.effectiveDate)}</TableCell>
                        <TableCell>{cost.carrierId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{cost.fromLocation}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{cost.toLocation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(cost.costPerTrip)} ₽</TableCell>
                        <TableCell className="text-right">{cost.costPerKg ? `${formatNumber(cost.costPerKg)} ₽` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
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
        </CardContent>
      </Card>
    </div>
  );
}
