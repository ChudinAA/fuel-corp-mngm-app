import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
} from "lucide-react";
import type { Equipment, EquipmentTransaction } from "@shared/schema";
import { formatNumber, formatCurrency } from "../../warehouses/utils";

interface EquipmentDetailsDialogProps {
  equipment: Equipment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EquipmentDetailsDialog({
  equipment,
  open,
  onOpenChange,
}: EquipmentDetailsDialogProps) {
  const { data: transactions, isLoading } = useQuery<EquipmentTransaction[]>({
    queryKey: [`/api/warehouses-equipment/${equipment.id}/transactions`],
    enabled: open,
  });

  const getTransactionIcon = (type: string) => {
    if (type === "income" || type === "receipt") {
      return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
    }
    return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-orange-400" />
            {equipment.name} - История операций
          </DialogTitle>
          <DialogDescription>
            Детализация поступлений и расходов топлива
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 shrink-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Текущий остаток
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(equipment.currentBalance || "0")} кг
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Средняя стоимость
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatCurrency(equipment.averageCost || "0")}/кг
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <ScrollArea className="h-[50vh] mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Остаток после</TableHead>
                  <TableHead className="text-right">Себест. после</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {tx.transactionDate 
                        ? format(new Date(tx.transactionDate), "dd.MM.yyyy HH:mm", { locale: ru })
                        : format(new Date(tx.createdAt!), "dd.MM.yyyy HH:mm", { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className="text-xs">
                          {tx.transactionType === "income" ? "Поступление" : "Расход"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${tx.transactionType === "income" ? "text-green-600" : "text-red-600"}`}>
                      {tx.transactionType === "income" ? "+" : "-"}
                      {formatNumber(tx.quantity)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tx.balanceAfter)} кг
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
              <p>Нет операций</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
