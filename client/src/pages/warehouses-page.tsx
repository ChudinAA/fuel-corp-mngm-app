import React, { useState } from "react";
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
import type { Warehouse as WarehouseType, WholesaleBase, RefuelingBase } from "@shared/schema";

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  baseId: z.string().min(1, "Выберите базис"),
});

type WarehouseFormData = z.infer<typeof warehouseFormSchema>;

function WarehouseCard({ warehouse, onEdit }: { warehouse: WarehouseType; onEdit: (warehouse: WarehouseType) => void }) {
  const { toast } = useToast();
  const balance = parseFloat(warehouse.currentBalance || "0");
  const cost = parseFloat(warehouse.averageCost || "0");

  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);

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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{warehouse.name}</CardTitle>
            {warehouse.basis && (
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{warehouse.basis}</Badge>
              </CardDescription>
            )}
          </div>
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
              onClick={() => onEdit(warehouse)}
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

function AddWarehouseDialog({ warehouseToEdit, onSave, open: externalOpen, onOpenChange: externalOnOpenChange }: { warehouseToEdit: WarehouseType | null, onSave: () => void, open?: boolean, onOpenChange?: (open: boolean) => void }) {
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  const isEditing = !!warehouseToEdit;

  const { data: wholesaleBases } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
  });

  const { data: refuelingBases } = useQuery<RefuelingBase[]>({
    queryKey: ["/api/refueling/bases"],
  });

  const allBases = [
    ...(wholesaleBases?.map(b => ({ id: b.id, name: b.name, source: 'wholesale' })) || []),
    ...(refuelingBases?.map(b => ({ id: b.id, name: b.name, source: 'refueling' })) || []),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const form = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      name: "",
      baseId: "",
    },
  });

  // Обновляем форму при изменении warehouseToEdit
  React.useEffect(() => {
    if (warehouseToEdit) {
      form.reset({
        name: warehouseToEdit.name,
        baseId: warehouseToEdit.baseId,
      });
    } else {
      form.reset({
        name: "",
        baseId: "",
      });
    }
  }, [warehouseToEdit, form]);

  const mutation = useMutation({
    mutationFn: async (data: WarehouseFormData) => {
      const payload = {
        ...data,
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
              name="baseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Базис</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-warehouse-basis">
                        <SelectValue placeholder="Выберите базис" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allBases.map((base) => (
                        <SelectItem key={base.id} value={base.id}>
                          {base.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: warehouses, isLoading } = useQuery<WarehouseType[]>({
    queryKey: ["/api/warehouses"],
  });

  const filteredWarehouses = warehouses?.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  const totalBalance = filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.currentBalance || "0"), 0);
  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);

  const handleSave = () => {
    setEditingWarehouse(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Склады</h1>
          <p className="text-muted-foreground">Управление складами и мониторинг остатков</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-warehouse">
          <Plus className="mr-2 h-4 w-4" />Добавить склад
        </Button>
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
            <WarehouseCard key={warehouse.id} warehouse={warehouse} onEdit={handleEdit} />
          ))}
        </div>
      )}
      
      <AddWarehouseDialog 
        warehouseToEdit={editingWarehouse} 
        onSave={handleSave}
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingWarehouse(null);
        }}
      />
    </div>
  );
}
      