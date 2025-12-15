import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, TrendingUp, TrendingDown, Warehouse as WarehouseIcon, Droplets, Fuel, MoreHorizontal } from "lucide-react";
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
  const pvkjBalance = parseFloat(warehouse.pvkjBalance || "0");
  const pvkjCost = parseFloat(warehouse.pvkjAverageCost || "0");
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
    if (!transactions) return { income: 0, expense: 0, pvkjIncome: 0, pvkjExpense: 0 };

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let income = 0;
    let expense = 0;
    let pvkjIncome = 0;
    let pvkjExpense = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const qty = parseFloat(tx.quantityKg);
        const isPvkj = tx.productType === 'pvkj';
        
        if (qty > 0) {
          if (isPvkj) {
            pvkjIncome += qty;
          } else {
            income += qty;
          }
        } else {
          if (isPvkj) {
            pvkjExpense += Math.abs(qty);
          } else {
            expense += Math.abs(qty);
          }
        }
      }
    });

    return { income, expense, pvkjIncome, pvkjExpense };
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
              <CardDescription className="mt-1 -mx-6 px-6">
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-2 min-w-max pb-1">
                    {warehouse.baseIds.map((baseId) => {
                      const base = allBases.find((b: any) => b.id === baseId);
                      if (!base) return null;
                      const baseIcon = getBaseIcon(base.baseType);
                      const BaseIcon = baseIcon.icon;
                      return (
                        <TooltipProvider key={baseId}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="flex items-center gap-1 flex-shrink-0">
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
                  </div>
                </div>
              </CardDescription>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(warehouse); }}>
                <Pencil className="mr-2 h-4 w-4" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (warehouse.supplierId && warehouse.isActive) {
                    setConfirmMessage("Данный склад привязан к поставщику. После удаления у поставщика не будет склада. Продолжить?");
                  } else {
                    setConfirmMessage("Вы уверены, что хотите удалить этот склад? Это действие нельзя отменить.");
                  }
                  setDeleteDialogOpen(true);
                }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold">{formatNumber(balance)} кг</span>
            <Badge variant="outline" className="text-xs">Керосин</Badge>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Себестоимость: <span className="font-medium">{formatCurrency(cost)}/кг</span></span>
            <div className="flex flex-col items-end text-xs gap-0.5">
              <span className="text-muted-foreground text-[10px]">В этом месяце (кг):</span>
              <div className="flex items-center gap-2">
                <span className="text-green-600">
                  +{monthStats.income > 1000 
                    ? `${formatNumber(monthStats.income / 1000)}к` 
                    : `${formatNumber(monthStats.income)}`}
                </span>
                <span className="text-red-600">
                  -{monthStats.expense > 1000 
                    ? `${formatNumber(monthStats.expense / 1000)}к` 
                    : `${formatNumber(monthStats.expense)}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {pvkjBalance > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold text-muted-foreground">{formatNumber(pvkjBalance)} кг</span>
              <Badge variant="secondary" className="text-xs">ПВКЖ</Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Себестоимость: <span className="font-medium">{formatCurrency(pvkjCost)}/кг</span></span>
              <div className="flex flex-col items-end text-xs gap-0.5">
                <span className="text-muted-foreground text-[10px]">В этом месяце (кг):</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">
                    +{monthStats.pvkjIncome > 1000 
                      ? `${formatNumber(monthStats.pvkjIncome / 1000)}к` 
                      : `${formatNumber(monthStats.pvkjIncome)}`}
                  </span>
                  <span className="text-red-600">
                    -{monthStats.pvkjExpense > 1000 
                      ? `${formatNumber(monthStats.pvkjExpense / 1000)}к` 
                      : `${formatNumber(monthStats.pvkjExpense)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
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