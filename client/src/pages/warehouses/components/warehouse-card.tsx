
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, Trash2, TrendingUp, TrendingDown, Warehouse as WarehouseIcon, Droplets, Fuel } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Warehouse, Base } from "@shared/schema";
import type { WarehouseTransaction } from "../types";
import { formatNumber, formatCurrency } from "../utils";

interface WarehouseCardProps {
  warehouse: Warehouse;
  onEdit: (warehouse: Warehouse) => void;
  onViewDetails: (warehouse: Warehouse) => void;
}

export function WarehouseCard({ warehouse, onEdit, onViewDetails }: WarehouseCardProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const balance = parseFloat(warehouse.currentBalance || "0");
  const cost = parseFloat(warehouse.averageCost || "0");
  const isInactive = !warehouse.isActive;

  const { data: allBases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
  });

  const { data: transactions } = useQuery<WarehouseTransaction[]>({
    queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
    refetchInterval: 5000,
  });

  const getBaseNames = (baseIds: string[] | null | undefined) => {
    if (!baseIds || baseIds.length === 0 || !allBases) return null;
    return baseIds
      .map(id => allBases.find((b: any) => b.id === id)?.name)
      .filter(Boolean)
      .join(", ");
  };

  const getBaseIcon = (baseType: string) => {
    if (baseType === 'refueling') {
      return { icon: Fuel, color: "text-green-400", label: "Заправка" };
    }
    return { icon: Droplets, color: "text-orange-400", label: "ОПТ" };
  };

  const getCurrentMonthStats = () => {
    if (!transactions) return { income: 0, expense: 0 };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
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
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Склад удален", description: "Запись успешно удалена" });
    },
    onError: () => {
      toast({ 
        title: "Ошибка", 
        description: "Не удалось удалить склад", 
        variant: "destructive" 
      });
    },
  });

  return (
    <Card 
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        isInactive ? 'opacity-60' : ''
      }`} 
      onClick={() => onViewDetails(warehouse)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <WarehouseIcon className="h-4 w-4 text-sky-400" />
              {warehouse.name}
              {isInactive && <Badge variant="destructive">Неактивен</Badge>}
            </CardTitle>
            {warehouse.baseIds && warehouse.baseIds.length > 0 && allBases && (
              <CardDescription className="flex items-center gap-2 mt-1 flex-wrap">
                {warehouse.baseIds.map((baseId) => {
                  const base = allBases.find((b: any) => b.id === baseId);
                  if (!base) return null;
                  const baseIcon = getBaseIcon(base.baseType);
                  const BaseIcon = baseIcon.icon;
                  return (
                    <TooltipProvider key={baseId}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <BaseIcon className={`h-3 w-3 ${baseIcon.color}`} />
                            {base.name}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{baseIcon.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
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
                if (warehouse.supplierId && warehouse.isActive) {
                  setConfirmMessage("Данный склад привязан к поставщику. После удаления у поставщика не будет склада. Продолжить?");
                } else {
                  setConfirmMessage("Вы уверены, что хотите удалить этот склад? Это действие нельзя отменить.");
                }
                setDeleteDialogOpen(true);
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          deleteMutation.mutate(warehouse.id);
          setDeleteDialogOpen(false);
        }}
        title="Удалить склад?"
        description={confirmMessage}
        itemName={warehouse.name}
      />
    </Card>
  );
}
