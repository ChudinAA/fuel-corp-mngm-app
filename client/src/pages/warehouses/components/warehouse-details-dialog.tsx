
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
import { Package, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import type { Warehouse, WholesaleBase, RefuelingBase } from "@shared/schema";
import type { WarehouseTransaction } from "../types";
import { formatNumber, formatCurrency, getTransactionTypeLabel } from "../utils";

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
  const { data: wholesaleBases } = useQuery<WholesaleBase[]>({
    queryKey: ["/api/wholesale/bases"],
    enabled: open,
  });

  const { data: refuelingBases } = useQuery<RefuelingBase[]>({
    queryKey: ["/api/refueling/bases"],
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
              {warehouse.baseIds && warehouse.baseIds.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {warehouse.baseIds.map((baseId, index) => {
                    const baseName = [...(wholesaleBases || []), ...(refuelingBases || [])].find(
                      (b: any) => b.id === baseId
                    )?.name;
                    return baseName ? (
                      <Badge key={index} variant="outline">{baseName}</Badge>
                    ) : null;
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
                      {format(new Date(tx.transactionDate), "dd.MM.yyyy", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className="text-sm">
                          {getTransactionTypeLabel(tx.transactionType)}
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
