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
import { Switch } from "@/components/ui/switch";
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
import { WarehouseStatsCards } from "./warehouses/components/warehouse-stats-cards";
import { WarehouseCard } from "./warehouses/components/warehouse-card";
import { AddWarehouseDialog } from "./warehouses/components/add-warehouse-dialog";
import { WarehouseDetailsDialog } from "./warehouses/components/warehouse-details-dialog";


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
  createdAt: string;
}

const warehouseFormSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  baseId: z.string().min(1, "Выберите базис"),
});

type WarehouseFormData = z.infer<typeof warehouseFormSchema>;

// WarehouseDetailsDialog component is now imported from ./warehouses/components/warehouse-details-dialog
// WarehouseCard component is now imported from ./warehouses/components/warehouse-card
// AddWarehouseDialog component is now imported from ./warehouses/components/add-warehouse-dialog

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

  const { data: allBases = [] } = useQuery<any[]>({
    queryKey: ["/api/bases"],
  });

  const filteredWarehouses = warehouses?.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  }) || [];

  const totalBalance = filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.currentBalance || "0"), 0);
  const totalPvkjBalance = filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.pvkjBalance || "0"), 0);
  
  // Вычисляем среднюю себестоимость по всем складам
  const averageCost = filteredWarehouses.length > 0
    ? filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.averageCost || "0"), 0) / filteredWarehouses.length
    : 0;
  
  const averagePvkjCost = filteredWarehouses.length > 0
    ? filteredWarehouses.reduce((sum, w) => sum + parseFloat(w.pvkjAverageCost || "0"), 0) / filteredWarehouses.length
    : 0;
  
  const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  const formatCurrency = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);

  const getBaseNames = (baseIds: string[] | null | undefined) => {
    if (!baseIds || baseIds.length === 0 || !allBases) return null;
    return baseIds
      .map(id => allBases.find((b: any) => b.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

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

      <WarehouseStatsCards
        warehousesCount={filteredWarehouses.length}
        totalBalance={totalBalance}
        averageCost={averageCost}
        totalPvkjBalance={totalPvkjBalance}
        averagePvkjCost={averagePvkjCost}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
      />

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