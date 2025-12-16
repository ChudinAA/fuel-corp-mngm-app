
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Building2, Pencil, Trash2, Warehouse, Droplets, Fuel } from "lucide-react";
import type { Supplier, Base } from "@shared/schema";
import { AddSupplierDialog } from "./suppliers-dialog";

export function SuppliersTab() {
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; hasWarehouse?: boolean } | null>(null);
  const { toast } = useToast();

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: bases = [] } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/suppliers/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Поставщик удален", description: "Поставщик успешно удален из справочника" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getBaseNames = (baseIds: string[] | null | undefined) => {
    if (!baseIds || baseIds.length === 0) return "—";
    return baseIds
      .map(id => {
        const base = bases.find(b => b.id === id);
        return base ? `${base.name} (${base.baseType === 'wholesale' ? 'ОПТ' : 'Заправка'})` : null;
      })
      .filter(Boolean)
      .join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Поставщики
        </CardTitle>
        <CardDescription>Управление поставщиками для оптовых и заправочных операций</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Поиск..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-9" 
                data-testid="input-search-suppliers" 
              />
            </div>
            <AddSupplierDialog 
              bases={bases} 
              editItem={editingItem} 
              onEditComplete={() => setEditingItem(null)} 
            />
          </div>

          {suppliersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Базисы</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Нет данных
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <TableRow key={supplier.id} data-testid={`row-supplier-${supplier.id}`}>
                        <TableCell className="font-medium">
                          <TooltipProvider>
                            <div className="flex items-center gap-1.5">
                              <span>{supplier.name}</span>
                              {supplier.isWarehouse && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Warehouse className="h-4 w-4 text-sky-400 flex-shrink-0 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Склад</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <div className="flex flex-wrap gap-1.5">
                              {supplier.baseIds && supplier.baseIds.length > 0 ? (
                                supplier.baseIds.map((baseId) => {
                                  const base = bases.find(b => b.id === baseId);
                                  if (!base) return null;
                                  const isWholesale = base.baseType === 'wholesale';
                                  return (
                                    <div key={baseId} className="flex items-center gap-1">
                                      <span className="text-sm">{base.name}</span>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          {isWholesale ? (
                                            <Droplets className="h-4 w-4 text-orange-400 flex-shrink-0 cursor-help" />
                                          ) : (
                                            <Fuel className="h-4 w-4 text-green-400 flex-shrink-0 cursor-help" />
                                          )}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{isWholesale ? 'ОПТ' : 'Заправка'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  );
                                })
                              ) : (
                                <span>—</span>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {supplier.description && (
                              <span className="text-sm text-muted-foreground">{supplier.description}</span>
                            )}
                            {(supplier.servicePrice || supplier.pvkjPrice) && (
                              <div className="flex flex-wrap gap-2 text-xs">
                                {supplier.servicePrice && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    Услуга: {parseFloat(supplier.servicePrice).toFixed(2)} ₽/кг
                                  </span>
                                )}
                                {supplier.pvkjPrice && (
                                  <span className="text-purple-600 dark:text-purple-400">
                                    ПВКЖ: {parseFloat(supplier.pvkjPrice).toFixed(2)} ₽/кг
                                  </span>
                                )}
                              </div>
                            )}
                            {!supplier.description && !supplier.servicePrice && !supplier.pvkjPrice && "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.isActive ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">Активен</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Неактивен</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              data-testid={`button-edit-${supplier.id}`}
                              onClick={() => setEditingItem(supplier)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive" 
                              data-testid={`button-delete-${supplier.id}`}
                              onClick={() => {
                                setItemToDelete({
                                  id: supplier.id,
                                  name: supplier.name,
                                  hasWarehouse: !!supplier.warehouseId
                                });
                                setDeleteDialogOpen(true);
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
          )}
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (itemToDelete) {
            deleteMutation.mutate(itemToDelete.id);
          }
          setDeleteDialogOpen(false);
          setItemToDelete(null);
        }}
        title="Удалить поставщика?"
        description={
          itemToDelete?.hasWarehouse
            ? "Данный поставщик является складом. Удаление приведет к тому, что привязанный склад станет неактивным. Продолжить?"
            : "Вы уверены, что хотите удалить этого поставщика? Это действие нельзя отменить."
        }
        itemName={itemToDelete?.name}
      />
    </Card>
  );
}
