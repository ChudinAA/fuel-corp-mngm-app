import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
} from "lucide-react";
import { STORAGE_CARD_TRANSACTION_TYPE } from "@shared/constants";

interface StorageCardDetailsDialogProps {
  card: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StorageCardDetailsDialog({
  card,
  open,
  onOpenChange,
}: StorageCardDetailsDialogProps) {
  const { data: transactions, isLoading } = useQuery<any[]>({
    queryKey: [`/api/storage-cards/${card.id}/transactions`],
    enabled: open,
    refetchInterval: 10000,
  });

  const formatNumber = (value: any) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
      parseFloat(value || "0")
    );

  const formatCurrency = (value: any) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: card.currency || "USD",
      maximumFractionDigits: 2,
    }).format(parseFloat(value || "0"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sky-400" />
            {card.name} - История транзакций
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-4 shrink-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Остаток
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(card.currentBalance)} {card.currencySymbol}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Цена за кг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(card.latestPrice?.price || 0)} {card.currencySymbol}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Рассчитано кг
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {formatNumber(card.kgAmount)} кг
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <ScrollArea className="h-[400px] pr-4 mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right">Кол-во (кг)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const txPrice = parseFloat(tx.price || "0");
                  const txAmount = parseFloat(tx.quantity || "0");
                  const kg = txPrice > 0 ? txAmount / txPrice : 0;
                  
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">
                        {format(new Date(tx.transactionDate), "dd.MM.yyyy HH:mm", {
                          locale: ru,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tx.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME ? (
                            <ArrowUpCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-xs">
                            {tx.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME
                              ? "Пополнение"
                              : "Списание"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {tx.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME ? "+" : "-"}
                        {formatNumber(tx.quantity)} {card.currencySymbol}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatNumber(tx.price)} {card.currencySymbol}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {formatNumber(kg)} кг
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Транзакции не найдены</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
