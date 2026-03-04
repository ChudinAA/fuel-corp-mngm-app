import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      parseFloat(value || "0"),
    );

  const formatRate = (value: any) =>
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 4,
      minimumFractionDigits: 2,
    }).format(parseFloat(value || "0"));

  const balance = parseFloat(card.currentBalance || "0");
  const isNegative = balance < 0;
  const weightedRate = parseFloat(card.weightedAverageRate || "0");
  const localBalance = weightedRate > 0 ? balance * weightedRate : null;
  const isBuyer = card.cardType === "buyer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[960px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-sky-400" />
            {card.name} — История транзакций
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 py-2 shrink-0">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Остаток (USD)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-xl font-semibold ${isNegative ? "text-red-600 dark:text-red-400" : ""}`}
              >
                {formatNumber(card.currentBalance)} {card.currencySymbol || "$"}
              </p>
              {isNegative && (
                <Badge variant="destructive" className="mt-1 text-xs">
                  Отрицательный баланс
                </Badge>
              )}
            </CardContent>
          </Card>

          {isBuyer ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Остаток ({card.localCurrencyCode || "местн. вал."})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">
                  {localBalance !== null && card.localCurrencyCode
                    ? `${formatNumber(localBalance)} ${card.localCurrencyCode}`
                    : "—"}
                </p>
                {weightedRate > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ср. курс: {formatRate(weightedRate)} {card.localCurrencyCode} / USD
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
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
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {isBuyer ? (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Ср. взв. курс
                  </div>
                ) : (
                  "Рассчитано кг"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isBuyer ? (
                <p className="text-xl font-semibold">
                  {weightedRate > 0
                    ? `${formatRate(weightedRate)} ${card.localCurrencyCode || ""}`
                    : "—"}
                </p>
              ) : (
                <p className="text-xl font-semibold">
                  {formatNumber(card.kgAmount)} кг
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Separator />

        <ScrollArea className="flex-1 pr-4 mt-2">
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
                  <TableHead className="text-right">Сумма (USD)</TableHead>
                  {isBuyer && (
                    <TableHead className="text-right">Местная валюта</TableHead>
                  )}
                  {!isBuyer && (
                    <>
                      <TableHead className="text-right">Цена</TableHead>
                      <TableHead className="text-right">Кол-во (кг)</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">Баланс после</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const txAmount = parseFloat(tx.quantity || "0");
                  const txPrice = parseFloat(tx.price || "0");
                  const kg = txPrice > 0 ? txAmount / txPrice : 0;
                  const isIncome =
                    tx.transactionType === STORAGE_CARD_TRANSACTION_TYPE.INCOME;
                  const hasLocal =
                    tx.localCurrencyAmount &&
                    parseFloat(tx.localCurrencyAmount) > 0;
                  const localCurrencyCode =
                    tx.localCurrency?.code || card.localCurrencyCode;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs">
                        {tx.transactionDate
                          ? format(
                              new Date(tx.transactionDate),
                              "dd.MM.yyyy HH:mm",
                              { locale: ru },
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isIncome ? (
                            <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                          <span className="text-xs">
                            {isIncome ? "Пополнение" : "Списание"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        <span
                          className={
                            isIncome
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }
                        >
                          {isIncome ? "+" : "−"}
                          {formatNumber(txAmount)} $
                        </span>
                      </TableCell>
                      {isBuyer && (
                        <TableCell className="text-right text-xs">
                          {hasLocal && localCurrencyCode ? (
                            <div className="space-y-0.5">
                              <div className="font-medium">
                                {formatNumber(tx.localCurrencyAmount)}{" "}
                                {localCurrencyCode}
                              </div>
                              {tx.exchangeRateToUsd && (
                                <div className="text-muted-foreground text-xs">
                                  курс {formatRate(tx.exchangeRateToUsd)}{" "}
                                  {localCurrencyCode}/USD
                                  {tx.rateDate && (
                                    <span className="ml-1">
                                      от{" "}
                                      {format(
                                        new Date(tx.rateDate),
                                        "dd.MM.yyyy",
                                        { locale: ru },
                                      )}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      {!isBuyer && (
                        <>
                          <TableCell className="text-right text-xs">
                            {formatNumber(txPrice)} {card.currencySymbol}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">
                            {formatNumber(kg)} кг
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatNumber(tx.balanceAfter)} $
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
