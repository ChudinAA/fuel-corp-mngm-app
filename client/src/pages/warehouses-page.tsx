import React, { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Warehouse,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  X
} from "lucide-react";
import type { Warehouse as WarehouseType, WholesaleBase, RefuelingBase } from "@shared/schema";

interface WarehouseTransaction {
  id: string;
  warehouseId: string;
  transactionType: string;
  sourceType: string;
  sourceId: string;
  quantityKg: string;
  balanceBefore: string;
  balanceAfter: string;
  averageCostBefore: string;
  averageCostAfter: string;
  transactionDate: string;
  createdAt: string;
}

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  baseId: z.string().min(1, "Выберите базис"),
});

type WarehouseFormData = z.infer<typeof warehouseFormSchema>;

function WarehouseDetailsDialog({ warehouse, open, onOpenChange }: { warehouse: WarehouseType; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: transactions, isLoading } = useQuery<WarehouseTransaction[]>({
    queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
    enabled: open,
  });

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num);
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(num);
  };

  const getTransactionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      receipt: "Поступление",
      sale: "Продажа (ОПТ)",
      refueling: "Заправка ВС",
      transfer_in: "Перемещение (приход)",
      transfer_out: "Перемещение (расход)",
    };
    return types[type] || type;
  };

  const getTransactionIcon = (type: string) => {
    if (type === 'receipt' || type === 'transfer_in') {
      return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
    }
    return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {warehouse.name} - История операций
          </DialogTitle>
          <DialogDescription>
            Детализация поступлений и списаний по складу
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Текущий остаток</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{formatNumber(warehouse.currentBalance || "0")} кг</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средняя себестоимость</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">{formatCurrency(warehouse.averageCost || "0")}/кг</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Базис</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{warehouse.basis || "—"}</Badge>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип операции</TableHead>
                  <TableHead className="text-right">Количество</TableHead>
                  <TableHead className="text-right">Остаток до</TableHead>
                  <TableHead className="text-right">Остаток после</TableHead>
                  <TableHead className="text-right">Себест. до</TableHead>
                  <TableHead className="text-right">Себест. после</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(tx.transactionDate), "dd.MM.yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className="text-sm">{getTransactionTypeLabel(tx.transactionType)}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${parseFloat(tx.quantityKg) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {parseFloat(tx.quantityKg) > 0 ? '+' : ''}{formatNumber(tx.quantityKg)} кг
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(tx.balanceBefore)} кг</TableCell>
                    <TableCell className="text-right">{formatNumber(tx.balanceAfter)} кг</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.averageCostBefore)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.averageCostAfter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Нет операций по складу</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function WarehouseCard({ warehouse, onEdit, onViewDetails }: { warehouse: WarehouseType; onEdit: (warehouse: WarehouseType) => void; onViewDetails: (warehouse: WarehouseType) => void }) {
  const { toast } = useToast();
  const balance = parseFloat(warehouse.currentBalance || "0");
  const cost = parseFloat(warehouse.averageCost || "0");

  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);

  const { data: transactions } = useQuery<WarehouseTransaction[]>({
    queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const getCurrentMonthStats = () => {
    if (!transactions) return { income: 0, expense: 0 };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.transactionDate);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const qty = parseFloat(tx.quantityKg);
        if (qty > 0) {
          income += qty;
        } else {
          expense += Math.abs(qty);
        }
      }
    });

    return { income, expense };
  };

  const monthStats = getCurrentMonthStats();

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
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onViewDetails(warehouse)}>
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
      <CardContent className="space-y-4" onClick={(e) => e.stopPropagation()}>
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
              +{formatNumber(monthStats.income)} кг
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <TrendingDown className="h-3 w-3" />
              -{formatNumber(monthStats.expense)} кг
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

interface NewWarehouseFormValues {
  name: string;
  bases: { baseId: string }[];
  storageCost: string;
  createSupplier: boolean;
  supplierType?: string;
}

const newWarehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  bases: z.array(z.object({ baseId: z.string() })).min(1, "Выберите хотя бы один базис"),
  storageCost: z.string().optional(),
  createSupplier: z.boolean(),
  supplierType: z.string().optional(),
});

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

  const form = useForm<NewWarehouseFormValues>({
    resolver: zodResolver(newWarehouseFormSchema),
    defaultValues: {
      name: "",
      bases: [{ baseId: "" }],
      storageCost: "",
      createSupplier: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "bases",
  });

  // Обновляем форму при изменении warehouseToEdit
  React.useEffect(() => {
    if (warehouseToEdit) {
      form.reset({
        name: warehouseToEdit.name,
        bases: warehouseToEdit.baseIds.map(id => ({ baseId: id })),
        storageCost: warehouseToEdit.storageCost || "",
        createSupplier: warehouseToEdit.supplierType !== undefined,
        supplierType: warehouseToEdit.supplierType,
      });
    } else {
      form.reset({
        name: "",
        bases: [{ baseId: "" }],
        storageCost: "",
        createSupplier: false,
        supplierType: undefined,
      });
    }
  }, [warehouseToEdit, form]);

  const mutation = useMutation({
    mutationFn: async (data: NewWarehouseFormValues) => {
      const payload = {
        ...data,
        baseIds: data.bases.map(b => b.baseId),
        ...(data.storageCost && { storageCost: data.storageCost }),
        ...(data.createSupplier && data.supplierType && { supplierType: data.supplierType }),
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
      <DialogContent className="max-w-xl">
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
              name="bases"
              render={() => (
                <FormItem>
                  <FormLabel>Базисы поставки</FormLabel>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2 mb-2">
                      <Select onValueChange={(value) => form.setValue(`bases.${index}.baseId`, value)} value={form.getValues(`bases.${index}.baseId`)}>
                        <FormControl>
                          <SelectTrigger data-testid={`select-warehouse-basis-${index}`}>
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
                      {index > 0 && (
                        <Button type="button" size="icon" variant="outline" onClick={() => remove(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => append({ baseId: "" })}>
                    + Добавить базис
                  </Button>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="storageCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Стоимость хранения (₽)</FormLabel>
                  <FormControl>
                    <Input placeholder="Стоимость хранения" type="number" data-testid="input-storage-cost" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="createSupplier"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Создать поставщика</FormLabel>
                    <FormDescription>Автоматически создать поставщика при создании склада</FormDescription>
                  </div>
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-5 w-5 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {form.watch("createSupplier") && (
              <FormField
                control={form.control}
                name="supplierType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тип поставщика</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-supplier-type">
                          <SelectValue placeholder="Выберите тип поставщика" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="wholesale">ОПТ</SelectItem>
                        <SelectItem value="refueling">Заправка</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
  const [viewingWarehouse, setViewingWarehouse] = useState<WarehouseType | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
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

  const handleViewDetails = (warehouse: WarehouseType) => {
    setViewingWarehouse(warehouse);
    setIsDetailsDialogOpen(true);
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
            <WarehouseCard key={warehouse.id} warehouse={warehouse} onEdit={handleEdit} onViewDetails={handleViewDetails} />
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

      {viewingWarehouse && (
        <WarehouseDetailsDialog
          warehouse={viewingWarehouse}
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
        />
      )}
    </div>
  );
}