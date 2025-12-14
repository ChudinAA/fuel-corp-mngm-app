
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Package, ArrowUpCircle, ArrowDownCircle, Warehouse as WarehouseIcon, Droplets, Fuel } from "lucide-react";
import type { Warehouse, Base } from "@shared/schema";
import type { WarehouseTransaction } from "../types";
import { formatNumber, formatCurrency } from "../utils";

interface WarehouseDetailsDialogProps {
  warehouse: Warehouse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WarehouseDetailsDialog({ 
  warehouse, 
  open, 
  onOpenChange 
}: WarehouseDetailsDialogProps) {
  const { data: bases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
    enabled: open,
  });

  const { data: transactions, isLoading } = useQuery<WarehouseTransaction[]>({
    queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
    enabled: open,
  });

  const getTransactionIcon = (type: string) => {
    if (type === 'receipt' || type === 'transfer_in') {
      return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
    }
    return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  const getTransactionTypeLabel = (transactionType: string, sourceType?: string) => {
    if (transactionType === 'receipt') return 'Поступление';
    if (transactionType === 'transfer_in') return 'Перемещение (приход)';
    if (transactionType === 'transfer_out') return 'Перемещение (расход)';
    if (transactionType === 'sale') {
      if (sourceType === 'refueling') return 'Продажа (Заправка ВС)';
      if (sourceType === 'opt') return 'Продажа (ОПТ)';
      return 'Продажа';
    }
    return transactionType;
  };

  const getBaseIcon = (baseType: string) => {
    if (baseType === 'refueling') {
      return { icon: Fuel, color: "text-green-400", label: "Заправка" };
    }
    return { icon: Droplets, color: "text-orange-400", label: "ОПТ" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WarehouseIcon className="h-5 w-5 text-sky-400" />
            {warehouse.name} - История операций
          </DialogTitle>
          <DialogDescription>
            Детализация поступлений и списаний по складу
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Текущий остаток
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(warehouse.currentBalance || "0")} кг
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Средняя себестоимость
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatCurrency(warehouse.averageCost || "0")}/кг
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Базисы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {warehouse.baseIds && warehouse.baseIds.length > 0 && bases ? (
                <div className="flex flex-wrap gap-1">
                  {warehouse.baseIds.map((baseId) => {
                    const base = bases.find((b: any) => b.id === baseId);
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
                </div>
              ) : (
                <Badge variant="outline">—</Badge>
              )}
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
                      {format(new Date(tx.createdAt), "dd.MM.yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className="text-sm">
                          {getTransactionTypeLabel(tx.transactionType, tx.sourceType)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      parseFloat(tx.quantityKg) > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(tx.quantityKg) > 0 ? '+' : ''}
                      {formatNumber(tx.quantityKg)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tx.balanceBefore)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tx.balanceAfter)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(tx.averageCostBefore)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(tx.averageCostAfter)}
                    </TableCell>
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
