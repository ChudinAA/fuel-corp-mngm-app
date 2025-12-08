import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
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
  carrierId: z.string().min(1, "Выберите перевозчика"),
  fromLocation: z.string().min(1, "Укажите откуда"),
  toLocation: z.string().min(1, "Укажите куда"),
  costPerKg: z.string().min(1, "Укажите стоимость за кг"),
  distance: z.string().optional(),
});

type DeliveryCostFormData = z.infer<typeof deliveryCostFormSchema>;

function AddDeliveryCostDialog({ editDeliveryCost, onClose }: { editDeliveryCost: DeliveryCost | null; onClose?: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(editDeliveryCost !== null);
  
  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const form = useForm<DeliveryCostFormData>({
    resolver: zodResolver(deliveryCostFormSchema),
    defaultValues: {
      carrierId: editDeliveryCost?.carrierId || "",
      fromLocation: editDeliveryCost?.fromLocation || "",
      toLocation: editDeliveryCost?.toLocation || "",
      costPerKg: editDeliveryCost?.costPerKg?.toString() || "",
      distance: editDeliveryCost?.distance?.toString() || "",
    },
  });

  const { data: carriers } = useQuery<any[]>({
    queryKey: ["/api/logistics/carriers"],
  });

  const { data: wholesaleBases } = useQuery<any[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const { data: refuelingBases } = useQuery<any[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const { data: deliveryLocations } = useQuery<any[]>({
    queryKey: ["/api/logistics/delivery-locations"],
  });

  const { data: logisticsWarehouses } = useQuery<any[]>({
    queryKey: ["/api/logistics/warehouses"],
  });

  const fromLocations = [
    ...(wholesaleBases || []),
    ...(refuelingBases || [])
  ];

  const toLocations = [
    ...(deliveryLocations || []),
    ...(logisticsWarehouses || [])
  ];

  const createMutation = useMutation({
    mutationFn: async (data: DeliveryCostFormData) => {
      const res = await apiRequest("POST", "/api/delivery-costs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф добавлен", description: "Новый тариф доставки сохранен" });
      form.reset();
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DeliveryCostFormData) => {
      const res = await apiRequest("PATCH", `/api/delivery-costs/${editDeliveryCost?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф обновлен", description: "Изменения тарифа доставки сохранены" });
      form.reset();
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {editDeliveryCost ? null : (
          <Button data-testid="button-add-delivery-cost">
            <Plus className="mr-2 h-4 w-4" />
            Добавить тариф
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editDeliveryCost ? "Редактировать тариф доставки" : "Новый тариф доставки"}</DialogTitle>
          <DialogDescription>{editDeliveryCost ? "Изменение тарифа перевозки" : "Добавление тарифа перевозки"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => editDeliveryCost ? updateMutation.mutate(data) : createMutation.mutate(data))} className="space-y-4">
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
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                    <FormLabel>Откуда (Базис)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-from">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fromLocations.map((l) => (
                          <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                        ))}
                        {fromLocations.length === 0 && <SelectItem value="none" disabled>Нет данных</SelectItem>}
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
                    <FormLabel>Куда (Место доставки)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-delivery-to">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {toLocations.map((l) => (
                          <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>
                        ))}
                        {toLocations.length === 0 && <SelectItem value="none" disabled>Нет данных</SelectItem>}
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
              <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Расстояние (км)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" data-testid="input-distance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>Отмена</Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-save-delivery-cost">
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{editDeliveryCost ? "Сохранение..." : "Создание..."}</> : (editDeliveryCost ? "Сохранить" : "Создать")}
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
  const [editingDeliveryCost, setEditingDeliveryCost] = useState<DeliveryCost | null>(null);
  const { toast } = useToast();

  const { data: deliveryCosts, isLoading } = useQuery<DeliveryCost[]>({
    queryKey: ["/api/delivery-costs"],
  });

  const formatNumber = (value: string | number | null) => {
    if (value === null || value === undefined) return "—";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const filteredCosts = deliveryCosts?.filter(c => 
    c.fromLocation.toLowerCase().includes(search.toLowerCase()) ||
    c.toLocation.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/delivery-costs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-costs"] });
      toast({ title: "Тариф удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить тариф", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Доставка</h1>
          <p className="text-muted-foreground">Управление тарифами на доставку</p>
        </div>
        <AddDeliveryCostDialog editDeliveryCost={editingDeliveryCost} onClose={() => setEditingDeliveryCost(null)} />
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
                    <TableHead>Перевозчик</TableHead>
                    <TableHead>Маршрут</TableHead>
                    <TableHead className="text-right">За кг (₽)</TableHead>
                    <TableHead className="text-right">Расстояние (км)</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [1, 2, 3].map((i) => (
                      <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ))
                  ) : filteredCosts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет тарифов для отображения
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCosts.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell>{cost.carrierId}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{cost.fromLocation}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{cost.toLocation}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(cost.costPerKg)} ₽</TableCell>
                        <TableCell className="text-right">{cost.distance ? formatNumber(cost.distance) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              data-testid={`button-edit-delivery-${cost.id}`}
                              onClick={() => setEditingDeliveryCost(cost)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (confirm("Вы уверены, что хотите удалить этот тариф?")) {
                                  deleteMutation.mutate(cost.id);
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}