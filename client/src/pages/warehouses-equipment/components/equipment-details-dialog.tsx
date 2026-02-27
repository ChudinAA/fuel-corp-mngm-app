import { useInfiniteQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
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
  Loader2,
} from "lucide-react";
import type { Equipment, EquipmentTransaction } from "@shared/schema";
import { formatNumber, formatCurrency } from "../../warehouses/utils";
import { PRODUCT_TYPE, SOURCE_TYPE, TRANSACTION_TYPE } from "@shared/constants";
import { ProductTypeBadge } from "@/components/product-type-badge";

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
  const pagelimit = 25;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [`/api/warehouses-equipment/${equipment.id}/transactions`],
      queryFn: async ({ pageParam = 0 }) => {
        const res = await fetch(
          `/api/warehouses-equipment/${equipment.id}/transactions?offset=${pageParam}&limit=${pagelimit}`,
        );
        if (!res.ok) throw new Error("Failed to fetch transactions");
        return res.json() as Promise<{
          transactions: EquipmentTransaction[];
          hasMore: boolean;
        }>;
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.hasMore ? allPages.length * pagelimit : undefined;
      },
      enabled: open,
      refetchInterval: 5000,
    });

  const transactions = useMemo(
    () => data?.pages.flatMap((page) => page.transactions) || [],
    [data],
  );

  const isReceipt = (type: string) =>
    type === TRANSACTION_TYPE.TRANSFER_IN || type === TRANSACTION_TYPE.RECEIPT;

  const getTransactionIcon = (type: string) => {
    if (isReceipt(type)) {
      return <ArrowUpCircle className="h-4 w-4 text-green-600" />;
    }
    return <ArrowDownCircle className="h-4 w-4 text-red-600" />;
  };

  const getTransactionTypeLabel = (
    transactionType: string,
    sourceType?: string,
  ) => {
    switch (transactionType) {
      case TRANSACTION_TYPE.RECEIPT:
        return "Поступление";
      case TRANSACTION_TYPE.TRANSFER_IN:
        return "Перемещение (приход)";
      case TRANSACTION_TYPE.TRANSFER_OUT:
        return "Перемещение (расход)";
      case TRANSACTION_TYPE.SALE:
        if (sourceType === SOURCE_TYPE.REFUELING)
          return "Продажа (Заправка ВС)";
        if (sourceType === SOURCE_TYPE.OPT) return "Продажа (ОПТ)";
        return "Продажа";
      default:
        return transactionType;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
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
                Керосин: {formatNumber(equipment.currentBalance || "0")} кг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Себест: {formatCurrency(equipment.averageCost || "0")}/кг
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ПВКЖ: {formatNumber(equipment.pvkjBalance || "0")} кг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Себест: {formatCurrency(equipment.pvkjAverageCost || "0")}/кг
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
                  <TableHead>Продукт</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right">Остаток до</TableHead>
                  <TableHead className="text-right">Остаток после</TableHead>
                  <TableHead className="text-right">Себест-ть</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {tx.transactionDate
                        ? format(new Date(tx.transactionDate), "dd.MM.yyyy", {
                            locale: ru,
                          })
                        : format(new Date(tx.createdAt!), "dd.MM.yyyy", {
                            locale: ru,
                          })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.transactionType)}
                        <span className="text-xs">
                          {getTransactionTypeLabel(
                            tx.transactionType,
                            tx.sourceType || undefined,
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ProductTypeBadge
                        type={tx.productType || PRODUCT_TYPE.KEROSENE}
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${isReceipt(tx.transactionType) ? "text-green-600" : "text-red-600"}`}
                    >
                      {isReceipt(tx.transactionType) ? "+" : ""}
                      {formatNumber(tx.quantity)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tx.balanceBefore || 0)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(tx.balanceAfter || 0)} кг
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(tx.averageCostAfter || 0)}
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

          {hasNextPage && (
            <div className="flex justify-center p-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                data-testid="button-load-more"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  "Загрузить еще"
                )}
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
