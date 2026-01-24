import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React, { useState, useMemo } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Warehouse as WarehouseIcon,
  Droplets,
  Fuel,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Warehouse, Base } from "@shared/schema";
import type { WarehouseTransaction } from "../types";
import { formatNumber, formatCurrency } from "../utils";
import {
  BASE_TYPE,
  PRODUCT_TYPE,
  SOURCE_TYPE,
  TRANSACTION_TYPE,
} from "@shared/constants";

interface WarehouseDetailsDialogProps {
  warehouse: Warehouse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WarehouseDetailsDialog({
  warehouse,
  open,
  onOpenChange,
}: WarehouseDetailsDialogProps) {
  const { data: bases } = useQuery<Base[]>({
    queryKey: ["/api/bases"],
    enabled: open,
  });

  const { data: transactions, isLoading } = useQuery<WarehouseTransaction[]>({
    queryKey: [`/api/warehouses/${warehouse.id}/transactions`],
    enabled: open,
    refetchInterval: 5000,
  });

  const dailyGroups = useMemo(() => {
    if (!transactions) return [];

    const groups: Record<
      string,
      {
        date: string;
        products: Record<
          string,
          {
            productType: string;
            receiptKg: number;
            receiptSum: number;
            expenseKg: number;
            expenseSum: number;
            avgPrice: number;
            avgCost: number;
            balance: number;
            transactions: WarehouseTransaction[];
          }
        >;
      }
    > = {};

    transactions.forEach((tx) => {
      const date = format(
        new Date(tx.transactionDate || tx.createdAt),
        "yyyy-MM-dd",
      );
      if (!groups[date]) {
        groups[date] = { date, products: {} };
      }

      const product = tx.productType || PRODUCT_TYPE.KEROSENE;
      if (!groups[date].products[product]) {
        groups[date].products[product] = {
          productType: product,
          receiptKg: 0,
          receiptSum: 0,
          expenseKg: 0,
          expenseSum: 0,
          avgPrice: 0,
          avgCost: 0,
          balance: 0,
          transactions: [],
        };
      }

      const pData = groups[date].products[product];
      pData.transactions.push(tx);

      // Сортируем транзакции внутри группы по времени создания для корректного определения баланса
      pData.transactions.sort(
        (a, b) =>
          new Date(a.transactionDate || a.createdAt).getTime() -
          new Date(b.transactionDate || b.createdAt).getTime(),
      );

      const qty = parseFloat(tx.quantityKg);
      const sum = parseFloat(tx.sum || "0");
      const price = parseFloat(tx.price || "0");

      if (
        tx.transactionType === TRANSACTION_TYPE.RECEIPT ||
        tx.transactionType === TRANSACTION_TYPE.TRANSFER_IN
      ) {
        pData.receiptKg += qty;
        pData.receiptSum += sum;
        if (price > 0) {
          pData.avgPrice = price;
        }
      } else {
        pData.expenseKg += Math.abs(qty);
        pData.expenseSum += sum;
      }

      // Всегда берем balanceAfter и averageCostAfter из транзакции, которая является последней по времени создания
      const lastTx = pData.transactions[pData.transactions.length - 1];
      pData.avgCost = parseFloat(lastTx.averageCostAfter || "0");
      pData.balance = parseFloat(lastTx.balanceAfter || "0");
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  const getTransactionIcon = (type: string) => {
    if (
      type === TRANSACTION_TYPE.RECEIPT ||
      type === TRANSACTION_TYPE.TRANSFER_IN
    ) {
      return <ArrowUpCircle className="h-5 w-5 text-green-600" />;
    }
    return <ArrowDownCircle className="h-5 w-5 text-red-600" />;
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

  const getBaseIcon = (baseType: string) => {
    if (baseType === BASE_TYPE.REFUELING) {
      return { icon: Fuel, color: "text-green-400", label: "Заправка" };
    }
    return { icon: Droplets, color: "text-orange-400", label: "ОПТ" };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WarehouseIcon className="h-5 w-5 text-sky-400" />
            {warehouse.name} - История операций
          </DialogTitle>
          <DialogDescription>
            Сводная информация по дням и детализация транзакций
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-4 py-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Остаток (Керосин)
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
                Себестоимость (Керосин)
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
                Остаток (ПВКЖ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(warehouse.pvkjBalance || "0")} кг
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Себестоимость (ПВКЖ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatCurrency(warehouse.pvkjAverageCost || "0")}/кг
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
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              <BaseIcon
                                className={`h-3 w-3 ${baseIcon.color}`}
                              />
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

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : dailyGroups.length > 0 ? (
            <div className="min-w-fit overflow-x-auto relative">
              <Table className="relative min-w-[1100px] border-collapse">
                <TableHeader className="sticky top-0 z-[100] bg-background">
                  <TableRow className="hover:bg-transparent shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                    <TableHead className="text-center w-[10%] min-w-[100px] bg-background sticky top-0 border-b">
                      Дата
                    </TableHead>
                    <TableHead className="w-[8%] min-w-[80px] bg-background sticky top-0 border-b">
                      Продукт
                    </TableHead>
                    <TableHead className="text-center w-[11%] min-w-[100px] bg-background sticky top-0 border-b">
                      Поступление, кг
                    </TableHead>
                    <TableHead className="text-center w-[12%] min-w-[110px] bg-background sticky top-0 border-b">
                      Сумма прихода
                    </TableHead>
                    <TableHead className="text-center w-[11%] min-w-[100px] bg-background sticky top-0 border-b">
                      Расход, кг
                    </TableHead>
                    <TableHead className="text-center w-[12%] min-w-[110px] bg-background sticky top-0 border-b">
                      Сумма расхода
                    </TableHead>
                    <TableHead className="text-center w-[11%] min-w-[100px] bg-background sticky top-0 border-b">
                      Остаток
                    </TableHead>
                    <TableHead className="text-center w-[11%] min-w-[100px] bg-background sticky top-0 border-b">
                      Вход. цена
                    </TableHead>
                    <TableHead className="text-center w-[11%] min-w-[100px] bg-background sticky top-0 border-b">
                      Себест.
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyGroups.map((group) => {
                    const sortedProducts = Object.values(group.products).sort(
                      (a) => (a.productType === PRODUCT_TYPE.KEROSENE ? -1 : 1),
                    );
                    return (
                      <DailyRowGroup
                        key={group.date}
                        group={group}
                        products={sortedProducts}
                        getTransactionIcon={getTransactionIcon}
                        getTransactionTypeLabel={getTransactionTypeLabel}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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

function DailyRowGroup({
  group,
  products,
  getTransactionIcon,
  getTransactionTypeLabel,
}: {
  group: any;
  products: any[];
  getTransactionIcon: (type: string) => React.ReactNode;
  getTransactionTypeLabel: (type: string, source?: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 group transition-all ${isOpen ? "ring-2 ring-primary ring-inset bg-muted/30" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell className="font-medium align-top pt-4 w-[10%] min-w-[100px]">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {format(new Date(group.date), "dd.MM.yyyy", { locale: ru })}
          </div>
        </TableCell>
        <TableCell colSpan={8} className="p-0">
          <div className="flex flex-col">
            {products.map((p, idx) => (
              <div
                key={p.productType}
                className={`flex items-center py-2 border-b last:border-0 ${idx === 0 ? "pt-2" : ""}`}
              >
                <div className="w-[9%] min-w-[80px] shrink-0 px-4">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${p.productType === PRODUCT_TYPE.PVKJ ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30" : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"}`}
                  >
                    {p.productType === PRODUCT_TYPE.PVKJ ? "ПВКЖ" : "Керосин"}
                  </Badge>
                </div>
                <div className="w-[12%] min-w-[100px] shrink-0 text-center px-4 font-medium text-green-600 truncate">
                  {p.receiptKg > 0 ? `+${formatNumber(p.receiptKg)}` : "0"} кг
                </div>
                <div className="w-[13.5%] min-w-[110px] shrink-0 text-center px-4 truncate">
                  {p.receiptSum > 0 ? formatCurrency(p.receiptSum) : "0"}
                </div>
                <div className="w-[12%] min-w-[100px] shrink-0 text-right px-4 font-medium text-red-600 truncate">
                  {p.expenseKg > 0 ? `-${formatNumber(p.expenseKg)}` : "0"} кг
                </div>
                <div className="w-[13.5%] min-w-[110px] shrink-0 text-right px-4 truncate">
                  {p.expenseSum > 0 ? formatCurrency(p.expenseSum) : "0"}
                </div>
                <div className="w-[12.5%] min-w-[100px] shrink-0 text-right px-4 font-bold truncate">
                  {formatNumber(p.balance)} кг
                </div>
                <div className="w-[12.5%] min-w-[100px] shrink-0 text-right px-4 truncate">
                  {p.avgPrice > 0 ? formatCurrency(p.avgPrice) : "0"}
                </div>
                <div className="w-[12.5%] min-w-[100px] shrink-0 text-right px-4 font-semibold truncate">
                  {formatCurrency(p.avgCost)}
                </div>
              </div>
            ))}
          </div>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={9} className="p-4">
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-[11px] uppercase tracking-wider">
                      Тип операции
                    </TableHead>
                    <TableHead className="h-8 text-[11px] uppercase tracking-wider">
                      Продукт
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Кол-во
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Сумма
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Цена за кг
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Остаток до
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Остаток после
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Себест. до
                    </TableHead>
                    <TableHead className="h-8 text-right text-[11px] uppercase tracking-wider">
                      Себест. после
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products
                    .flatMap((p) => p.transactions)
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((tx) => (
                      <TableRow key={tx.id} className="h-10">
                        <TableCell className="py-1">
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.transactionType)}
                            <span className="text-xs">
                              {getTransactionTypeLabel(
                                tx.transactionType,
                                tx.sourceType,
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] scale-90 origin-left ${tx.productType === PRODUCT_TYPE.PVKJ ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30" : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30"}`}
                          >
                            {tx.productType === PRODUCT_TYPE.PVKJ
                              ? "ПВКЖ"
                              : "Керосин"}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right py-1 font-medium text-xs ${parseFloat(tx.quantityKg) > 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {parseFloat(tx.quantityKg) > 0 ? "+" : ""}
                          {formatNumber(tx.quantityKg)} кг
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {tx.sum ? formatCurrency(tx.sum) : "—"}
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {tx.price ? formatCurrency(tx.price) : "—"}
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {formatNumber(tx.balanceBefore)} кг
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {formatNumber(tx.balanceAfter)} кг
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {formatCurrency(tx.averageCostBefore)}
                        </TableCell>
                        <TableCell className="text-right py-1 text-xs">
                          {formatCurrency(tx.averageCostAfter)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
