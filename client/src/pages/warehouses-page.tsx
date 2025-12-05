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
import { Progress } from "@/components/ui/progress";
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
  Warehouse,
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import type { Warehouse as WarehouseType } from "@shared/schema";

const WAREHOUSE_TYPES = [
  { value: "service", label: "Служба" },
  { value: "airport", label: "Аэропорт" },
  { value: "tk_tvk", label: "ТК ТВК" },
  { value: "gpn", label: "ГПН" },
  { value: "gpna", label: "ГПНА" },
];

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  type: z.string().min(1, "Выберите тип"),
  basis: z.string().optional(),
  monthlyAllocation: z.string().optional(),
});

type WarehouseFormData = z.infer<typeof warehouseFormSchema>;

function WarehouseCard({ warehouse }: { warehouse: WarehouseType }) {
  const { toast } = useToast();
  const balance = parseFloat(warehouse.currentBalance || "0");
  const cost = parseFloat(warehouse.averageCost || "0");
  const allocation = parseFloat(warehouse.monthlyAllocation || "0");
  const usagePercent = allocation > 0 ? (balance / allocation) * 100 : 50;
  const isLow = usagePercent < 20;
  const isHigh = usagePercent > 80;

  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);

  const getTypeLabel = (type: string) => WAREHOUSE_TYPES.find(t => t.value === type)?.label || type;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/warehouses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Склад удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить склад", variant: "destructive" });
    },
  });

  return (
    <Card className={isLow ? "border-l-4 border-l-yellow-500" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{warehouse.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{getTypeLabel(warehouse.type)}</Badge>
              {warehouse.basis && <span className="text-xs">{warehouse.basis}</span>}
            </CardDescription>
          </div>
          {isLow && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Текущий остаток</p>
            <p className="text-xl font-semibold">{formatNumber(balance)} кг</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Средняя себестоимость</p>
            <p className="text-lg font-medium">{formatCurrency(cost)}/кг</p>
          </div>
        </div>

        {allocation > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Использование месячного лимита</span>
              <span className={isLow ? "text-yellow-600" : isHigh ? "text-green-600" : ""}>{usagePercent.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercent} className={isLow ? "[&>div]:bg-yellow-500" : isHigh ? "[&>div]:bg-green-500" : ""} />
            <p className="text-xs text-muted-foreground">Лимит: {formatNumber(allocation)} кг/мес</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-3 w-3" />
              +12,500 кг
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <TrendingDown className="h-3 w-3" />
              -8,200 кг
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid={`button-edit-warehouse-${warehouse.id}`}
              onClick={() => setEditingWarehouse(warehouse)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive"
              onClick={() => {
                if (confirm("Вы уверены, что хотите удалить этот склад?")) {
                  deleteMutation.mutate(warehouse.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddWarehouseDialog({ warehouseToEdit, onSave }: { warehouseToEdit: WarehouseType | null, onSave: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const isEditing = !!warehouseToEdit;

  const form = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: warehouseToEdit?.name || "",
      type: warehouseToEdit?.type || "",
      basis: warehouseToEdit?.basis || "",
      monthlyAllocation: warehouseToEdit?.monthlyAllocation || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WarehouseFormData) => {
      const payload = {
        ...data,
        monthlyAllocation: data.monthlyAllocation || null,
      };
      const url = isEditing ? `/api/warehouses/${warehouseToEdit?.id}` : "/api/warehouses";
      const method = isEditing ? "PATCH" : "POST";
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: isEditing ? "Склад обновлен" : "Склад создан", description: isEditing ? "Информация о складе успешно изменена" : "Новый склад успешно добавлен" });
      form.reset();
      setOpen(false);
      onSave();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={isEditing ? `button-edit-warehouse-${warehouseToEdit?.id}` : "button-add-warehouse"}>
          {isEditing ? <><Pencil className="mr-2 h-4 w-4" />Редактировать</> : <><Plus className="mr-2 h-4 w-4" />Добавить склад</>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование склада" : "Новый склад"}</DialogTitle>
          <DialogDescription>{isEditing ? "Изменение информации о складе" : "Добавление нового склада в систему"}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название склада" data-testid="input-warehouse-name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-warehouse-type">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {WAREHOUSE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="basis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Базис</FormLabel>
                  <FormControl>
                    <Input placeholder="Базис склада" data-testid="input-warehouse-basis" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyAllocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Месячный лимит (кг)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Для ГПН/ГПНА" data-testid="input-warehouse-allocation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={mutation.isPending} data-testid="button-save-warehouse">
                {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEditing ? "Сохранение..." : "Создание..."}</> : isEditing ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function WarehousesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const { toast } = useToast();

  const { data: warehouses, isLoading } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
  });

  const filteredWarehouses = warehouses?.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || w.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const totalBalance = filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.currentBalance || "0"), 0);
  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);

  const handleSave = () => {
    setEditingWarehouse(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Склады</h1>
          <p className="text-muted-foreground">Управление складами и мониторинг остатков</p>
        </div>
        <AddWarehouseDialog warehouseToEdit={null} onSave={handleSave} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего складов</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{filteredWarehouses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Общий остаток</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(totalBalance)} кг</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Требуют внимания</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-yellow-600">2</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск складов..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="input-search-warehouses" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
            <SelectValue placeholder="Все типы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {WAREHOUSE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Нет складов для отображения</p>
            <p className="text-sm text-muted-foreground mt-1">Добавьте первый склад для начала работы</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWarehouses.map((warehouse) => (
            <WarehouseCard key={warehouse.id} warehouse={warehouse} />
          ))}
          {editingWarehouse && (
            <AddWarehouseDialog warehouseToEdit={editingWarehouse} onSave={handleSave} />
          )}
        </div>
      )}
    </div>
  );
}